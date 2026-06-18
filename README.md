# CRM Employee Geo Activity Timeline

A complete Google Timeline-inspired employee location tracking and analytics system.

## Architecture

### Backend (NestJS)
- **Frameworks**: NestJS, Mongoose, Socket.io
- **Collections**:
  - `employees`: Employee/CRM user data
  - `attendance_daily`: Daily attendance records (one per employee per day)
  - `location_points`: Append-only raw GPS points
  - `employee_live_locations`: Fast live dashboard cache
  - `attendance_timeline_summaries`: Calculated analytics
- **APIs**: Mobile tracking APIs, CRM dashboard APIs
- **WebSocket**: Real-time updates for CRM map

### Tracker Client (React + Vite)
- Stand-in for Flutter mobile app
- Browser-based location tracking
- Local queue, batch upload, retry logic
- Connects to backend APIs

### CRM Dashboard (React + Vite + Google Maps)
- Employee live map with clustering
- Employee list with filters
- Timeline view with simulation playback
- Analytics dashboard

## Quick Start

### Backend Setup
```bash
cd c:\geo-timeline
npm install
# Set up environment variables (copy .env.example to .env)
npm run start:dev
```

### Tracker Client Setup
```bash
cd tracker-client
npm install
# Update config.ts if backend URL is different
npm run dev
```

### CRM Dashboard Setup
```bash
cd crm-dashboard
npm install
# Copy .env.example to .env and fill in Google Maps API key
npm run dev
```

## What's Complete
- ✅ All required MongoDB collections with indexes
- ✅ Backend APIs (mobile + CRM)
- ✅ Timeline calculation algorithm
- ✅ WebSocket gateway for real-time updates
- ✅ Tracker client (React stand-in for Flutter)
- ✅ CRM dashboard with map, timeline, playback
- ✅ Stale employee detection
- ✅ Duplicate point handling
- ✅ Batch processing

## What's Pending
- 🟡 Full test suite (backend unit tests, API/e2e tests, WebSocket tests, frontend tests)
- 🟡 More advanced timeline playback (tied to actual timeline events)
- 🟡 Complete set of map markers (break, hold/stop, start/end)
- 🟡 Real job queue (BullMQ) instead of inline timeline rebuilds
- 🟡 Optional Google Roads API integration
- 🟡 Load testing

## Folder Structure
```
c:\geo-timeline\
├── src/                    # NestJS backend source
│   └── geo-tracking/       # Geo-tracking module
├── tracker-client/         # React tracker client
├── crm-dashboard/          # React CRM dashboard
└── README.md               # This file
```
