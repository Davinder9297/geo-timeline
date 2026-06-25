/// Mirrors trackers/src/config.ts on the web tracker app — keep these two
/// in sync if you tune one of them.
class AppConfig {
  /// Point this at your backend. On a physical Android device or an
  /// emulator, "localhost" means the device itself, not your dev machine —
  /// see README.md "Pointing at your backend" for the right value.
  /// Currently set to this dev machine's Wi-Fi LAN IP (10.129.106.148) so a
  /// physical phone on the same network can reach it — update this if your
  /// machine's IP changes (e.g. after reconnecting to Wi-Fi).
  static const String apiBaseUrl = 'http://10.129.106.148:3000/api/v1';

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

  static const Duration statsPollInterval = Duration(seconds: 20);
  static const Duration timelinePollInterval = Duration(seconds: 20);

  /// Set this to your own Google Maps API key (Maps SDK for Android / iOS
  /// enabled). See README.md for where this needs to be wired in natively —
  /// google_maps_flutter does not read this Dart constant, it's just kept
  /// here as the single source of truth you copy from.
  static const String googleMapsApiKey = 'AIzaSyB9nQopzO09JFhVZWaawIg0Nkee3w1oK4I';
}
