import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { GeoTrackingService } from './geo-tracking.service';
import { LocationBroadcastService } from './location-broadcast.service';
import { AuthenticatedUser } from './guards/jwt-auth.guard';

// Stub JWT guard for WS connections
const WsJwtAuthGuard = () => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = function (client: Socket, ...args: any[]) {
      // Stub: attach a mock user to the client
      (client as any).user = {
        employeeId: 'test-employee-id',
        companyId: 'test-company-id',
        role: 'manager',
      } as AuthenticatedUser;
      return originalMethod.apply(this, [client, ...args]);
    };
    return descriptor;
  };
};

@WebSocketGateway({ namespace: '/ws/location', cors: true })
export class LocationWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly geoTrackingService: GeoTrackingService,
    private readonly locationBroadcastService: LocationBroadcastService,
  ) {}

  afterInit() {
    this.locationBroadcastService.setServer(this.server);
  }

  handleConnection(client: Socket) {
    // Stub JWT validation here
    console.log('Client connected', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected', client.id);
  }

  @SubscribeMessage('location:point')
  @UseGuards(WsJwtAuthGuard())
  async handleLocationPoint(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const user = (client as any).user as AuthenticatedUser;
    try {
      // Wrap single point into a batch of 1
      await this.geoTrackingService.batchInsertLocationPoints(
        body.attendanceId,
        body.deviceId,
        [body.point],
        user,
      );
      client.emit('location:ack', { success: true });
    } catch (error) {
      client.emit('location:error', { error: error.message });
    }
  }

  @SubscribeMessage('location:batch')
  @UseGuards(WsJwtAuthGuard())
  async handleLocationBatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const user = (client as any).user as AuthenticatedUser;
    try {
      await this.geoTrackingService.batchInsertLocationPoints(
        body.attendanceId,
        body.deviceId,
        body.points,
        user,
      );
      client.emit('location:ack', { success: true });
    } catch (error) {
      client.emit('location:error', { error: error.message });
    }
  }

  @SubscribeMessage('company:subscribe')
  @UseGuards(WsJwtAuthGuard())
  async handleCompanySubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { companyId: string },
  ) {
    const user = (client as any).user as AuthenticatedUser;
    if (user.companyId !== body.companyId) {
      client.emit('location:error', { error: 'Cross-company access forbidden' });
      return;
    }
    await client.join(`company:${body.companyId}`);
    client.emit('location:ack', { success: true });
  }

  @SubscribeMessage('employee:timeline:subscribe')
  @UseGuards(WsJwtAuthGuard())
  async handleTimelineSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { employeeId: string; attendanceId: string },
  ) {
    const user = (client as any).user as AuthenticatedUser;
    const isSelf = user.employeeId === body.employeeId;
    const isManager = ['manager', 'admin'].includes(user.role);

    if (!isSelf && !isManager) {
      client.emit('location:error', {
        error: 'Not authorized to subscribe to this timeline',
      });
      return;
    }
    await client.join(`attendance:${body.attendanceId}`);
    client.emit('location:ack', { success: true });
  }
}
