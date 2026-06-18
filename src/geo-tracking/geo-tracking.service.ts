import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { AttendanceDaily, AttendanceStatus } from './schemas/attendance-daily.schema';
import { LocationPoint, PointQuality } from './schemas/location-point.schema';
import { EmployeeLiveLocation, LiveLocationStatus } from './schemas/employee-live-location.schema';
import { AttendanceTimelineSummary } from './schemas/attendance-timeline-summary.schema';
import { Employee } from './schemas/employee.schema';
import { LocationPointDto } from './dto/batch-location-points.dto';
import { TimelineRebuildQueue } from './queues/timeline-rebuild.queue';
import { AuthenticatedUser } from './guards/jwt-auth.guard';
import { LocationBroadcastService } from './location-broadcast.service';

@Injectable()
export class GeoTrackingService {
  constructor(
    @InjectModel(AttendanceDaily.name)
    private readonly attendanceDailyModel: Model<AttendanceDaily>,
    @InjectModel(LocationPoint.name)
    private readonly locationPointModel: Model<LocationPoint>,
    @InjectModel(EmployeeLiveLocation.name)
    private readonly employeeLiveLocationModel: Model<EmployeeLiveLocation>,
    @InjectModel(AttendanceTimelineSummary.name)
    private readonly attendanceTimelineSummaryModel: Model<AttendanceTimelineSummary>,
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<Employee>,
    private readonly configService: ConfigService,
    private readonly timelineRebuildQueue: TimelineRebuildQueue,
    private readonly locationBroadcastService: LocationBroadcastService,
  ) {}

  async getTrackingConfig(
    attendanceId: string,
    user: AuthenticatedUser,
  ): Promise<{
    trackingEnabled: boolean;
    locationIntervalSeconds: number;
    distanceFilterMeters: number;
    batchSize: number;
  }> {
    const attendance = await this.attendanceDailyModel.findById(attendanceId);
    if (!attendance) {
      throw new NotFoundException('Attendance not found');
    }

    if (
      attendance.employeeId !== user.employeeId ||
      attendance.companyId !== user.companyId
    ) {
      throw new NotFoundException('Attendance not found');
    }

    if (
      attendance.status !== AttendanceStatus.WORKING &&
      attendance.status !== AttendanceStatus.ON_BREAK
    ) {
      throw new ConflictException('Attendance is not active');
    }

    const config = this.configService.get('geoTracking');
    return {
      trackingEnabled: true,
      locationIntervalSeconds: config.locationIntervalSeconds,
      distanceFilterMeters: config.distanceFilterMeters,
      batchSize: config.batchSize,
    };
  }

