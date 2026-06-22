import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID as uuidv4 } from 'crypto';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

// Per-suite unique identifiers so this file can run alongside other e2e specs
// against the same in-memory MongoDB instance without colliding on the
// (companyId, employeeId, attendanceDate) unique index.
const suffix = Date.now();
const COMPANY_ID = `e2e-co-${suffix}`;
const OTHER_COMPANY_ID = `e2e-co-other-${suffix}`;
const EMPLOYEE_ID = `e2e-emp-${suffix}`;
const MANAGER_ID = `e2e-mgr-${suffix}`;
const OTHER_MANAGER_ID = `e2e-mgr-other-${suffix}`;
const PASSWORD = 'TestPass123!';

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function makePoint(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    clientPointId: uuidv4(),
    sequenceNo: 1,
    capturedAt: isoMinutesAgo(0),
    latitude: 23.0225,
    longitude: 72.5714,
    accuracyM: 12,
    speedMps: 1.2,
    heading: 90,
    batteryPercent: 80,
    networkType: '4G',
    appState: 'FOREGROUND',
    isMocked: false,
    ...overrides,
  };
}

describe('Geo Tracking (e2e)', () => {
  let app: INestApplication;
  let employeeToken: string;
  let managerToken: string;
  let otherManagerToken: string;
  let attendanceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: false, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    // Seed an employee, a manager in the same company, and a manager in a
    // different company (for the cross-company isolation test).
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      companyId: COMPANY_ID,
      employeeId: EMPLOYEE_ID,
      name: 'E2E Employee',
      password: PASSWORD,
      role: 'EMPLOYEE',
    });
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      companyId: COMPANY_ID,
      employeeId: MANAGER_ID,
      name: 'E2E Manager',
      password: PASSWORD,
      role: 'MANAGER',
    });
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      companyId: OTHER_COMPANY_ID,
      employeeId: OTHER_MANAGER_ID,
      name: 'E2E Other Manager',
      password: PASSWORD,
      role: 'MANAGER',
    });

    const employeeLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ companyId: COMPANY_ID, employeeId: EMPLOYEE_ID, password: PASSWORD });
    employeeToken = employeeLogin.body.accessToken;

    const managerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ companyId: COMPANY_ID, employeeId: MANAGER_ID, password: PASSWORD });
    managerToken = managerLogin.body.accessToken;

    const otherManagerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ companyId: OTHER_COMPANY_ID, employeeId: OTHER_MANAGER_ID, password: PASSWORD });
    otherManagerToken = otherManagerLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('rejects login with wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ companyId: COMPANY_ID, employeeId: EMPLOYEE_ID, password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('rejects requests with no Authorization header', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/mobile/attendance');
      expect(res.status).toBe(401);
    });

    it('rejects requests with a malformed bearer token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/mobile/attendance')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
    });
  });

  describe('Check-in', () => {
    it('creates an attendance record on check-in', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/mobile/attendance')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('WORKING');
      expect(res.body.data.companyId).toBe(COMPANY_ID);
      expect(res.body.data.sessions).toHaveLength(1);
      attendanceId = res.body.data._id;
      expect(attendanceId).toBeTruthy();
    });

    it('rejects a second check-in on the same day with 409', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/mobile/attendance')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send();
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Location tracking lifecycle', () => {
    it('starts tracking and returns config', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/location/start`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send();

      expect(res.status).toBe(201);
      expect(res.body.data).toEqual({
        trackingEnabled: true,
        locationIntervalSeconds: expect.any(Number),
        distanceFilterMeters: expect.any(Number),
        batchSize: expect.any(Number),
      });
    });

    it('uploads a batch of valid points and accepts all of them', async () => {
      const pointA = makePoint({ sequenceNo: 1, capturedAt: isoMinutesAgo(10) });
      const pointB = makePoint({
        sequenceNo: 2,
        capturedAt: isoMinutesAgo(9),
        latitude: 23.023,
        longitude: 72.572,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/location-points/batch`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ deviceId: 'device-1', points: [pointA, pointB] });

      expect(res.status).toBe(201);
      expect(res.body.data.accepted).toBe(2);
      expect(res.body.data.duplicates).toBe(0);
      expect(res.body.data.rejected).toBe(0);
      expect(res.body.data.lastAcceptedSequenceNo).toBe(2);
    });

    it('does not double-count a resent (duplicate) point by clientPointId', async () => {
      const dup = makePoint({ sequenceNo: 3, capturedAt: isoMinutesAgo(8) });

      const first = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/location-points/batch`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ deviceId: 'device-1', points: [dup] });
      expect(first.body.data.accepted).toBe(1);

      const replay = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/location-points/batch`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ deviceId: 'device-1', points: [dup] });

      expect(replay.body.data.accepted).toBe(0);
      expect(replay.body.data.duplicates).toBe(1);
    });

    it('treats the same (deviceId, sequenceNo) pair as a duplicate even with a new clientPointId', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/location-points/batch`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          deviceId: 'device-1',
          points: [makePoint({ sequenceNo: 3, capturedAt: isoMinutesAgo(7) })],
        });
      expect(res.body.data.duplicates).toBe(1);
    });

    it('rejects points with out-of-range coordinates without rejecting the whole batch', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/location-points/batch`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          deviceId: 'device-1',
          points: [
            makePoint({ sequenceNo: 4, latitude: 999, capturedAt: isoMinutesAgo(6) }),
            makePoint({ sequenceNo: 5, longitude: -999, capturedAt: isoMinutesAgo(5) }),
            makePoint({ sequenceNo: 6, capturedAt: isoMinutesAgo(4) }),
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.rejected).toBe(2);
      expect(res.body.data.accepted).toBe(1);
    });

    it('accepts an out-of-order late point (captured earlier than already-stored points)', async () => {
      // sequenceNo 7 but capturedAt earlier than points already inserted above.
      const res = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/location-points/batch`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          deviceId: 'device-1',
          points: [makePoint({ sequenceNo: 7, capturedAt: isoMinutesAgo(30) })],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.accepted).toBe(1);
    });

    it('rejects batches larger than the configured max batch size', async () => {
      const points = Array.from({ length: 201 }, (_, i) =>
        makePoint({ sequenceNo: 1000 + i, capturedAt: isoMinutesAgo(1) }),
      );
      const res = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/location-points/batch`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ deviceId: 'device-1', points });

      expect(res.status).toBe(400);
    });

    it('rejects location upload for someone else\'s attendanceId', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/000000000000000000000000/location-points/batch`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ deviceId: 'device-1', points: [makePoint({ sequenceNo: 9999 })] });

      expect(res.status).toBe(404);
    });

    it('stops tracking (break) and reopens it (resume)', async () => {
      const stop = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/location/stop`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send();
      expect(stop.status).toBe(201);
      expect(stop.body.data).toBeNull();

      const resume = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/location/start`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send();
      expect(resume.status).toBe(201);
      expect(resume.body.data.trackingEnabled).toBe(true);
    });

    it('checks out and rejects further location uploads afterwards', async () => {
      const checkout = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/checkout`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send();
      expect(checkout.status).toBe(201);
      expect(checkout.body.data.status).toBe('CHECKED_OUT');
      expect(checkout.body.data.finalCheckOutAt).toBeTruthy();

      const lateUpload = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/location-points/batch`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ deviceId: 'device-1', points: [makePoint({ sequenceNo: 9000 })] });
      expect(lateUpload.status).toBe(400);

      const secondCheckout = await request(app.getHttpServer())
        .post(`/api/v1/mobile/attendance/${attendanceId}/checkout`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send();
      expect(secondCheckout.status).toBe(409);
    });
  });

  describe('CRM manager APIs', () => {
    it('lists the employee as CHECKED_OUT in live-employees', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/companies/${COMPANY_ID}/geo/live-employees`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      const entry = res.body.data.find((e: any) => e.employeeId === EMPLOYEE_ID);
      expect(entry).toBeDefined();
      expect(entry.status).toBe('CHECKED_OUT');
    });

    it('returns the computed timeline with raw points sorted by capturedAt', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/companies/${COMPANY_ID}/employees/${EMPLOYEE_ID}/geo-timeline`)
        .query({ date: today })
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summaryAvailable).toBe(true);
      expect(res.body.data.rawPointsCount).toBeGreaterThan(0);

      const capturedTimes = res.body.data.rawPoints.map((p: any) =>
        new Date(p.capturedAt).getTime(),
      );
      const sorted = [...capturedTimes].sort((a, b) => a - b);
      expect(capturedTimes).toEqual(sorted);

      expect(res.body.data.totals).toEqual(
        expect.objectContaining({
          rawDistanceMeters: expect.any(Number),
          workingSeconds: expect.any(Number),
          breakSeconds: expect.any(Number),
        }),
      );
    });

    it('rebuilds the timeline on demand', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/companies/${COMPANY_ID}/attendance/${attendanceId}/geo-timeline/rebuild`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send();
      expect(res.status).toBe(202);
      expect(res.body.data.queued).toBe(true);
    });

    it('blocks a manager from another company (cross-company isolation)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/companies/${COMPANY_ID}/geo/live-employees`)
        .set('Authorization', `Bearer ${otherManagerToken}`);
      expect(res.status).toBe(403);
    });

    it('blocks a plain employee from accessing CRM endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/companies/${COMPANY_ID}/geo/live-employees`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });
  });
});
