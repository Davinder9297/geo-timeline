# Geo Timeline Backend — Flutter Integration Guide

This document describes every API a Flutter mobile app needs to integrate with the geo-tracking backend: authentication, attendance, location tracking, and the real-time WebSocket channel. It reflects the backend exactly as implemented in `backend/src/geo-tracking`.

A ready-to-import Postman collection covering the same endpoints lives at [`docs/geo-timeline.postman_collection.json`](./geo-timeline.postman_collection.json).

---

## 1. Base setup

- **Base URL:** `http://<host>:<port>` (default port `3000`, no global route prefix — controllers declare full paths like `api/v1/...`)
- **Content-Type:** `application/json` on every request body
- **Auth header:** `Authorization: Bearer <accessToken>` on every endpoint except `POST /api/v1/auth/login` and `POST /api/v1/auth/register`
- **Error shape** (all errors, from the global exception filter):

```json
{
  "success": false,
  "error": {
    "statusCode": 401,
    "message": "Unauthorized",
    "error": "Unauthorized"
  }
}
```

- **Success shape:** every success response is `{ "success": true, "data": ... }` unless stated otherwise.

---

## 2. Authentication

### 2.1 Login

`POST /api/v1/auth/login`

```json
{
  "companyId": "company1",
  "employeeId": "emp-001",
  "password": "employee123"
}
```

Response `200 OK`:

```json
{
  "accessToken": "<jwt>",
  "employee": {
    "companyId": "company1",
    "employeeId": "emp-001",
    "name": "Alice Smith",
    "role": "EMPLOYEE"
  }
}
```

`401 Unauthorized` if `companyId`/`employeeId` doesn't exist or password is wrong.

The JWT payload is `{ employeeId, companyId, role }` and is valid for **7 days**. Store `accessToken` securely (e.g. `flutter_secure_storage`) and attach it as `Authorization: Bearer <token>` on every subsequent call, including the WebSocket handshake.

### 2.2 Register (admin/seed use — not the normal employee flow)

`POST /api/v1/auth/register`

```json
{
  "companyId": "company1",
  "employeeId": "emp-011",
  "name": "New Employee",
  "password": "secret123",
  "role": "EMPLOYEE"
}
```

`role` is optional, defaults to `EMPLOYEE`. Returns the same shape as login. `409 Conflict` if the employee already exists for that company.

### 2.3 Current user

`POST /api/v1/auth/me` (requires `Authorization` header) → `{ "user": { "employeeId", "companyId", "role" } }`. Useful for a quick "is my token still valid" check on app resume.

---

## 3. Attendance & location tracking (mobile flow)

All endpoints below are under `api/v1/mobile/attendance` and require the `Authorization` header. The backend always resolves the employee from the JWT — you never pass `employeeId`/`companyId` in the body.

### 3.1 Get my attendance history

`GET /api/v1/mobile/attendance` → `{ success, data: AttendanceDaily[] }`, newest first.

### 3.2 Check in (start a day)

`POST /api/v1/mobile/attendance` (empty body)

Creates today's attendance document and opens session 1. Call this when the employee taps "Start Attendance".

Response:
```json
{
  "success": true,
  "data": {
    "_id": "665f1...",
    "companyId": "company1",
    "employeeId": "emp-001",
    "attendanceDate": "2026-06-22",
    "timezone": "Asia/Kolkata",
    "status": "WORKING",
    "firstCheckInAt": "2026-06-22T04:00:00.000Z",
    "sessions": [{ "sessionId": "uuid", "checkInAt": "...", "breaks": [] }]
  }
}
```

`409 Conflict` if the employee already checked in today (message differs depending on whether they already checked out: *"You have already checked in today"* vs *"You have already checked out today; you cannot check in again"*). Treat 409 as "load existing attendance via GET" rather than a hard error.

> Keep `data._id` — this is the `attendanceId` used for every tracking call below.

### 3.3 Start location tracking

`POST /api/v1/mobile/attendance/:attendanceId/location/start` (empty body)

Call this immediately after check-in succeeds (or when resuming after a break). The backend closes any dangling open break and flips status back to `WORKING` if it was `ON_BREAK`.

