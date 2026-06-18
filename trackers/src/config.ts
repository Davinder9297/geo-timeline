export const CONFIG = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api/v1",
  MOVING_INTERVAL_MS: 15000,
  STATIONARY_INTERVAL_MS: 180000,
  DISTANCE_FILTER_METERS: 10, // Updated to 10 meters
  BATCH_SIZE: 5, // Lowered from 20 to 5 to prevent large payloads
  BATCH_INTERVAL_MS: 30000,
};
