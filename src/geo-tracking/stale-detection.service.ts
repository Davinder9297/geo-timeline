import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { EmployeeLiveLocation } from './schemas/employee-live-location.schema';
import { LocationBroadcastService } from './location-broadcast.service';

@Injectable()
export class StaleDetectionService implements OnModuleInit, OnModuleDestroy {
  private intervalId: any = null;

  constructor(
    @InjectModel(EmployeeLiveLocation.name)
    private readonly employeeLiveLocationModel: Model<EmployeeLiveLocation>,
    private readonly configService: ConfigService,
    private readonly locationBroadcastService: LocationBroadcastService,
  ) {}

  onModuleInit() {
    // Check every 30 seconds
    this.intervalId = setInterval(() => this.checkForStaleEmployees(), 30000);
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private async checkForStaleEmployees() {
    const staleThresholdMinutes = this.configService.get<number>(
      'geoTracking.staleThresholdMinutes',
      5,
    );
    const staleThresholdMs = staleThresholdMinutes * 60 * 1000;
    const now = new Date();

    // Find employees who are not yet marked stale but should be
    const employeesToUpdate = await this.employeeLiveLocationModel.find({
      isStale: false,
      lastUpdatedAt: { $lt: new Date(now.getTime() - staleThresholdMs) },
    });

    for (const emp of employeesToUpdate) {
      await this.employeeLiveLocationModel.findByIdAndUpdate(emp._id, {
        $set: { isStale: true },
      });
      this.locationBroadcastService.broadcastEmployeeStatusUpdate(
        emp.companyId,
        emp.employeeId,
        {
          employeeId: emp.employeeId,
          isStale: true,
          status: emp.status,
        },
      );
    }
  }
}
