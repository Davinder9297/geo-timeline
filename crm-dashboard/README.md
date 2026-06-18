# CRM Dashboard

React + TypeScript + Vite dashboard for viewing employee live locations and daily timelines.

## Setup

1. Install dependencies: `npm install`
2. Create `.env` file (copy `.env.example`):
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```
3. Run dev server: `npm run dev`
4. Build for production: `npm run build`

## Features

- Live employee map with marker clustering
- Employee list with search and status filters
- Timeline view with:
  - Total distance, working time, break time
  - GPS quality score
  - Anomaly list
  - Route playback simulation
- Real-time WebSocket updates

## Stack

- React 18 + TypeScript
- Vite
- Google Maps JavaScript API
- @googlemaps/markerclusterer
- date-fns
- socket.io-client
