# Tracker Client

This is a standalone web application acting as a stand-in for the future Flutter field employee app. It follows the exact same backend contract, so swapping it for Flutter later requires **no backend changes**.

## Key Limitations vs. a Real Flutter App

1. **No true background tracking**: Browsers limit or suspend geolocation when the tab/browser is not visible. This client can't track continuously in the background like a native mobile app.
2. **No isMocked detection**: Browsers do not expose a reliable API to detect if a geolocation point is mocked; this field is hardcoded to `false`.
3. **Battery API support varies**: The `navigator.getBattery` API is not supported across all browsers; when unavailable, battery percent is hardcoded to 50.
4. **Limited network type detection**: Uses `navigator.connection.effectiveType` which may not match native network detection exactly; falls back to "UNKNOWN".
5. **Browser storage limitations**: Uses localStorage for persistence, which has size limits (though sufficient for the use case of storing unsent points).

## Setup & Run

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the dev server**:
   ```bash
   npm run dev
   ```

3. **Configure backend URL**: Modify `API_BASE_URL` in `src/config.ts` if your NestJS backend is not running on `http://localhost:3000`.

## Features

- Simple login form: Enter Employee ID, Company ID, Attendance ID, and paste a valid JWT token.
- Start/Stop tracking controls.
- `navigator.geolocation.watchPosition` for point capture (high accuracy, distance filter 25 m).
- Point queue persisted in localStorage (prevents data loss on page refresh).
- Batch upload every 20 points or 30 seconds (whichever first).
- Retry with exponential backoff on network failure.
- Flush queue on browser 'online' event.
- Debug UI showing tracking state, queued points count, last sync time, last error.

## Endpoints Used

- **POST** `/api/v1/mobile/attendance/:attendanceId/location/start`
- **POST** `/api/v1/mobile/attendance/:attendanceId/location-points/batch`
- **POST** `/api/v1/mobile/attendance/:attendanceId/location/stop`

All endpoints require an `Authorization: Bearer <token>` header.
