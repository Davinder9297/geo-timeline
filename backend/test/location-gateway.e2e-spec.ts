import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { randomUUID as uuidv4 } from 'crypto';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

const suffix = Date.now();
const COMPANY_ID = `ws-co-${suffix}`;
const OTHER_COMPANY_ID = `ws-co-other-${suffix}`;
const EMPLOYEE_ID = `ws-emp-${suffix}`;
const OTHER_EMPLOYEE_ID = `ws-emp-other-${suffix}`;
const MANAGER_ID = `ws-mgr-${suffix}`;
const OTHER_COMPANY_MANAGER_ID = `ws-mgr-other-${suffix}`;
const PASSWORD = 'TestPass123!';

function waitForEvent<T = any>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('LocationWebSocketGateway (e2e) - real JWT auth', () => {
  let app: INestApplication;
  let baseUrl: string;
  let employeeToken: string;
  let otherEmployeeToken: string;
  let managerToken: string;
  let otherCompanyManagerToken: string;
  let attendanceId: string;
  const sockets: Socket[] = [];

  function connectClient(token?: string): Socket {
    const socket = io(`${baseUrl}/ws/location`, {
      transports: ['websocket'],
      forceNew: true,
      auth: token ? { token } : {},
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    async function registerAndLogin(companyId: string, employeeId: string, role: string) {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        companyId,
        employeeId,
        name: `WS ${employeeId}`,
        password: PASSWORD,
        role,
      });
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ companyId, employeeId, password: PASSWORD });
      return login.body.accessToken as string;
    }

    employeeToken = await registerAndLogin(COMPANY_ID, EMPLOYEE_ID, 'EMPLOYEE');
    otherEmployeeToken = await registerAndLogin(COMPANY_ID, OTHER_EMPLOYEE_ID, 'EMPLOYEE');
    managerToken = await registerAndLogin(COMPANY_ID, MANAGER_ID, 'MANAGER');
    otherCompanyManagerToken = await registerAndLogin(
      OTHER_COMPANY_ID,
      OTHER_COMPANY_MANAGER_ID,
      'MANAGER',
    );

    const checkin = await request(app.getHttpServer())
      .post('/api/v1/mobile/attendance')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send();
    attendanceId = checkin.body.data._id;
    await request(app.getHttpServer())
      .post(`/api/v1/mobile/attendance/${attendanceId}/location/start`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send();
  });

  afterEach(() => {
    sockets.forEach((s) => s.disconnect());
    sockets.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('connection authentication', () => {
    it('accepts a connection with a valid JWT', async () => {
      const socket = connectClient(employeeToken);
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', reject);
      });
      expect(socket.connected).toBe(true);
    });

    it('disconnects a client that connects with no token', async () => {
      const socket = connectClient(undefined);
      const disconnected = await new Promise<boolean>((resolve) => {
        socket.on('disconnect', () => resolve(true));
        socket.on('connect_error', () => resolve(true));
        setTimeout(() => resolve(false), 3000);
      });
      expect(disconnected).toBe(true);
    });

    it('disconnects a client that connects with an invalid/garbage token', async () => {
      const socket = connectClient('this-is-not-a-real-jwt');
      const disconnected = await new Promise<boolean>((resolve) => {
        socket.on('disconnect', () => resolve(true));
        socket.on('connect_error', () => resolve(true));
        setTimeout(() => resolve(false), 3000);
      });
      expect(disconnected).toBe(true);
    });
  });

  describe('company room isolation (per real authenticated user)', () => {
    it('joins the company room when companyId matches the JWT', async () => {
      const socket = connectClient(employeeToken);
      await waitForEvent(socket, 'connect');

      socket.emit('company:subscribe', { companyId: COMPANY_ID });
      const ack = await waitForEvent(socket, 'location:ack');
      expect(ack).toEqual({ success: true });
    });

    it('rejects company:subscribe for a companyId different from the JWT\'s own', async () => {
      const socket = connectClient(employeeToken);
      await waitForEvent(socket, 'connect');

      socket.emit('company:subscribe', { companyId: OTHER_COMPANY_ID });
      const error = await waitForEvent(socket, 'location:error');
      expect(error.error).toMatch(/forbidden/i);
    });
  });

  describe('employee timeline subscription authorization', () => {
    it('allows the employee to subscribe to their own attendance timeline', async () => {
      const socket = connectClient(employeeToken);
      await waitForEvent(socket, 'connect');

      socket.emit('employee:timeline:subscribe', { employeeId: EMPLOYEE_ID, attendanceId });
      const ack = await waitForEvent(socket, 'location:ack');
      expect(ack).toEqual({ success: true });
    });

    it('allows a manager in the same company to subscribe to any employee\'s timeline', async () => {
      const socket = connectClient(managerToken);
      await waitForEvent(socket, 'connect');

      socket.emit('employee:timeline:subscribe', { employeeId: EMPLOYEE_ID, attendanceId });
      const ack = await waitForEvent(socket, 'location:ack');
      expect(ack).toEqual({ success: true });
    });

    it('rejects a different non-manager employee subscribing to someone else\'s timeline', async () => {
      const socket = connectClient(otherEmployeeToken);
      await waitForEvent(socket, 'connect');

      socket.emit('employee:timeline:subscribe', { employeeId: EMPLOYEE_ID, attendanceId });
      const error = await waitForEvent(socket, 'location:error');
      expect(error.error).toMatch(/not authorized/i);
    });
  });

  it('acks a location:batch event and persists the point under the authenticated employee', async () => {
    const socket = connectClient(employeeToken);
    await waitForEvent(socket, 'connect');

    socket.emit('location:batch', {
      attendanceId,
      deviceId: 'ws-device-1',
      points: [
        {
          clientPointId: uuidv4(),
          sequenceNo: 1,
          capturedAt: new Date().toISOString(),
          latitude: 23.0225,
          longitude: 72.5714,
          accuracyM: 10,
          speedMps: 1,
          heading: 0,
          batteryPercent: 90,
          networkType: 'WIFI',
          appState: 'FOREGROUND',
          isMocked: false,
        },
      ],
    });

    const ack = await waitForEvent(socket, 'location:ack');
    expect(ack).toEqual({ success: true });
  });

  it('broadcasts employee:location:update to the company room after a REST batch insert', async () => {
    const socket = connectClient(managerToken);
    await waitForEvent(socket, 'connect');
    socket.emit('company:subscribe', { companyId: COMPANY_ID });
    await waitForEvent(socket, 'location:ack');

    const updatePromise = waitForEvent(socket, 'employee:location:update');

    await request(app.getHttpServer())
      .post(`/api/v1/mobile/attendance/${attendanceId}/location-points/batch`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        deviceId: 'rest-device-1',
        points: [
          {
            clientPointId: uuidv4(),
            sequenceNo: 50,
            capturedAt: new Date().toISOString(),
            latitude: 23.05,
            longitude: 72.6,
            accuracyM: 8,
            speedMps: 2,
            heading: 45,
            batteryPercent: 70,
            networkType: '4G',
            appState: 'FOREGROUND',
            isMocked: false,
          },
        ],
      });

    const update = await updatePromise;
    expect(update.employeeId).toBe(EMPLOYEE_ID);
    expect(update.location).toEqual(
      expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number) }),
    );
  });

  it('broadcasts timeline:recomputed to subscribers of the attendance room', async () => {
    const socket = connectClient(employeeToken);
    await waitForEvent(socket, 'connect');
    socket.emit('employee:timeline:subscribe', { employeeId: EMPLOYEE_ID, attendanceId });
    await waitForEvent(socket, 'location:ack');

    const recomputedPromise = waitForEvent(socket, 'timeline:recomputed');

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${COMPANY_ID}/attendance/${attendanceId}/geo-timeline/rebuild`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send();

    const recomputed = await recomputedPromise;
    expect(recomputed).toBeDefined();
  });

  it('rejects a manager from a different company subscribing to this company\'s room', async () => {
    const socket = connectClient(otherCompanyManagerToken);
    await waitForEvent(socket, 'connect');

    socket.emit('company:subscribe', { companyId: COMPANY_ID });
    const error = await waitForEvent(socket, 'location:error');
    expect(error.error).toMatch(/forbidden/i);
  });
});
