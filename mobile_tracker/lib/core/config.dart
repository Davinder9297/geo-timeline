/// Mirrors trackers/src/config.ts on the web tracker app — keep these two
/// in sync if you tune one of them.
class AppConfig {
  /// Point this at your backend. Currently set to the deployed Render
  /// instance. For local dev against a LAN backend instead, see
  /// README.md "Pointing at your backend".
  static const String apiBaseUrl = 'https://geo-timeline-test.onrender.com/api/v1';

  static const Duration batchInterval = Duration(seconds: 30);
  static const int batchSize = 5;
  static const int maxBatchSize = 200;

  /// Floor for the accuracy-aware jitter filter, not a flat route-thinning
  /// threshold (see TrackerProvider.shouldAcceptPoint). Real GPS accuracy
  /// carries most of the weight so slow movement (walking) isn't mistaken
  /// for stationary jitter.
  static const double distanceFilterMeters = 3;

  /// Caps how much a single degraded GPS fix (tunnel, indoors) can inflate
  /// the jitter-filter threshold, so it can't permanently suppress later
  /// good fixes once signal recovers.
  static const double accuracyCapMeters = 50;

  /// Fixes worse than this are dropped outright rather than queued — a
  /// 40-50m-accuracy fix (common indoors/urban canyon) is not just jittery,
  /// it's wrong, and recording it would put a real point on the map in the
  /// wrong place. Typical outdoor phone GPS is 3-10m, so 20m still tolerates
  /// normal degraded-but-usable signal without admitting garbage fixes.
  static const double maxAcceptableAccuracyMeters = 20;

  static const Duration statsPollInterval = Duration(seconds: 20);
  static const Duration timelinePollInterval = Duration(seconds: 20);

  /// Set this to your own Google Maps API key (Maps SDK for Android / iOS
  /// enabled). See README.md for where this needs to be wired in natively —
  /// google_maps_flutter does not read this Dart constant, it's just kept
  /// here as the single source of truth you copy from.
  static const String googleMapsApiKey = 'AIzaSyB9nQopzO09JFhVZWaawIg0Nkee3w1oK4I';
}
