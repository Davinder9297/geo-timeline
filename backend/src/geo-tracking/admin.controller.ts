import { Controller, Post, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AttendanceDaily } from './schemas/attendance-daily.schema';
import { LocationPoint } from './schemas/location-point.schema';
import { EmployeeLiveLocation } from './schemas/employee-live-location.schema';
import { AttendanceTimelineSummary } from './schemas/attendance-timeline-summary.schema';

@Controller('api/v1/admin/test')
export class AdminController {
  constructor(
    @InjectModel(AttendanceDaily.name)
    private attendanceDailyModel: Model<AttendanceDaily>,
    @InjectModel(LocationPoint.name)
    private locationPointModel: Model<LocationPoint>,
    @InjectModel(EmployeeLiveLocation.name)
    private employeeLiveLocationModel: Model<EmployeeLiveLocation>,
    @InjectModel(AttendanceTimelineSummary.name)
    private attendanceTimelineSummaryModel: Model<AttendanceTimelineSummary>,
  ) {}

  @Post('clear-all-except-employees/:password')
  async clearAllExceptEmployees(
    @Param('password') password: string,
  ): Promise<{
    success: boolean;
    message: string;
    cleared: string[];
  }> {
    // Simple password protection for testing
    if (password !== 'test-clear-123') {
      return {
        success: false,
        message: 'Invalid password',
        cleared: [],
      };
    }

    try {
      const cleared: string[] = [];

      // Clear AttendanceDaily
      const attendanceResult = await this.attendanceDailyModel.deleteMany({});
      if (attendanceResult.deletedCount > 0) {
        cleared.push(`AttendanceDaily (${attendanceResult.deletedCount} documents)`);
      }

      // Clear LocationPoint
      const locationPointResult = await this.locationPointModel.deleteMany({});
      if (locationPointResult.deletedCount > 0) {
        cleared.push(`LocationPoint (${locationPointResult.deletedCount} documents)`);
      }

      // Clear EmployeeLiveLocation
      const liveLocationResult = await this.employeeLiveLocationModel.deleteMany({});
      if (liveLocationResult.deletedCount > 0) {
        cleared.push(`EmployeeLiveLocation (${liveLocationResult.deletedCount} documents)`);
      }

      // Clear AttendanceTimelineSummary
      const timelineSummaryResult = await this.attendanceTimelineSummaryModel.deleteMany({});
      if (timelineSummaryResult.deletedCount > 0) {
        cleared.push(`AttendanceTimelineSummary (${timelineSummaryResult.deletedCount} documents)`);
      }

      return {
        success: true,
        message: 'All collections cleared except Employee',
        cleared,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error clearing collections: ${(error as Error).message}`,
        cleared: [],
      };
    }
  }
}
