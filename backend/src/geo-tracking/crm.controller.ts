import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GeoTrackingService } from './geo-tracking.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CompanyIsolationGuard } from './guards/company-isolation.guard';
import { LiveLocationStatus } from './schemas/employee-live-location.schema';

@Controller('api/v1/companies/:companyId')
@UseGuards(JwtAuthGuard, CompanyIsolationGuard)
export class CrmController {
  constructor(private readonly geoTrackingService: GeoTrackingService) {}

  @Get('geo/live-employees')
  async getLiveEmployees(
    @Param('companyId') companyId: string,
    @Query('status') status?: LiveLocationStatus,
  ) {
    const data = await this.geoTrackingService.getLiveEmployees(
      companyId,
      status,
    );
    return {
      success: true,
      data,
    };
  }

  @Get('employees/:employeeId/geo-timeline')
  async getEmployeeGeoTimeline(
    @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string,
    @Query('date') date: string,
  ) {
    const data = await this.geoTrackingService.getEmployeeGeoTimeline(
      companyId,
      employeeId,
      date,
    );
    return {
      success: true,
      data,
    };
  }

  @Post('attendance/:attendanceId/geo-timeline/rebuild')
  @HttpCode(HttpStatus.ACCEPTED)
  async rebuildGeoTimeline(
    @Param('companyId') companyId: string,
    @Param('attendanceId') attendanceId: string,
  ) {
    await this.geoTrackingService.rebuildGeoTimeline(companyId, attendanceId);
    return {
      success: true,
      data: { queued: true },
    };
  }
}
