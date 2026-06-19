import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as polyline from '@mapbox/polyline';
import { AttendanceDaily } from './schemas/attendance-daily.schema';
import { LocationPoint, PointQuality } from './schemas/location-point.schema';
import { AttendanceTimelineSummary } from './schemas/attendance-timeline-summary.schema';
import { LocationBroadcastService } from './location-broadcast.service';

interface ProcessedPoint {
  clientPointId: string;
  deviceId: string;
  sequenceNo: number;
  capturedAt: Date;
  latitude: number;
  longitude: number;
  accuracyM: number;
  speedMps: number;
  heading: number;
  batteryPercent: number;
  networkType: string;
  appState: string;
  isMocked: boolean;
  quality: PointQuality;
  estimated?: boolean;
}

interface TimelineEvent {
  type: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END' | 'STOP';
  at?: Date;
  startAt?: Date;
  endAt?: Date;
  durationSeconds?: number;
}

interface Anomaly {
  type: 'DATA_GAP' | 'IMPOSSIBLE_JUMP';
  startAt: Date;
  endAt: Date;
  durationSeconds: number;
}

@Injectable()
export class TimelineCalculatorService {
  constructor(
    @InjectModel(AttendanceDaily.name)
    private readonly attendanceDailyModel: Model<AttendanceDaily>,
    @InjectModel(LocationPoint.name)
    private readonly locationPointModel: Model<LocationPoint>,
    @InjectModel(AttendanceTimelineSummary.name)
    private readonly attendanceTimelineSummaryModel: Model<AttendanceTimelineSummary>,
    private readonly configService: ConfigService,
    private readonly locationBroadcastService: LocationBroadcastService,
  ) {}

  /**
   * Haversine distance formula: calculates distance between two coordinates in meters
   */
  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Step 1: Load AttendanceDaily and LocationPoints
   */
  private async loadData(
    attendanceId: string,
  ): Promise<{ attendance: AttendanceDaily; points: LocationPoint[] }> {
    const attendance = await this.attendanceDailyModel.findById(attendanceId);
    if (!attendance) {
      throw new Error('Attendance not found');
    }

    const points = await this.locationPointModel.find({ attendanceId });
    return { attendance, points };
  }

  /**
   * Step 2: Sort points by capturedAt ascending
   */
  private sortPoints(points: LocationPoint[]): LocationPoint[] {
    return [...points].sort(
      (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime(),
    );
  }

  /**
   * Step 3: Deduplicate by clientPointId, then by (deviceId + sequenceNo)
   */
  private deduplicatePoints(points: LocationPoint[]): LocationPoint[] {
    const seenClientPointIds = new Set<string>();
    const seenDeviceSequencePairs = new Set<string>();
    const deduplicated: LocationPoint[] = [];

    for (const point of points) {
      const deviceSequenceKey = `${point.deviceId}:${point.sequenceNo}`;
      if (
        seenClientPointIds.has(point.clientPointId) ||
        seenDeviceSequencePairs.has(deviceSequenceKey)
      ) {
        continue;
      }
      seenClientPointIds.add(point.clientPointId);
      seenDeviceSequencePairs.add(deviceSequenceKey);
      deduplicated.push(point);
    }

    return deduplicated;
  }

  /**
   * Step 4: Reject points with invalid coordinates
   */
  private filterInvalidCoordinates(points: LocationPoint[]): LocationPoint[] {
    return points.filter((point) => {
      const [lon, lat] = point.location.coordinates;
      return (
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180 &&
        !isNaN(lat) &&
        !isNaN(lon)
      );
    });
  }

  /**
   * Step 5: Re-mark quality based on current accuracy threshold
   */
  private recheckQuality(
    points: LocationPoint[],
    poorAccuracyThreshold: number,
  ): ProcessedPoint[] {
    return points.map((point) => {
      const [lon, lat] = point.location.coordinates;
      const quality =
        point.accuracyM > poorAccuracyThreshold
          ? PointQuality.POOR
          : PointQuality.GOOD;
      return {
        clientPointId: point.clientPointId,
        deviceId: point.deviceId,
        sequenceNo: point.sequenceNo,
        capturedAt: point.capturedAt,
        latitude: lat,
        longitude: lon,
        accuracyM: point.accuracyM,
        speedMps: point.speedMps,
        heading: point.heading,
        batteryPercent: point.batteryPercent,
        networkType: point.networkType,
        appState: point.appState,
        isMocked: point.isMocked,
        quality,
      };
    });
  }

  /**
   * Step 6: Detect impossible jumps
   */
  private detectImpossibleJumps(
    points: ProcessedPoint[],
    maxSpeedMps: number,
  ): {
    points: ProcessedPoint[];
    impossibleJumpSegments: Set<string>;
    anomalies: Anomaly[];
  } {
    const updatedPoints = [...points];
    const impossibleJumpSegments = new Set<string>();
    const anomalies: Anomaly[] = [];

    for (let i = 1; i < updatedPoints.length; i++) {
      const prev = updatedPoints[i - 1];
      const curr = updatedPoints[i];

      if (
        prev.quality === PointQuality.GOOD &&
        curr.quality === PointQuality.GOOD
      ) {
        const distance = this.haversineDistance(
          prev.latitude,
          prev.longitude,
          curr.latitude,
          curr.longitude,
        );
        const timeDelta =
          (curr.capturedAt.getTime() - prev.capturedAt.getTime()) / 1000;
        if (timeDelta > 0) {
          const speed = distance / timeDelta;
          if (speed > maxSpeedMps) {
            updatedPoints[i].quality = PointQuality.ANOMALY;
            impossibleJumpSegments.add(`${i - 1}-${i}`);
            anomalies.push({
              type: 'IMPOSSIBLE_JUMP',
              startAt: prev.capturedAt,
              endAt: curr.capturedAt,
              durationSeconds: timeDelta,
            });
          }
        }
      }
    }

    return { points: updatedPoints, impossibleJumpSegments, anomalies };
  }

  /**
   * Step 7: Calculate raw and processed distances
   */
  private calculateDistances(
    points: ProcessedPoint[],
    impossibleJumpSegments: Set<string>,
  ): {
    rawDistanceMeters: number;
    processedDistanceMeters: number;
  } {
    let rawDistance = 0;
    let processedDistance = 0;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const distance = this.haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude,
      );
      rawDistance += distance;

      if (
        prev.quality === PointQuality.GOOD &&
        curr.quality === PointQuality.GOOD &&
        !impossibleJumpSegments.has(`${i - 1}-${i}`)
      ) {
        processedDistance += distance;
      }
    }

