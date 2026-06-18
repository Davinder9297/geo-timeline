import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';
import { GeoTrackingService } from './geo-tracking.service';
import { JwtAuthGuard, AuthenticatedUser } from './guards/jwt-auth.guard';
import { BatchLocationPointsDto } from './dto/batch-location-points.dto';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Controller('api/v1/mobile/attendance')
@UseGuards(JwtAuthGuard)
export class GeoTrackingController {
  constructor(private readonly geoTrackingService: GeoTrackingService) {}

  @Get()
  async getAttendances(@Request() req: RequestWithUser) {
    const data = await this.geoTrackingService.getEmployeeAttendances(req.user);
    return { success: true, data };
  }

  @Post()
  async createAttendance(@Request() req: RequestWithUser) {
    const data = await this.geoTrackingService.createAttendance(req.user);
    return { success: true, data };
  }

  @Post(':attendanceId/checkout')
  async checkOutAttendance(
    @Param('attendanceId') attendanceId: string,
    @Request() req: RequestWithUser,
  ) {
    await this.geoTrackingService.checkOutAttendance(attendanceId, req.user);
    return { success: true };
  }

  @Post(':attendanceId/location/start')
  async startTracking(
    @Param('attendanceId') attendanceId: string,
    @Request() req: RequestWithUser,
  ) {
    const data = await this.geoTrackingService.getTrackingConfig(
      attendanceId,
      req.user,
    );
    return {
      success: true,
      data,
    };
  }

  @Post(':attendanceId/location-points/batch')
  async batchLocationPoints(
    @Param('attendanceId') attendanceId: string,
    @Body() batchDto: BatchLocationPointsDto,
    @Request() req: RequestWithUser,
  ) {
    const data = await this.geoTrackingService.batchInsertLocationPoints(
      attendanceId,
      batchDto.deviceId,
      batchDto.points,
      req.user,
    );
    return {
      success: true,
      data,
    };
  }

  @Post(':attendanceId/location/stop')
  async stopTracking(
    @Param('attendanceId') attendanceId: string,
    @Request() req: RequestWithUser,
  ) {
    await this.geoTrackingService.stopTracking(attendanceId, req.user);
    return {
      success: true,
      data: null,
    };
  }
}
