import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { TimelineCalculatorService } from '../timeline-calculator.service';
import {
  AttendanceDaily,
  AttendanceStatus,
} from '../schemas/attendance-daily.schema';
import {
  LocationPoint,
  PointQuality,
  AppState,
} from '../schemas/location-point.schema';
import { AttendanceTimelineSummary } from '../schemas/attendance-timeline-summary.schema';
import { mock, MockProxy } from 'jest-mock-extended';
import { Model } from 'mongoose';

describe('TimelineCalculatorService', () => {
  let service: TimelineCalculatorService;
  let attendanceDailyModel: MockProxy<Model<AttendanceDaily>>;
  let locationPointModel: MockProxy<Model<LocationPoint>>;
  let attendanceTimelineSummaryModel: MockProxy<
    Model<AttendanceTimelineSummary>
  >;
  let configService: MockProxy<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelineCalculatorService,
        {
          provide: getModelToken(AttendanceDaily.name),
          useValue: mock<Model<AttendanceDaily>>(),
        },
        {
          provide: getModelToken(LocationPoint.name),
          useValue: mock<Model<LocationPoint>>(),
        },
        {
          provide: getModelToken(AttendanceTimelineSummary.name),
          useValue: mock<Model<AttendanceTimelineSummary>>(),
        },
        {
          provide: ConfigService,
          useValue: mock<ConfigService>(),
        },
      ],
    }).compile();

    service = module.get<TimelineCalculatorService>(TimelineCalculatorService);
    attendanceDailyModel = module.get(getModelToken(AttendanceDaily.name));
    locationPointModel = module.get(getModelToken(LocationPoint.name));
    attendanceTimelineSummaryModel = module.get(
      getModelToken(AttendanceTimelineSummary.name),
    );
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('haversineDistance', () => {
    it('should calculate correct distance between New York and London', () => {
      // NYC: 40.7128° N, 74.0060° W
      // London: 51.5074° N, 0.1278° W
      const distance = (service as any).haversineDistance(
        40.7128,
        -74.006,
        51.5074,
        -0.1278,
      );
      // Expected ~5585000 meters
      expect(distance).toBeGreaterThan(5.5e6);
      expect(distance).toBeLessThan(5.7e6);
    });

    it('should return 0 for same coordinates', () => {
      const distance = (service as any).haversineDistance(
        40.7128,
        -74.006,
        40.7128,
        -74.006,
      );
      expect(distance).toBeCloseTo(0, 1);
    });
  });

  describe('deduplicatePoints', () => {
    it('should deduplicate by clientPointId', () => {
      const points = [
        {
          clientPointId: 'cp1',
          deviceId: 'd1',
          sequenceNo: 1,
          capturedAt: new Date(),
          location: { type: 'Point', coordinates: [-74, 40] },
        },
        {
          clientPointId: 'cp1',
          deviceId: 'd1',
          sequenceNo: 2,
          capturedAt: new Date(),
          location: { type: 'Point', coordinates: [-74, 40] },
        },
      ] as LocationPoint[];

      const result = (service as any).deduplicatePoints(points);
      expect(result.length).toBe(1);
      expect(result[0].clientPointId).toBe('cp1');
    });

    it('should deduplicate by deviceId + sequenceNo', () => {
      const points = [
        {
          clientPointId: 'cp1',
          deviceId: 'd1',
          sequenceNo: 1,
          capturedAt: new Date(),
          location: { type: 'Point', coordinates: [-74, 40] },
        },
        {
          clientPointId: 'cp2',
          deviceId: 'd1',
          sequenceNo: 1,
          capturedAt: new Date(),
          location: { type: 'Point', coordinates: [-74, 40] },
        },
      ] as LocationPoint[];

      const result = (service as any).deduplicatePoints(points);
      expect(result.length).toBe(1);
    });
  });

  describe('sortPoints', () => {
    it('should sort points by capturedAt ascending even if input is unsorted', () => {
      const point1 = {
        capturedAt: new Date('2024-01-01T10:00:00Z'),
      } as LocationPoint;
      const point2 = {
        capturedAt: new Date('2024-01-01T10:01:00Z'),
      } as LocationPoint;
      const point3 = {
        capturedAt: new Date('2024-01-01T10:02:00Z'),
      } as LocationPoint;
      const unsorted = [point3, point1, point2];
      const sorted = (service as any).sortPoints(unsorted);
      expect(sorted).toEqual([point1, point2, point3]);
    });
  });
});
