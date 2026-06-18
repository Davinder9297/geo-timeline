# Geo Timeline - Monorepo

A complete employee location tracking system with NestJS backend and Next.js frontends.

## Project Structure

```
geo-timeline/
├── backend/                # NestJS backend
├── trackers/               # Next.js tracker client (for employees)
├── dashboard/             # Next.js CRM dashboard (for managers)
├── .gitignore
└── README.md
```

## Backend

### Setup

```bash
cd backend
npm install
cp .env.example .env  # Create your environment variables
npm run start:dev
```

## Tracker Client

### Setup

```bash
cd trackers
npm install
npm run dev
```

## CRM Dashboard

### Setup

```bash
cd dashboard
npm install
cp .env.example .env  # Add your Google Maps API key
npm run dev
```

## Features

### Backend

- MongoDB with Mongoose
- REST APIs for tracking, location upload, timeline calculation
- WebSocket real-time updates
- Timeline calculation algorithm (distance, stops, anomalies)

### Tracker Client

- Browser location tracking
- Local queue persistence
- Batch upload with retries
- Status UI

### CRM Dashboard

- Live employee map with clustering
- Employee timeline visualization
- Timeline playback
- WebSocket real-time updates

Created admin: employeeId=admin, password=admin123    
Created manager: employeeId=manager1, password=manager123
Created employee: employeeId=emp-001, password=employe123