Response — use these values to configure your tracking plugin:
```json
{
  "success": true,
  "data": {
    "trackingEnabled": true,
    "locationIntervalSeconds": 30,
    "distanceFilterMeters": 25,
    "batchSize": 20
  }
}
```
`409 Conflict` if attendance is `CHECKED_OUT` (you can't restart tracking on a finished day).

### 3.4 Upload a location batch

`POST /api/v1/mobile/attendance/:attendanceId/location-points/batch`

```json
{
  "deviceId": "device-uuid-or-installation-id",
  "points": [
    {
      "clientPointId": "uuid-v4-generated-on-device",
      "sequenceNo": 1001,
      "capturedAt": "2026-06-22T10:01:20.000Z",
      "latitude": 23.0225,
      "longitude": 72.5714,
      "accuracyM": 18,
      "speedMps": 7.2,
      "heading": 120,
      "batteryPercent": 62,
      "networkType": "4G",
      "appState": "BACKGROUND",
      "isMocked": false
    }
  ]
}
```

Field rules (see [`batch-location-points.dto.ts`](../backend/src/geo-tracking/dto/batch-location-points.dto.ts)):
- `clientPointId` — **generate a UUID v4 on-device for every captured point, once, and never reuse it.** This is the primary dedup key.
- `sequenceNo` — a per-device monotonically increasing integer. Used as a secondary dedup key (`deviceId` + `sequenceNo`).
- `capturedAt` — ISO-8601 string, the time the GPS fix was actually taken (not when you're sending it). The backend sorts and computes the timeline by this field, not by arrival time, so late/offline points are handled correctly.
- `latitude` ∈ [-90, 90], `longitude` ∈ [-180, 180] — points outside this range are silently rejected (counted in `rejected`, not stored).
- `appState` — must be exactly `"FOREGROUND"` or `"BACKGROUND"`.
- Max **200 points per batch** (`maxBatchSize`, configurable) — chunk locally if your queue grows larger than that.

Response:
```json
{
  "success": true,
  "data": {
    "accepted": 1,
    "duplicates": 0,
    "rejected": 0,
    "lastAcceptedSequenceNo": 1001,
    "lastUpdatedAt": "2026-06-22T10:01:28.000Z"
  }
}
```

Behavior the client should rely on:
- **Safe to retry.** Resending the same batch (same `clientPointId`s) after a timeout/network error is safe — duplicates are detected and counted, not re-inserted or double-counted in distance.
- **Order doesn't matter.** Points captured while offline can be sent later, out of order; the backend re-sorts by `capturedAt` when building the timeline.
- `409`/`400` if the attendance isn't `WORKING` or `ON_BREAK` (e.g. already checked out) — stop the local queue and prompt re-check-in.
- `404` if the `attendanceId` doesn't belong to the authenticated employee/company.

### 3.5 Stop tracking (e.g. employee taps "Break")

`POST /api/v1/mobile/attendance/:attendanceId/location/stop` (empty body)

Marks attendance `ON_BREAK`, opens a new break record, and triggers a timeline recompute in the background. Call this when the user goes on break — **not** on checkout (checkout has its own endpoint, see below, and also stops tracking implicitly).

Response: `{ "success": true, "data": null }`.

### 3.6 Check out (end the day)

`POST /api/v1/mobile/attendance/:attendanceId/checkout` (empty body)

Closes the current session, sets `finalCheckOutAt`, flips status to `CHECKED_OUT`, marks the employee's live-location entry `CHECKED_OUT`, and synchronously rebuilds the day's timeline summary. Flush any points still in your local queue **before** calling checkout (or immediately after — the rebuild can be re-triggered later via the CRM rebuild endpoint if a point arrives late).

`409 Conflict` if already checked out.

---

## 4. Recommended Flutter tracking flow

```
1. App start → restore accessToken → call POST /auth/me to validate, else show login.
2. Login screen → POST /auth/login → store accessToken + employee info.
3. "Start Attendance" → POST /mobile/attendance → store attendanceId locally.
4. POST /mobile/attendance/:id/location/start → store the returned interval/distance/batchSize config.
5. Configure platform location plugin (e.g. `geolocator` + `flutter_background_geolocation`
   or `flutter_background_service`) using:
     - distanceFilter = distanceFilterMeters
     - interval ≈ locationIntervalSeconds (reduce frequency when stationary)
6. On every fix: build a point with a fresh UUID v4 clientPointId + incrementing sequenceNo,
   write it to a local persistent queue (sqlite/hive) BEFORE attempting upload.
7. Background uploader: drain the local queue in chunks of `batchSize` (or up to maxBatchSize=200),
   POST to /location-points/batch, remove acked points from the local queue only after a
   successful response. On failure, exponential backoff and retry — never drop points.
8. On reconnect after offline: flush the full local queue, oldest capturedAt first
   (order doesn't matter to the backend, but sending oldest first keeps memory bounded).
9. "Break" tapped → POST /mobile/attendance/:id/location/stop → pause the location plugin
   (per company policy) or keep low-frequency heartbeat going.
10. "Resume" tapped → POST /mobile/attendance/:id/location/start again.
11. "Check out" tapped → flush queue → POST /mobile/attendance/:id/checkout → stop location plugin.
```

Mark `isMocked: true` if the OS reports the location as coming from a mock provider (Android `Location.isFromMockProvider()` / iOS doesn't expose this directly — default `false` on iOS).

---

## 5. CRM / manager APIs (for reference — used by the web dashboard, not the Flutter app)

Base path: `api/v1/companies/:companyId`. Requires `Authorization` header with a `MANAGER` or `ADMIN` role JWT, and `companyId` in the URL must match the JWT's `companyId` (`403 Forbidden` otherwise).

- `GET /companies/:companyId/geo/live-employees?status=WORKING` → list of employees with live status/location.
- `GET /companies/:companyId/employees/:employeeId/geo-timeline?date=2026-06-22` → full day timeline (attendance, raw points, processed route, totals, events, anomalies).
- `POST /companies/:companyId/attendance/:attendanceId/geo-timeline/rebuild` → force-recompute (e.g. after late points arrive). Returns `202 Accepted`.

---

## 6. WebSocket (real-time live map updates)

**Namespace:** `/ws/location` (Socket.IO).

**Authentication is now enforced on connect.** `handleConnection` extracts a JWT from (in order of precedence) `handshake.auth.token`, an `Authorization: Bearer <token>` header, or a `?token=` query param; verifies it with the same secret/algorithm as the REST `JwtAuthGuard`; and attaches the real `{ employeeId, companyId, role }` payload to the socket. A connection with a missing or invalid/expired token receives a `location:error` event and is immediately disconnected by the server — it never reaches any event handler. Every room-isolation check (`company:subscribe`, `employee:timeline:subscribe`) is evaluated against this real, per-connection identity, not a shared mock user. Implementation: [`location.gateway.ts`](../backend/src/geo-tracking/location.gateway.ts).

Connect (Flutter, using the `socket_io_client` package):

```dart
final socket = IO.io('http://<host>:3000/ws/location', <String, dynamic>{
  'transports': ['websocket'],
  'auth': {'token': accessToken}, // REQUIRED — connection is rejected without a valid token
});

socket.onConnectError((err) {
  // token missing/invalid/expired — re-login and reconnect with a fresh token
});
```

If a token expires while connected, the socket itself isn't automatically dropped (verification only happens at connect time) — reconnect with a fresh token after refreshing it via login, and handle `location:error` responses defensively on every emit.

### 6.1 Who uses which event — and what's actually required

The socket has two unrelated jobs that happen to share one namespace. Don't confuse them:

| Event | Used by | Direction | Required? |
|---|---|---|---|
| `location:point` / `location:batch` | **Mobile app (Flutter)** | upload (client → server) | **Optional / your choice.** This is an *alternative* upload path to the REST batch endpoint, not an addition to it. |
| `company:subscribe` / `employee:timeline:subscribe` | **CRM web dashboard** | subscribe to receive (client → server) | Required only if you want live map updates on the CRM side. Mobile never needs these. |
| `employee:location:update` / `employee:status:update` / `timeline:recomputed` | Server → whoever subscribed | broadcast | Automatic consequence of either upload path; nothing to call explicitly. |

**For the Flutter app: use the REST batch endpoint (§3.4) only. Do not also emit `location:point`/`location:batch` for the same points.**

- The REST endpoint is the durable, ack'd, retry-friendly path — it's the one this whole backend treats as the source of truth for persistence.
- The socket upload events run through the *exact same* `batchInsertLocationPoints` logic, but have **no retry/ack-and-persist guarantee** if the connection drops mid-emit. A dropped socket emit is just gone unless you build your own ack-tracking and retry on top of it.
- **If you send the same point through both REST and the socket**, the backend's dedup logic (`clientPointId`, then `deviceId`+`sequenceNo`) will catch it and count it as a duplicate rather than creating a second DB row — so it won't corrupt your data, but it's two network round-trips for one point, for no benefit. There's no scenario in this app where doing both is the right call.
- The only reason to ever emit `location:point`/`location:batch` from Flutter is if you specifically want sub-second map-marker latency while foregrounded and connected, as a *supplement* to (never a replacement for) the REST queue. Most integrations should just skip the socket upload path entirely.

The CRM dashboard side (`company:subscribe`, `employee:timeline:subscribe`) is a completely separate concern — it only *receives* broadcasts, it never uploads anything. The Flutter app does not need to call these.

Events the client can emit:

| Event | Payload | Purpose |
|---|---|---|
| `location:point` | `{ attendanceId, deviceId, point: <single point, same shape as batch> }` | Optional low-latency single-point push — see above |
| `location:batch` | `{ attendanceId, deviceId, points: [...] }` | Optional low-latency batch push — see above. Points are persisted under the **connected socket's own** `employeeId`/`companyId` (from its JWT), not anything in the payload. |
| `company:subscribe` | `{ companyId }` | CRM-only: join `company:{companyId}` room — only allowed if it matches the JWT's own `companyId`, regardless of role |
| `employee:timeline:subscribe` | `{ employeeId, attendanceId }` | CRM-only: join `attendance:{attendanceId}` room — allowed if `employeeId` matches the JWT's own `employeeId` (self), or if the JWT's `role` is `MANAGER`/`ADMIN` |

Events the server emits:

| Event | Payload | When |
|---|---|---|
| `location:ack` | `{ success: true }` | After successful `location:point`/`location:batch`/subscribe |
| `location:error` | `{ error: string }` | Auth failure on connect, missing/invalid token, cross-company/cross-employee authorization failure, or a downstream validation error |
| `employee:location:update` | `{ employeeId, location: {latitude, longitude}, status, isStale, lastUpdatedAt }` | Broadcast to `company:{companyId}` + `employee:{employeeId}` after any point is persisted (via REST or socket) |
| `employee:status:update` | `{ employeeId, isStale, status }` | Broadcast when stale state changes |
| `timeline:recomputed` | summary fields | Broadcast to `attendance:{attendanceId}` after a rebuild completes |

**Bottom line for the Flutter app: use the HTTP batch endpoint only, and skip the WebSocket upload events entirely.** It's sufficient on its own and is what the backend treats as authoritative. The socket's upload events (`location:point`/`location:batch`) are an optional alternative, not a required second channel — sending every point through both is redundant (deduped server-side, but wasted bandwidth/battery for no gain). The socket is primarily there for the CRM web dashboard's live map, via the subscribe events.

Covered by [`backend/test/location-gateway.e2e-spec.ts`](../backend/test/location-gateway.e2e-spec.ts): valid-token connect, rejected connect with no/garbage token, company room isolation by real JWT, self vs. manager timeline-subscribe authorization, and both broadcast events.

---

## 7. Status/enum reference

`AttendanceStatus`: `WORKING | ON_BREAK | OFFLINE | CHECKED_OUT`
`LiveLocationStatus`: `WORKING | ON_BREAK | OFFLINE | STALE | CHECKED_OUT`
`UserRole`: `ADMIN | MANAGER | EMPLOYEE`
`appState` (location point): `FOREGROUND | BACKGROUND`
`networkType`: free-text string, e.g. `"WIFI" | "4G" | "5G" | "OFFLINE"`

---

## 8. Test credentials (seeded data)

Run `npm run seed` in `backend/` to populate:

| companyId | employeeId | password | role |
|---|---|---|---|
| company1 | admin | employee123 | ADMIN |
| company1 | manager1 | employee123 | MANAGER |
| company1 | emp-001 … emp-010 | employee123 | EMPLOYEE |

`POST /api/v1/admin/test/clear-all-except-employees/test-clear-123` wipes attendance/location/live-location/timeline data (keeps employees) — handy for resetting a test device between runs. **Do not expose this endpoint in production** (it has no auth guard at all).
