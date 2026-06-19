import { NestFactory } from '@nestjs/core';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Model } from 'mongoose';
import {
  AttendanceDaily,
  AttendanceDailySchema,
} from './geo-tracking/schemas/attendance-daily.schema';
import {
  LocationPoint,
  LocationPointSchema,
} from './geo-tracking/schemas/location-point.schema';
import {
  EmployeeLiveLocation,
  EmployeeLiveLocationSchema,
} from './geo-tracking/schemas/employee-live-location.schema';
import {
  AttendanceTimelineSummary,
  AttendanceTimelineSummarySchema,
} from './geo-tracking/schemas/attendance-timeline-summary.schema';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost/geo-timeline',
    ),
    MongooseModule.forFeature([
      { name: AttendanceDaily.name, schema: AttendanceDailySchema },
      { name: LocationPoint.name, schema: LocationPointSchema },
      { name: EmployeeLiveLocation.name, schema: EmployeeLiveLocationSchema },
      {
        name: AttendanceTimelineSummary.name,
        schema: AttendanceTimelineSummarySchema,
      },
    ]),
  ],
})
class ClearDbModule {}

async function clearDb() {
  const app = await NestFactory.createApplicationContext(ClearDbModule);
  const attendanceDailyModel = app.get<Model<AttendanceDaily>>(
    getModelToken(AttendanceDaily.name),
  );
  const locationPointModel = app.get<Model<LocationPoint>>(
    getModelToken(LocationPoint.name),
  );
  const employeeLiveLocationModel = app.get<Model<EmployeeLiveLocation>>(
    getModelToken(EmployeeLiveLocation.name),
  );
  const attendanceTimelineSummaryModel = app.get<Model<AttendanceTimelineSummary>>(
    getModelToken(AttendanceTimelineSummary.name),
  );

  console.log('Clearing all collections except Employee...\n');

  try {
    // Clear AttendanceDaily
    const attendanceResult = await attendanceDailyModel.deleteMany({});
    console.log(`✓ Cleared AttendanceDaily: ${attendanceResult.deletedCount} documents`);

    // Clear LocationPoint
    const locationPointResult = await locationPointModel.deleteMany({});
    console.log(`✓ Cleared LocationPoint: ${locationPointResult.deletedCount} documents`);

    // Clear EmployeeLiveLocation
    const liveLocationResult = await employeeLiveLocationModel.deleteMany({});
    console.log(`✓ Cleared EmployeeLiveLocation: ${liveLocationResult.deletedCount} documents`);

    // Clear AttendanceTimelineSummary
    const timelineSummaryResult = await attendanceTimelineSummaryModel.deleteMany({});
    console.log(`✓ Cleared AttendanceTimelineSummary: ${timelineSummaryResult.deletedCount} documents`);

    console.log('\n✓ All collections cleared except Employee!\n');
  } catch (error) {
    console.error('✗ Error clearing collections:', (error as Error).message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

clearDb();
