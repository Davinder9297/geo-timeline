import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class LocationBroadcastService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  broadcastEmployeeLocationUpdate(
    companyId: string,
    employeeId: string,
    data: any,
  ) {
    if (!this.server) return;
    this.server
      .to(`company:${companyId}`)
      .to(`employee:${employeeId}`)
      .emit('employee:location:update', data);
  }

  broadcastEmployeeStatusUpdate(
    companyId: string,
    employeeId: string,
    data: any,
  ) {
    if (!this.server) return;
    this.server
      .to(`company:${companyId}`)
      .to(`employee:${employeeId}`)
      .emit('employee:status:update', data);
  }

  broadcastTimelineRecomputed(attendanceId: string, data: any) {
    if (!this.server) return;
    this.server.to(`attendance:${attendanceId}`).emit('timeline:recomputed', data);
  }
}
