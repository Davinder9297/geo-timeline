import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { GeoTrackingService } from './geo-tracking.service';
import { JwtAuthGuard, AuthenticatedUser } from './guards/jwt-auth.guard';
import { BatchLocationPointsDto } from './dto/batch-location-points.dto';

interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Controller('api/v1/mobile/attendance/:attendanceId')
@UseGuards(JwtAuthGuard)
export class GeoTrackingController {
  constructor(private readonly geoTrackingService: GeoTrackingService) {}

  @Post('location/start')
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

  @Post('location-points/batch')
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

  @Post('location/stop')
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