    // Extension point: snappedDistanceMeters (Google Roads API)
    // const snappedDistanceMeters = 0; // To be implemented in Phase 6

    return {
      rawDistanceMeters: rawDistance,
      processedDistanceMeters: processedDistance,
    };
  }

  /**
   * Step 8: Detect hold/stop segments
   */
  private detectStops(
    points: ProcessedPoint[],
    stopRadiusMeters: number,
    stopDurationSeconds: number,
  ): TimelineEvent[] {
    const stops: TimelineEvent[] = [];
    if (points.length < 2) return stops;

    let i = 0;
    while (i < points.length - 1) {
      const startPoint = points[i];
      let j = i + 1;
      let maxDistance = 0;

      while (j < points.length) {
        const distance = this.haversineDistance(
          startPoint.latitude,
          startPoint.longitude,
          points[j].latitude,
          points[j].longitude,
        );
        maxDistance = Math.max(maxDistance, distance);
        if (maxDistance > stopRadiusMeters) break;
        j++;
      }

      const duration =
        (points[j - 1].capturedAt.getTime() - startPoint.capturedAt.getTime()) /
        1000;
      if (duration >= stopDurationSeconds) {
        stops.push({
          type: 'STOP',
          startAt: startPoint.capturedAt,
          endAt: points[j - 1].capturedAt,
          durationSeconds: duration,
        });
      }
      i = j;
    }

    return stops;
  }

  /**
   * Step 10: Detect data gaps
   */
  private detectDataGaps(
    points: ProcessedPoint[],
    gapDurationSeconds: number,
  ): {
    anomalies: Anomaly[];
    pointsWithEstimatedFlag: ProcessedPoint[];
  } {
    const anomalies: Anomaly[] = [];
    const updatedPoints = [...points];

    for (let i = 1; i < updatedPoints.length; i++) {
      const prev = updatedPoints[i - 1];
      const curr = updatedPoints[i];
      const duration =
        (curr.capturedAt.getTime() - prev.capturedAt.getTime()) / 1000;
      if (duration > gapDurationSeconds) {
        anomalies.push({
          type: 'DATA_GAP',
          startAt: prev.capturedAt,
          endAt: curr.capturedAt,
          durationSeconds: duration,
        });
        updatedPoints[i].estimated = true;
      }
    }

    return { anomalies, pointsWithEstimatedFlag: updatedPoints };
  }

  /**
   * Step 11: Calculate aggregate totals
   * GPS quality score formula (documented):
   *  score = (goodPoints / totalPoints) * 100 - (totalGapSeconds / totalSessionSeconds) * 50
   *  clamped to 0-100
   */
  private calculateAggregateTotals(
    attendance: AttendanceDaily,
    points: ProcessedPoint[],
    dataGaps: Anomaly[],
    stops: TimelineEvent[],
  ): {
    workingSeconds: number;
    breakSeconds: number;
    movingSeconds: number;
    holdSeconds: number;
    dataGapSeconds: number;
    gpsQualityScore: number;
  } {
    // Calculate break seconds
    let breakSeconds = 0;
    for (const session of attendance.sessions) {
      for (const brk of session.breaks) {
        const end = brk.endAt || new Date();
        breakSeconds += (end.getTime() - brk.startAt.getTime()) / 1000;
      }
    }

    // Calculate working seconds
    let workingSeconds = 0;
    for (const session of attendance.sessions) {
      const checkIn = session.checkInAt;
      const checkOut = session.checkOutAt || new Date();
      workingSeconds += (checkOut.getTime() - checkIn.getTime()) / 1000;
    }
    workingSeconds -= breakSeconds;

    // Calculate hold seconds
    let holdSeconds = 0;
    for (const stop of stops) {
      holdSeconds += stop.durationSeconds || 0;
    }

    // Calculate data gap seconds
    let dataGapSeconds = 0;
    for (const gap of dataGaps) {
      dataGapSeconds += gap.durationSeconds;
    }

    // Calculate moving seconds
    const movingSeconds = Math.max(0, workingSeconds - holdSeconds);

    // Calculate GPS quality score
    const totalPoints = points.length;
    const goodPoints = points.filter(
      (p) => p.quality === PointQuality.GOOD,
    ).length;
    const totalSessionSeconds = workingSeconds + breakSeconds;

    let score = 0;
    if (totalPoints > 0 && totalSessionSeconds > 0) {
      const goodRatio = goodPoints / totalPoints;
      const gapPenalty = (dataGapSeconds / totalSessionSeconds) * 50;
      score = goodRatio * 100 - gapPenalty;
    }
    score = Math.max(0, Math.min(100, score));

    return {
      workingSeconds,
      breakSeconds,
      movingSeconds,
      holdSeconds,
      dataGapSeconds,
      gpsQualityScore: score,
    };
  }

  /**
   * Step 12: Build timeline events
   */
  private buildTimelineEvents(
    attendance: AttendanceDaily,
    stops: TimelineEvent[],
  ): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Add check in/out and break events
    for (const session of attendance.sessions) {
      events.push({ type: 'CHECK_IN', at: session.checkInAt });
      for (const brk of session.breaks) {
        events.push({ type: 'BREAK_START', at: brk.startAt });
        if (brk.endAt) {
          events.push({ type: 'BREAK_END', at: brk.endAt });
        }
      }
      if (session.checkOutAt) {
        events.push({ type: 'CHECK_OUT', at: session.checkOutAt });
      }
    }

    // Add stop events
    events.push(...stops);

    // Sort all events chronologically
    return events.sort((a, b) => {
      const timeA = (a.at || a.startAt || new Date(0)).getTime();
      const timeB = (b.at || b.startAt || new Date(0)).getTime();
      return timeA - timeB;
    });
  }

  /**
   * Step 13: Build encoded polylines
   * Uses @mapbox/polyline library
   */
  private buildEncodedPolylines(
    allPoints: ProcessedPoint[],
    goodPointsOnly: ProcessedPoint[],
  ): {
    encodedRawPolyline: string;
    encodedProcessedPolyline: string;
  } {
    const rawCoords: [number, number][] = allPoints.map((p) => [
      p.latitude,
      p.longitude,
    ]);
    const processedCoords: [number, number][] = goodPointsOnly.map((p) => [
      p.latitude,
      p.longitude,
    ]);

    return {
      encodedRawPolyline: polyline.encode(rawCoords),
      encodedProcessedPolyline: polyline.encode(processedCoords),
    };
  }

  private perpendicularDistance(
    point: [number, number],
    lineStart: [number, number],
    lineEnd: [number, number],
  ): number {
    const [lat, lng] = point;
    const [startLat, startLng] = lineStart;
    const [endLat, endLng] = lineEnd;

    if (startLat === endLat && startLng === endLng) {
      return this.haversineDistance(lat, lng, startLat, startLng);
    }

    const x0 = lat;
    const y0 = lng;
    const x1 = startLat;
    const y1 = startLng;
    const x2 = endLat;
    const y2 = endLng;

    const cross =
      Math.abs((x2 - x1) * (y1 - y0) - (x1 - x0) * (y2 - y1));
    const base = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const perpendicular = cross / base;

    return perpendicular * 111320; // approximate conversion degrees to meters
  }

  private simplifyPoints(
    points: ProcessedPoint[],
    toleranceMeters: number,
  ): ProcessedPoint[] {
    if (points.length <= 2) return points;

    const keep = new Array(points.length).fill(false);
    keep[0] = true;
    keep[points.length - 1] = true;

    const simplifyRange = (startIndex: number, endIndex: number) => {
      if (endIndex <= startIndex + 1) return;

      let maxDistance = 0;
      let maxIndex = startIndex;
      const start = [points[startIndex].latitude, points[startIndex].longitude] as [number, number];
      const end = [points[endIndex].latitude, points[endIndex].longitude] as [number, number];

      for (let i = startIndex + 1; i < endIndex; i++) {
        const current = [points[i].latitude, points[i].longitude] as [number, number];
        const distance = this.perpendicularDistance(current, start, end);
        if (distance > maxDistance) {
          maxDistance = distance;
          maxIndex = i;
        }
      }

      if (maxDistance > toleranceMeters) {
        keep[maxIndex] = true;
        simplifyRange(startIndex, maxIndex);
        simplifyRange(maxIndex, endIndex);
      }
    };

    simplifyRange(0, points.length - 1);
    return points.filter((_, index) => keep[index]);
  }

  /**
   * Main entry point: calculate timeline and upsert summary
   */
  async calculateAndUpsertSummary(attendanceId: string): Promise<void> {
    const config = this.configService.get('geoTracking', {
      poorAccuracyThresholdMeters: 50,
      maxSpeedMps: 70,
      stopRadiusMeters: 50,
      stopDurationSeconds: 300,
      gapDurationSeconds: 300,
    });

    // Step 1: Load data
    const { attendance, points } = await this.loadData(attendanceId);

    // Step 2: Sort points
    const sortedPoints = this.sortPoints(points);

    // Step 3: Deduplicate
    const deduplicatedPoints = this.deduplicatePoints(sortedPoints);

    // Step 4: Filter invalid coordinates
    const validPoints = this.filterInvalidCoordinates(deduplicatedPoints);

    // Step 5: Recheck quality
    let processedPoints = this.recheckQuality(
      validPoints,
      config.poorAccuracyThresholdMeters,
    );

    // Step 6: Detect impossible jumps
    const {
      points: pointsWithJumpsDetected,
      impossibleJumpSegments,
      anomalies: jumpAnomalies,
    } = this.detectImpossibleJumps(processedPoints, config.maxSpeedMps);
    processedPoints = pointsWithJumpsDetected;

    // Step 7: Calculate distances
    const { rawDistanceMeters, processedDistanceMeters } =
      this.calculateDistances(processedPoints, impossibleJumpSegments);

    // Step 8: Detect stops
    const stops = this.detectStops(
      processedPoints,
      config.stopRadiusMeters,
      config.stopDurationSeconds,
    );

    // Step 10: Detect data gaps
    const { anomalies: dataGaps, pointsWithEstimatedFlag } =
      this.detectDataGaps(processedPoints, config.gapDurationSeconds);
    processedPoints = pointsWithEstimatedFlag;

    // Step 11: Calculate aggregate totals
    const totals = this.calculateAggregateTotals(
      attendance,
      processedPoints,
      dataGaps,
      stops,
    );

    // Step 12: Build timeline events
    const timelineEvents = this.buildTimelineEvents(attendance, stops);

    // Build anomalies array (DATA_GAP + IMPOSSIBLE_JUMP if any)
    const anomalies: Anomaly[] = [...dataGaps, ...jumpAnomalies].sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime(),
    );

    // Step 13: Build encoded polylines
    const goodPointsOnly = processedPoints.filter(
      (p) => p.quality === PointQuality.GOOD,
    );
    const smoothedGoodPoints = this.simplifyPoints(goodPointsOnly, 8);
    const { encodedRawPolyline, encodedProcessedPolyline } =
      this.buildEncodedPolylines(processedPoints, smoothedGoodPoints);

    // Step 14: Upsert summary
    const updatedSummary =
      await this.attendanceTimelineSummaryModel.findOneAndUpdate(
        { attendanceId },
        {
          $set: {
            companyId: attendance.companyId,
            employeeId: attendance.employeeId,
            attendanceId,
            attendanceDate: attendance.attendanceDate,
            rawDistanceMeters,
            processedDistanceMeters,
            workingSeconds: totals.workingSeconds,
            breakSeconds: totals.breakSeconds,
            movingSeconds: totals.movingSeconds,
            holdSeconds: totals.holdSeconds,
            dataGapSeconds: totals.dataGapSeconds,
            gpsQualityScore: totals.gpsQualityScore,
            encodedRawPolyline,
            encodedProcessedPolyline,
            timelineEvents,
            anomalies,
            lastComputedAt: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after' },
      );

    // Broadcast timeline recomputed
    this.locationBroadcastService.broadcastTimelineRecomputed(attendanceId, {
      attendanceId,
      employeeId: attendance.employeeId,
      lastComputedAt: new Date(),
    });
  }
}
