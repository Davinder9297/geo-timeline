import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { GeoTrackingService } from '../geo-tracking.service';
import {
  AttendanceDaily,
  AttendanceStatus,
} from '../schemas/attendance-daily.schema';
import { LocationPoint, PointQuality } from '../schemas/location-point.schema';
import {
  EmployeeLiveLocation,
  LiveLocationStatus,
} from '../schemas/employee-live-location.schema';
import { TimelineRebuildQueue } from '../queues/timeline-rebuild.queue';
import { AuthenticatedUser } from '../guards/jwt-auth.guard';
import { mock, MockProxy } from 'jest-mock-extended';
import { Model } from 'mongoose';

describe('GeoTrackingService', () => {
  let service: GeoTrackingService;
  let attendanceDailyModel: MockProxy<Model<AttendanceDaily>>;
  let locationPointModel: MockProxy<Model<LocationPoint>>;
  let employeeLiveLocationModel: MockProxy<Model<EmployeeLiveLocation>>;
  let configService: MockProxy<ConfigService>;
  let timelineRebuildQueue: MockProxy<TimelineRebuildQueue>;

  const user: AuthenticatedUser = {
    employeeId: 'emp-1',
    companyId: 'comp-1',
    role: 'EMPLOYEE',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoTrackingService,
        {
          provide: getModelToken(AttendanceDaily.name),
          useValue: mock<Model<AttendanceDaily>>(),
        },
        {
          provide: getModelToken(LocationPoint.name),
          useValue: mock<Model<LocationPoint>>(),
        },
        {
          provide: getModelToken(EmployeeLiveLocation.name),
          useValue: mock<Model<EmployeeLiveLocation>>(),
        },
        {
          provide: ConfigService,
          useValue: mock<ConfigService>(),
        },
        {
          provide: TimelineRebuildQueue,
          useValue: mock<TimelineRebuildQueue>(),
        },
      ],
    }).compile();

    service = module.get<GeoTrackingService>(GeoTrackingService);
    attendanceDailyModel = module.get(getModelToken(AttendanceDaily.name));
    locationPointModel = module.get(getModelToken(LocationPoint.name));
    employeeLiveLocationModel = module.get(
      getModelToken(EmployeeLiveLocation.name),
    );
    configService = module.get(ConfigService);
    timelineRebuildQueue = module.get(TimelineRebuildQueue);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('batchInsertLocationPoints - duplicate detection', () => {
    it('should mark points as duplicate if clientPointId exists', async () => {
      const mockAttendance = {
        _id: 'att-1',
        employeeId: 'emp-1',
        companyId: 'comp-1',
        status: AttendanceStatus.WORKING,
        sessions: [{ sessionId: 'ses-1' }],
      } as AttendanceDaily;

      attendanceDailyModel.findById.mockResolvedValue(mockAttendance);
      configService.get.mockImplementation((key) => {
        if (key === 'geoTracking.maxBatchSize') return 200;
        if (key === 'geoTracking.poorAccuracyThresholdMeters') return 50;
        return {};
      });

      locationPointModel.find
        .mockResolvedValueOnce([{ clientPointId: 'cp-1' }] as any)
        .mockResolvedValueOnce([]);
      locationPointModel.insertMany.mockResolvedValue([]);

      const result = await service.batchInsertLocationPoints(
        'att-1',
        'dev-1',
        [
          {
            clientPointId: 'cp-1',
            sequenceNo: 1,
            capturedAt: new Date().toISOString(),
            latitude: 40.7128,
            longitude: -74.006,
            accuracyM: 10,
            speedMps: 0,
            heading: 0,
            batteryPercent: 100,
            networkType: 'wifi',
            appState: 'FOREGROUND' as any,
            isMocked: false,
          },
        ],
        user,
      );

      expect(result.duplicates).toBe(1);
      expect(result.accepted).toBe(0);
    });

    it('should mark points as duplicate if deviceId + sequenceNo exists for the same attendance', async () => {
      const mockAttendance = {
        _id: 'att-1',
        employeeId: 'emp-1',
        companyId: 'comp-1',
        status: AttendanceStatus.WORKING,
        sessions: [{ sessionId: 'ses-1' }],
      } as AttendanceDaily;

      attendanceDailyModel.findById.mockResolvedValue(mockAttendance);
      configService.get.mockImplementation((key) => {
        if (key === 'geoTracking.maxBatchSize') return 200;
        if (key === 'geoTracking.poorAccuracyThresholdMeters') return 50;
        return {};
      });

      locationPointModel.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ deviceId: 'dev-1', sequenceNo: 1 }] as any);
      locationPointModel.insertMany.mockResolvedValue([]);

      const result = await service.batchInsertLocationPoints(
        'att-1',
        'dev-1',
        [
          {
            clientPointId: 'cp-2',
            sequenceNo: 1,
            capturedAt: new Date().toISOString(),
            latitude: 40.7128,
            longitude: -74.006,
            accuracyM: 10,
            speedMps: 0,
            heading: 0,
            batteryPercent: 100,
            networkType: 'wifi',
            appState: 'FOREGROUND' as any,
            isMocked: false,
          },
        ],
        user,
      );

      expect(result.duplicates).toBe(1);
      expect(result.accepted).toBe(0);
    });

    it('should accept same deviceId + sequenceNo on different attendance', async () => {
      const mockAttendance = {
        _id: 'att-2',
        employeeId: 'emp-1',
        companyId: 'comp-1',
        status: AttendanceStatus.WORKING,
        sessions: [{ sessionId: 'ses-1' }],
      } as AttendanceDaily;

      attendanceDailyModel.findById.mockResolvedValue(mockAttendance);
      configService.get.mockImplementation((key) => {
        if (key === 'geoTracking.maxBatchSize') return 200;
        if (key === 'geoTracking.poorAccuracyThresholdMeters') return 50;
        return {};
      });

      locationPointModel.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      locationPointModel.insertMany.mockResolvedValue([]);

      const result = await service.batchInsertLocationPoints(
        'att-2',
        'dev-1',
        [
          {
            clientPointId: 'cp-2',
            sequenceNo: 1,
            capturedAt: new Date().toISOString(),
            latitude: 40.7128,
            longitude: -74.006,
            accuracyM: 10,
            speedMps: 0,
            heading: 0,
            batteryPercent: 100,
            networkType: 'wifi',
            appState: 'FOREGROUND' as any,
            isMocked: false,
          },
        ],
        user,
      );

      expect(result.duplicates).toBe(0);
      expect(result.accepted).toBe(1);
    });
  });

  describe('batchInsertLocationPoints - invalid coordinates', () => {
    it('should reject points with invalid latitude', async () => {
      const mockAttendance = {
        _id: 'att-1',
        employeeId: 'emp-1',
        companyId: 'comp-1',
        status: AttendanceStatus.WORKING,
        sessions: [{ sessionId: 'ses-1' }],
      } as AttendanceDaily;

      attendanceDailyModel.findById.mockResolvedValue(mockAttendance);
      configService.get.mockImplementation((key) => {
        if (key === 'geoTracking.maxBatchSize') return 200;
        if (key === 'geoTracking.poorAccuracyThresholdMeters') return 50;
        return {};
      });

      locationPointModel.find.mockResolvedValue([]).mockResolvedValue([]);
      locationPointModel.insertMany.mockResolvedValue([]);

      const result = await service.batchInsertLocationPoints(
        'att-1',
        'dev-1',
        [
          {
            clientPointId: 'cp-3',
            sequenceNo: 2,
            capturedAt: new Date().toISOString(),
            latitude: 100, // invalid
            longitude: -74.006,
            accuracyM: 10,
            speedMps: 0,
            heading: 0,
            batteryPercent: 100,
            networkType: 'wifi',
            appState: 'FOREGROUND' as any,
            isMocked: false,
          },
        ],
        user,
      );

      expect(result.rejected).toBe(1);
    });
  });

  describe('batchInsertLocationPoints - live location update', () => {
    it('should only update live location if point is newer', async () => {
      const olderDate = new Date('2024-01-01T00:00:00Z');
      const newerDate = new Date('2024-01-01T00:01:00Z');

      const mockAttendance = {
        _id: 'att-1',
        employeeId: 'emp-1',
        companyId: 'comp-1',
        status: AttendanceStatus.WORKING,
        sessions: [{ sessionId: 'ses-1' }],
      } as AttendanceDaily;

      attendanceDailyModel.findById.mockResolvedValue(mockAttendance);
      configService.get.mockImplementation((key) => {
        if (key === 'geoTracking.maxBatchSize') return 200;
        if (key === 'geoTracking.poorAccuracyThresholdMeters') return 50;
        return {};
      });

      locationPointModel.find.mockResolvedValue([]).mockResolvedValue([]);
      locationPointModel.insertMany.mockResolvedValue([{ _id: 'lp-1' }] as any);

      employeeLiveLocationModel.findOne.mockResolvedValue({
        capturedAt: olderDate,
      } as EmployeeLiveLocation);

      await service.batchInsertLocationPoints(
        'att-1',
        'dev-1',
        [
          {
            clientPointId: 'cp-4',
            sequenceNo: 3,
            capturedAt: newerDate.toISOString(),
            latitude: 40.7128,
            longitude: -74.006,
            accuracyM: 10,
            speedMps: 0,
            heading: 0,
            batteryPercent: 100,
            networkType: 'wifi',
            appState: 'FOREGROUND' as any,
            isMocked: false,
          },
        ],
        user,
      );

      expect(employeeLiveLocationModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it('should NOT update live location if point is older', async () => {
      const olderDate = new Date('2024-01-01T00:00:00Z');
      const newerDate = new Date('2024-01-01T00:01:00Z');

      const mockAttendance = {
        _id: 'att-1',
        employeeId: 'emp-1',
        companyId: 'comp-1',
        status: AttendanceStatus.WORKING,
        sessions: [{ sessionId: 'ses-1' }],
      } as AttendanceDaily;

      attendanceDailyModel.findById.mockResolvedValue(mockAttendance);
      configService.get.mockImplementation((key) => {
        if (key === 'geoTracking.maxBatchSize') return 200;
        if (key === 'geoTracking.poorAccuracyThresholdMeters') return 50;
        return {};
      });

      locationPointModel.find.mockResolvedValue([]).mockResolvedValue([]);
      locationPointModel.insertMany.mockResolvedValue([{ _id: 'lp-2' }] as any);

      employeeLiveLocationModel.findOne.mockResolvedValue({
        capturedAt: newerDate,
      } as EmployeeLiveLocation);

      await service.batchInsertLocationPoints(
        'att-1',
        'dev-1',
        [
          {
            clientPointId: 'cp-5',
            sequenceNo: 4,
            capturedAt: olderDate.toISOString(),
            latitude: 40.7128,
            longitude: -74.006,
            accuracyM: 10,
            speedMps: 0,
            heading: 0,
            batteryPercent: 100,
            networkType: 'wifi',
            appState: 'FOREGROUND' as any,
            isMocked: false,
          },
        ],
        user,
      );

      expect(employeeLiveLocationModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('batchInsertLocationPoints - batch size limit', () => {
    it('should reject batch if size exceeds limit', async () => {
      configService.get.mockImplementation((key) => {
        if (key === 'geoTracking.maxBatchSize') return 2;
        return {};
      });

      await expect(
        service.batchInsertLocationPoints(
          'att-1',
          'dev-1',
          [{}, {}, {}] as any,
          user,
        ),
      ).rejects.toThrowError();
    });
  });
});
