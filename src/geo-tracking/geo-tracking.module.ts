import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceDaily, AttendanceDailySchema } from './schemas/attendance-daily.schema';
import { LocationPoint, LocationPointSchema } from './schemas/location-point.schema';
import { EmployeeLiveLocation, EmployeeLiveLocationSchema } from './schemas/employee-live-location.schema';
import { AttendanceTimelineSummary, AttendanceTimelineSummarySchema } from './schemas/attendance-timeline-summary.schema';
import { Employee, EmployeeSchema } from './schemas/employee.schema';
import { GeoTrackingController } from './geo-tracking.controller';
import { CrmController } from './crm.controller';
import { GeoTrackingService } from './geo-tracking.service';
import { TimelineCalculatorService } from './timeline-calculator.service';
import { LocationWebSocketGateway } from './location.gateway';
import { LocationBroadcastService } from './location-broadcast.service';
import { StaleDetectionService } from './stale-detection.service';
import geoTrackingConfig from './geo-tracking.config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CompanyIsolationGuard } from './guards/company-isolation.guard';
import { TimelineRebuildQueue, InlineTimelineRebuildQueue } from './queues/timeline-rebuild.queue';

@Module({
  imports: [
    ConfigModule.forFeature(geoTrackingConfig),
    MongooseModule.forFeature([
      { name: AttendanceDaily.name, schema: AttendanceDailySchema },
      { name: LocationPoint.name, schema: LocationPointSchema },
      { name: EmployeeLiveLocation.name, schema: EmployeeLiveLocationSchema },
      { name: AttendanceTimelineSummary.name, schema: AttendanceTimelineSummarySchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [GeoTrackingController, CrmController],
  providers: [
    GeoTrackingService,
    TimelineCalculatorService,
    LocationWebSocketGateway,
    LocationBroadcastService,
    StaleDetectionService,
    JwtAuthGuard,
    CompanyIsolationGuard,
    {
      provide: TimelineRebuildQueue,
      useClass: InlineTimelineRebuildQueue,
    },
  ],
})
export class GeoTrackingModule {}
