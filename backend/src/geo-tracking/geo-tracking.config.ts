import { registerAs } from '@nestjs/config';

export default registerAs('geoTracking', () => ({
  defaultCompanyId: process.env.DEFAULT_COMPANY_ID || 'default-company',
  locationIntervalSeconds: parseInt(
    process.env.LOCATION_INTERVAL_SECONDS || '30',
    10,
  ),
  // Floor for the accuracy-aware jitter filter, not a flat route-thinning
  // threshold — real GPS accuracy (used alongside this) does the heavy
  // lifting so slow movement (walking) isn't mistaken for noise.
  distanceFilterMeters: parseInt(
    process.env.DISTANCE_FILTER_METERS || '5',
    10,
  ),
  batchSize: parseInt(process.env.BATCH_SIZE || '20', 10),
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '200', 10),
  poorAccuracyThresholdMeters: parseInt(
    process.env.POOR_ACCURACY_THRESHOLD_METERS || '50',
    10,
  ),
  staleThresholdMinutes: parseInt(
    process.env.STALE_THRESHOLD_MINUTES || '5',
    10,
  ),
  // 70 m/s (~252 km/h) was too low to ever be true commercial-flight speed
  // (~250 m/s cruise) or fast trains (~90 m/s) — every GPS pair during those
  // would get flagged IMPOSSIBLE_JUMP and dropped from the route/distance.
  // 350 m/s (~1260 km/h) comfortably covers walking/driving/train/flight
  // while still catching genuine GPS teleport glitches.
  maxSpeedMps: parseInt(process.env.MAX_SPEED_MPS || '350', 10),
  stopRadiusMeters: parseInt(process.env.STOP_RADIUS_METERS || '50', 10),
  stopDurationSeconds: parseInt(process.env.STOP_DURATION_SECONDS || '300', 10),
  gapDurationSeconds: parseInt(process.env.GAP_DURATION_SECONDS || '300', 10),
}));
