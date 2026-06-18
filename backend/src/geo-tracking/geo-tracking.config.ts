import { registerAs } from '@nestjs/config';

export default registerAs('geoTracking', () => ({
  locationIntervalSeconds: parseInt(
    process.env.LOCATION_INTERVAL_SECONDS || '30',
    10,
  ),
  distanceFilterMeters: parseInt(
    process.env.DISTANCE_FILTER_METERS || '25',
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
  maxSpeedMps: parseInt(process.env.MAX_SPEED_MPS || '70', 10),
  stopRadiusMeters: parseInt(process.env.STOP_RADIUS_METERS || '50', 10),
  stopDurationSeconds: parseInt(process.env.STOP_DURATION_SECONDS || '300', 10),
  gapDurationSeconds: parseInt(process.env.GAP_DURATION_SECONDS || '300', 10),
}));