  async batchInsertLocationPoints(
    attendanceId: string,
    deviceId: string,
    points: LocationPointDto[],
    user: AuthenticatedUser,
  ): Promise<{
    accepted: number;
    duplicates: number;
    rejected: number;
    lastAcceptedSequenceNo: number;
  }> {
    const maxBatchSize = this.configService.get<number>('geoTracking.maxBatchSize', 200);
    if (points.length > maxBatchSize) {
      throw new BadRequestException(
        `Batch size exceeds maximum of ${maxBatchSize}`,
      );
    }

    const attendance = await this.attendanceDailyModel.findById(attendanceId);
    if (!attendance) {
      throw new NotFoundException('Attendance not found');
    }

    if (
      attendance.employeeId !== user.employeeId ||
      attendance.companyId !== user.companyId
    ) {
      throw new NotFoundException('Attendance not found');
    }

    if (
      attendance.status !== AttendanceStatus.WORKING &&
      attendance.status !== AttendanceStatus.ON_BREAK
    ) {
      throw new BadRequestException('Attendance is not active');
    }

    const poorAccuracyThreshold = this.configService.get<number>(
      'geoTracking.poorAccuracyThresholdMeters',
      50,
    );

    let accepted = 0;
    let duplicates = 0;
    let rejected = 0;
    let lastAcceptedSequenceNo = -1;
    const pointsToInsert: any[] = [];

    const clientPointIds = points.map((p) => p.clientPointId);
    const deviceSequencePairs = points.map((p) => ({
      deviceId,
      sequenceNo: p.sequenceNo,
    }));

    const existingByClientPointId = await this.locationPointModel
      .find({ clientPointId: { $in: clientPointIds } })
      .select('clientPointId')
      .lean();
    const existingClientPointIds = new Set(
      existingByClientPointId.map((p) => p.clientPointId),
    );

    const existingByDeviceSequence = await this.locationPointModel
      .find({ $or: deviceSequencePairs })
      .select('deviceId sequenceNo')
      .lean();
    const existingDeviceSequenceSet = new Set(
      existingByDeviceSequence.map((p) => `${p.deviceId}:${p.sequenceNo}`),
    );

    for (const pointDto of points) {
      const isDuplicate =
        existingClientPointIds.has(pointDto.clientPointId) ||
        existingDeviceSequenceSet.has(`${deviceId}:${pointDto.sequenceNo}`);

      if (isDuplicate) {
        duplicates++;
        continue;
      }

      if (
        pointDto.latitude < -90 ||
        pointDto.latitude > 90 ||
        pointDto.longitude < -180 ||
        pointDto.longitude > 180 ||
        !pointDto.capturedAt
      ) {
        rejected++;
        continue;
      }

      const capturedAt = new Date(pointDto.capturedAt);
      const location = {
        type: 'Point',
        coordinates: [pointDto.longitude, pointDto.latitude],
      };
      const quality =
        pointDto.accuracyM > poorAccuracyThreshold
          ? PointQuality.POOR
          : PointQuality.GOOD;

      const latestSession = attendance.sessions[attendance.sessions.length - 1];
      const sessionId = latestSession ? latestSession.sessionId : '';

      pointsToInsert.push({
        companyId: user.companyId,
        employeeId: user.employeeId,
        attendanceId,
        sessionId,
        clientPointId: pointDto.clientPointId,
        deviceId,
        sequenceNo: pointDto.sequenceNo,
        capturedAt,
        receivedAt: new Date(),
        location,
        accuracyM: pointDto.accuracyM,
        speedMps: pointDto.speedMps,
        heading: pointDto.heading,
        altitude: 0,
        batteryPercent: pointDto.batteryPercent,
        networkType: pointDto.networkType,
        appState: pointDto.appState,
        isMocked: pointDto.isMocked,
        eventType: 'LOCATION_POINT',
        quality,
      });

      accepted++;
      if (pointDto.sequenceNo > lastAcceptedSequenceNo) {
        lastAcceptedSequenceNo = pointDto.sequenceNo;
      }
    }

    if (pointsToInsert.length > 0) {
      await this.locationPointModel.insertMany(pointsToInsert);

      const latestPoint = pointsToInsert.reduce((latest, current) => {
        return !latest || current.capturedAt > latest.capturedAt
          ? current
          : latest;
      }, null);

      if (latestPoint) {
        const existingLiveLocation =
          await this.employeeLiveLocationModel.findOne({
            companyId: user.companyId,
            employeeId: user.employeeId,
          });

        if (
          !existingLiveLocation ||
          latestPoint.capturedAt > existingLiveLocation.capturedAt
        ) {
          const status =
            attendance.status === AttendanceStatus.WORKING
              ? LiveLocationStatus.WORKING
              : LiveLocationStatus.ON_BREAK;

          const updatedLiveLocation =
            await this.employeeLiveLocationModel.findOneAndUpdate(
              {
                companyId: user.companyId,
                employeeId: user.employeeId,
              },
              {
                $set: {
                  companyId: user.companyId,
                  employeeId: user.employeeId,
                  attendanceId,
                  latestPointId: latestPoint._id.toString(),
                  location: latestPoint.location,
                  capturedAt: latestPoint.capturedAt,
                  receivedAt: latestPoint.receivedAt,
                  status,
                  isStale: false,
                  lastUpdatedAt: new Date(),
                },
              },
              { upsert: true, new: true },
            );

          // Broadcast location update
          this.locationBroadcastService.broadcastEmployeeLocationUpdate(
            user.companyId,
            user.employeeId,
            {
              employeeId: user.employeeId,
              location: {
                latitude: latestPoint.location.coordinates[1],
                longitude: latestPoint.location.coordinates[0],
              },
              status,
              isStale: false,
              lastUpdatedAt: new Date(),
            },
          );

          // If was stale before, broadcast status update
          if (existingLiveLocation?.isStale) {
            this.locationBroadcastService.broadcastEmployeeStatusUpdate(
              user.companyId,
              user.employeeId,
              {
                employeeId: user.employeeId,
                isStale: false,
                status,
              },
            );
          }
        }
      }
    }

    return {
      accepted,
      duplicates,
      rejected,
      lastAcceptedSequenceNo:
        lastAcceptedSequenceNo === -1 ? 0 : lastAcceptedSequenceNo,
    };
  }

