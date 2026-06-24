export const CONFIG = {
  API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api/v1",
  MOVING_INTERVAL_MS: 15000,
  STATIONARY_INTERVAL_MS: 180000,
  // Floor for the accuracy-aware jitter filter (see shouldAcceptPoint), not
  // a flat route-thinning threshold. Real GPS accuracy carries most of the
  // weight so slow movement (walking) isn't mistaken for stationary jitter.
  DISTANCE_FILTER_METERS: 3,
  BATCH_SIZE: 5, // Lowered from 20 to 5 to prevent large payloads
  BATCH_INTERVAL_MS: 30000,
  GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "",
};
