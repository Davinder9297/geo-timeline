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
import { JwtService } from '@nestjs/jwt';
import { GeoTrackingService } from './geo-tracking.service';
import { LocationBroadcastService } from './location-broadcast.service';
import { AuthenticatedUser } from './guards/jwt-auth.guard';
import { UserRole } from './schemas/employee.schema';

@WebSocketGateway({ namespace: '/ws/location', cors: true })
export class LocationWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly geoTrackingService: GeoTrackingService,
    private readonly locationBroadcastService: LocationBroadcastService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit() {
    this.locationBroadcastService.setServer(this.server);
  }

  handleConnection(client: Socket) {
    const token = this.extractToken(client);

    if (!token) {
      client.emit('location:error', { error: 'Authentication token required' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
      });
      (client as any).user = {
        employeeId: payload.employeeId,
        companyId: payload.companyId,
        role: payload.role,
      } as AuthenticatedUser;
    } catch {
      client.emit('location:error', { error: 'Invalid or expired token' });
      client.disconnect(true);
      return;
    }

    console.log('Client connected', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected', client.id);
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;

    const headerToken = client.handshake.headers?.authorization;
    if (typeof headerToken === 'string') {
      const [type, token] = headerToken.split(' ');
      if (type === 'Bearer' && token) return token;
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') return queryToken;

    return undefined;
  }

  private getUser(client: Socket): AuthenticatedUser | undefined {
    return (client as any).user as AuthenticatedUser | undefined;
  }

  @SubscribeMessage('location:point')
  async handleLocationPoint(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const user = this.getUser(client);
    if (!user) {
      client.emit('location:error', { error: 'Not authenticated' });
      return;
    }
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
  async handleLocationBatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: any,
  ) {
    const user = this.getUser(client);
    if (!user) {
      client.emit('location:error', { error: 'Not authenticated' });
      return;
    }
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
  async handleCompanySubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { companyId: string },
  ) {
    const user = this.getUser(client);
    if (!user) {
      client.emit('location:error', { error: 'Not authenticated' });
      return;
    }
    if (user.companyId !== body.companyId) {
      client.emit('location:error', {
        error: 'Cross-company access forbidden',
      });
      return;
    }
    await client.join(`company:${body.companyId}`);
    client.emit('location:ack', { success: true });
  }

  @SubscribeMessage('employee:timeline:subscribe')
  async handleTimelineSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { employeeId: string; attendanceId: string },
  ) {
    const user = this.getUser(client);
    if (!user) {
      client.emit('location:error', { error: 'Not authenticated' });
      return;
    }
    const isSelf = user.employeeId === body.employeeId;
    const isManager = [UserRole.MANAGER, UserRole.ADMIN].includes(user.role);

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