  async stopTracking(
    attendanceId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const attendance = await this.attendanceDailyModel.findById(attendanceId);
    if (!attendance) {
      throw new NotFoundException('Attendance not found');
    }

    if (
      attendance.employeeId !== user.employeeId ||
      attendance.companyId !== user.companyId
    ) {
      throw new NotFoundException('Attendance not found');
    }

    if (!attendance.trackingStoppedAt) {
      await this.attendanceDailyModel.findByIdAndUpdate(attendanceId, {
        $set: { trackingStoppedAt: new Date() },
      });
    }

    await this.timelineRebuildQueue.enqueueRebuild(attendanceId);
  }

  async getLiveEmployees(
    companyId: string,
    status?: LiveLocationStatus,
  ): Promise<{
    employeeId: string;
    name: string;
    status: LiveLocationStatus;
    isStale: boolean;
    lastLocation: { latitude: number; longitude: number };
    lastUpdatedAt: Date;
  }[]> {
    const staleThresholdMinutes = this.configService.get<number>(
      'geoTracking.staleThresholdMinutes',
      5,
    );
    const staleThresholdMs = staleThresholdMinutes * 60 * 1000;
    const now = new Date();

    const filter: any = { companyId };
    if (status) {
      filter.status = status;
    }

    const liveLocations = await this.employeeLiveLocationModel
      .find(filter)
      .lean();

    const employeeIds = liveLocations.map((ll) => ll.employeeId);
    const employees = await this.employeeModel
      .find({ companyId, employeeId: { $in: employeeIds } })
      .lean();

    const employeeMap = new Map<string, string>();
    employees.forEach((emp) => {
      employeeMap.set(emp.employeeId, emp.name);
    });

    return liveLocations.map((ll) => {
      const isStale =
        ll.isStale ||
        now.getTime() - ll.lastUpdatedAt.getTime() > staleThresholdMs;
      let finalStatus = ll.status;
      if (isStale && finalStatus !== LiveLocationStatus.CHECKED_OUT) {
        finalStatus = LiveLocationStatus.STALE;
      }

      return {
        employeeId: ll.employeeId,
        name: employeeMap.get(ll.employeeId) || 'Unknown',
        status: finalStatus,
        isStale,
        lastLocation: {
          latitude: ll.location.coordinates[1],
          longitude: ll.location.coordinates[0],
        },
        lastUpdatedAt: ll.lastUpdatedAt,
      };
    });
  }

  async getEmployeeGeoTimeline(
    companyId: string,
    employeeId: string,
    date: string,
  ): Promise<any> {
    const attendance = await this.attendanceDailyModel.findOne({
      companyId,
      employeeId,
      attendanceDate: date,
    });

    if (!attendance) {
      throw new NotFoundException('Attendance not found for this date');
    }

    const attendanceIdString = attendance._id.toString();
    const summary = await this.attendanceTimelineSummaryModel.findOne({
      attendanceId: attendanceIdString,
    });

    const rawPointsCount = await this.locationPointModel.countDocuments({
      attendanceId: attendanceIdString,
    });

    let summaryAvailable = !!summary;
    let processedRoute = null;
    let totals = null;
    let timelineEvents = null;
    let anomalies = null;

    if (summaryAvailable && summary) {
      processedRoute = {
        encodedProcessedPolyline: summary.encodedProcessedPolyline,
        encodedRawPolyline: summary.encodedRawPolyline,
      };
      totals = {
        rawDistanceMeters: summary.rawDistanceMeters,
        processedDistanceMeters: summary.processedDistanceMeters,
        workingSeconds: summary.workingSeconds,
        breakSeconds: summary.breakSeconds,
        movingSeconds: summary.movingSeconds,
        holdSeconds: summary.holdSeconds,
        dataGapSeconds: summary.dataGapSeconds,
        gpsQualityScore: summary.gpsQualityScore,
      };
      timelineEvents = summary.timelineEvents;
      anomalies = summary.anomalies;
    }

    return {
      attendance,
      rawPointsCount,
      summaryAvailable,
      processedRoute,
      totals,
      timelineEvents,
      anomalies,
    };
  }

  async rebuildGeoTimeline(
    companyId: string,
    attendanceId: string,
  ): Promise<void> {
    const attendance = await this.attendanceDailyModel.findById(attendanceId);
    if (!attendance) {
      throw new NotFoundException('Attendance not found');
    }
    if (attendance.companyId !== companyId) {
      throw new ForbiddenException('Attendance does not belong to this company');
    }

    await this.timelineRebuildQueue.enqueueRebuild(attendanceId);
  }
}
