import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { AttendanceDaily, AttendanceDailySchema } from './schemas/attendance-daily.schema';
import { LocationPoint, LocationPointSchema } from './schemas/location-point.schema';
import { EmployeeLiveLocation, EmployeeLiveLocationSchema } from './schemas/employee-live-location.schema';
import { AttendanceTimelineSummary, AttendanceTimelineSummarySchema } from './schemas/attendance-timeline-summary.schema';
import { Employee, EmployeeSchema } from './schemas/employee.schema';
import { GeoTrackingController } from './geo-tracking.controller';
import { CrmController } from './crm.controller';
import { AuthController } from './auth.controller';
import { GeoTrackingService } from './geo-tracking.service';
import { AuthService } from './auth.service';
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
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
    MongooseModule.forFeature([
      { name: AttendanceDaily.name, schema: AttendanceDailySchema },
      { name: LocationPoint.name, schema: LocationPointSchema },
      { name: EmployeeLiveLocation.name, schema: EmployeeLiveLocationSchema },
      { name: AttendanceTimelineSummary.name, schema: AttendanceTimelineSummarySchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [GeoTrackingController, CrmController, AuthController],
  providers: [
    GeoTrackingService,
    AuthService,
    TimelineCalculatorService,
    LocationWebSocketGateway,
    LocationBroadcastService,
    {
      provide: TimelineRebuildQueue,
      useClass: InlineTimelineRebuildQueue,
    },
  ],
})
export class GeoTrackingModule {}
