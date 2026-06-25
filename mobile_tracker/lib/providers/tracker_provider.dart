import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:geolocator/geolocator.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import 'package:mobile_tracker/core/api_client.dart';
import 'package:mobile_tracker/core/config.dart';
import 'package:mobile_tracker/core/storage_service.dart';
import 'package:mobile_tracker/core/utils/geo_utils.dart';
import 'package:mobile_tracker/core/utils/id_generator.dart';
import 'package:mobile_tracker/models/attendance.dart';
import 'package:mobile_tracker/models/location_point.dart';
import 'package:mobile_tracker/models/stats.dart';
import 'package:mobile_tracker/models/timeline.dart';
import 'package:mobile_tracker/models/user_state.dart';
import 'package:mobile_tracker/services/attendance_service.dart';
import 'package:mobile_tracker/services/auth_service.dart';
import 'package:mobile_tracker/services/location_service.dart';
import 'package:mobile_tracker/services/stats_service.dart';
import 'package:mobile_tracker/services/timeline_service.dart';

enum TrackingState { idle, active, stopped }

class LatLng {
  final double lat;
  final double lng;
  const LatLng(this.lat, this.lng);
}

class _LastFix {
  final double lat;
  final double lon;
  final double accuracyM;
  _LastFix(this.lat, this.lon, this.accuracyM);
}

/// Mirrors trackers/src/context/TrackerContext.tsx: auth, attendance
/// check-in/out, the GPS queue + batch upload pipeline (with the same
/// accuracy-aware jitter filter as the web app), and timeline/stats
/// polling. One God-provider on purpose, same as the web's one big
/// context — splitting it apart would just relocate the coupling, not
/// remove it, since check-in/out, tracking, and stats all depend on the
/// same user/attendance state.
class TrackerProvider extends ChangeNotifier with WidgetsBindingObserver {
  final ApiClient _api = ApiClient();
  late final AuthService _authService = AuthService(_api);
  late final AttendanceService _attendanceService = AttendanceService(_api);
  late final LocationService _locationService = LocationService(_api);
  late final TimelineService _timelineService = TimelineService(_api);
  late final StatsService _statsService = StatsService(_api);

  StorageService? _storage;
  String _deviceId = '';

  UserState? user;
  TrackingState trackingState = TrackingState.idle;
  List<LocationPointDto> queue = [];
  DateTime? lastSyncTime;
  String? lastError;

  List<AttendanceDaily> attendances = [];
  AttendanceDaily? selectedAttendance;

  bool isCreatingAttendance = false;
  bool isCheckingOut = false;

  double totalDistance = 0;
  bool isHydrated = false;

  LatLng? currentLocation;

  String selectedTimelineDate = _todayDateStatic();
  TimelineResponse? timeline;
  bool loadingTimeline = false;
  String? errorTimeline;

  List<EmployeeStatsDay>? stats;
  bool loadingStats = false;

  StreamSubscription<Position>? _positionSub;
  Timer? _batchTimer;
  Timer? _statsTimer;
  Timer? _timelineTimer;
  Timer? _retryTimer;
  int _retryBackoffMs = 1000;
  bool _isUploading = false;
  int _sequence = 0;
  _LastFix? _lastFix;
  LocationPointDto? _lastQueuedPoint;
  AppLifecycleState _appLifecycleState = AppLifecycleState.resumed;

  TrackerProvider() {
    WidgetsBinding.instance.addObserver(this);
    _hydrate();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appLifecycleState = state;
  }

  static String _todayDateStatic() => DateTime.now().toIso8601String().split('T')[0];

  Future<void> _hydrate() async {
    _storage = await StorageService.create();
    _deviceId = await _storage!.getOrCreateDeviceId();

    final savedUser = _storage!.loadUser();
    if (savedUser != null) {
      user = savedUser;
      _api.setToken(savedUser.token);
    }

    final savedQueue = _storage!.loadQueue();
    if (savedQueue.isNotEmpty) {
      queue = savedQueue;
      _sequence = savedQueue.map((p) => p.sequenceNo).reduce((a, b) => a > b ? a : b) + 1;
      final last = savedQueue.last;
      _lastFix = _LastFix(last.latitude, last.longitude, last.accuracyM);
      _lastQueuedPoint = last;
    }

    final savedState = _storage!.loadTrackingState();
    trackingState = savedState == 'active'
        ? TrackingState.active
        : savedState == 'stopped'
            ? TrackingState.stopped
            : TrackingState.idle;

    isHydrated = true;
    notifyListeners();

    if (user != null) {
      await refreshAttendances();
      await refreshTimeline();
      await refreshStats();
      _startPolling();
    }

    if (trackingState == TrackingState.active && user?.attendanceId != null) {
      await _beginGeoWatch();
    }
  }

  // ---- Auth ----

  Future<void> login(String employeeId, String password) async {
    await _resetSessionState();
    final loggedIn = await _authService.login(employeeId, password);
    user = loggedIn;
    _api.setToken(loggedIn.token);
    await _storage!.saveUser(loggedIn);
    notifyListeners();
    await refreshAttendances();
    _startPolling();
  }

  Future<void> signup(String employeeId, String name, String password) async {
    await _resetSessionState();
    final created = await _authService.signup(employeeId, name, password);
    user = created;
    _api.setToken(created.token);
    await _storage!.saveUser(created);
    notifyListeners();
    await refreshAttendances();
    _startPolling();
  }

  Future<void> _resetSessionState() async {
    await _storage?.clearUser();
    await _storage?.clearQueue();
    await _storage?.clearTrackingState();
    user = null;
    queue = [];
    trackingState = TrackingState.idle;
    lastError = null;
    totalDistance = 0;
    notifyListeners();
  }

  Future<void> logout() async {
    await _endGeoWatch();
    _stopPolling();
    user = null;
    await _storage?.clearUser();
    await _storage?.clearQueue();
    await _storage?.clearTrackingState();
    queue = [];
    trackingState = TrackingState.idle;
    lastSyncTime = null;
    lastError = null;
    selectedAttendance = null;
    totalDistance = 0;
    attendances = [];
    timeline = null;
    stats = null;
    _api.setToken(null);
    notifyListeners();
  }

  // ---- Attendance ----

  Future<void> refreshAttendances() async {
    if (user == null) return;
    try {
      attendances = await _attendanceService.getAttendances();
      final today = _todayDateStatic();
      final openToday = attendances.where(
        (a) => a.attendanceDate == today && a.finalCheckOutAt == null,
      );
      if (user!.attendanceId == null && openToday.isNotEmpty) {
        selectedAttendance = openToday.first;
        user = user!.copyWith(attendanceId: selectedAttendance!.id);
        await _storage!.saveUser(user!);
      }
      notifyListeners();
    } catch (e) {
      lastError = 'Failed to load attendances: $e';
      notifyListeners();
    }
  }

  Future<void> createAttendance() async {
    isCreatingAttendance = true;
    notifyListeners();
    try {
      final created = await _attendanceService.createAttendance();
      attendances = [created, ...attendances.where((a) => a.id != created.id)];
      user = user!.copyWith(attendanceId: created.id);
      await _storage!.saveUser(user!);
      selectedAttendance = created;
      try {
        await _attendanceService.startTracking(created.id);
      } catch (_) {
        // Non-fatal — batches still get accepted without this; it only
        // primes server-side tracking config. Failing check-in over this
        // would be the wrong tradeoff.
      }
      await _beginGeoWatch();
      await refreshTimeline();
      await refreshStats();
    } finally {
      isCreatingAttendance = false;
      notifyListeners();
    }
  }

  Future<void> checkOutAttendance() async {
    isCheckingOut = true;
    notifyListeners();
    try {
      await _endGeoWatch();
      final attendanceId = user!.attendanceId!;
      final updated = await _attendanceService.checkOut(attendanceId);
      attendances = attendances.map((a) => a.id == updated.id ? updated : a).toList();
      user = user!.copyWith(attendanceId: null);
      await _storage!.saveUser(user!);
      selectedAttendance = null;
      totalDistance = 0;
      await refreshTimeline();
      await refreshStats();
    } finally {
      isCheckingOut = false;
      notifyListeners();
    }
  }

  // ---- Timeline / stats ----

  Future<void> setSelectedTimelineDate(String date) async {
    selectedTimelineDate = date;
    notifyListeners();
    await refreshTimeline();
  }

  Future<void> refreshTimeline() async {
    if (user == null) return;
    loadingTimeline = true;
    errorTimeline = null;
    notifyListeners();
    try {
      timeline = await _timelineService.getTimeline(selectedTimelineDate);
    } catch (e) {
      errorTimeline = '$e';
    } finally {
      loadingTimeline = false;
      notifyListeners();
    }
  }

  Future<void> refreshStats() async {
    if (user == null) return;
    loadingStats = true;
    notifyListeners();
    try {
      stats = await _statsService.getStats(days: 7);
    } catch (_) {
      // Stats are supplementary — keep the last good snapshot rather than
      // blanking the panel on a transient failure.
    } finally {
      loadingStats = false;
      notifyListeners();
    }
  }

  void _startPolling() {
    _timelineTimer?.cancel();
    _timelineTimer = Timer.periodic(AppConfig.timelinePollInterval, (_) => refreshTimeline());
    _statsTimer?.cancel();
    _statsTimer = Timer.periodic(AppConfig.statsPollInterval, (_) => refreshStats());
  }

  void _stopPolling() {
    _timelineTimer?.cancel();
    _statsTimer?.cancel();
  }

  // ---- Location tracking ----

  Future<bool> _ensureLocationPermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      lastError = 'Location services are disabled on this device.';
      notifyListeners();
      return false;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      lastError = 'Location permission denied.';
      notifyListeners();
      return false;
    }
    return true;
  }

  Future<void> _beginGeoWatch() async {
    if (!await _ensureLocationPermission()) return;

    trackingState = TrackingState.active;
    await _storage!.saveTrackingState('active');
    notifyListeners();

    if (queue.isEmpty) {
      _lastFix = null;
      _lastQueuedPoint = null;
    }

    await _positionSub?.cancel();
    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 0,
      ),
    ).listen(
      _handlePosition,
      onError: (_) {
        // Transient GPS errors (timeout, brief signal loss) are expected
        // and shouldn't surface as a user-facing error every time.
      },
    );

    _batchTimer?.cancel();
    _batchTimer = Timer.periodic(AppConfig.batchInterval, (_) => _flushQueue(sendEmpty: true));
  }

  Future<void> _endGeoWatch() async {
    trackingState = TrackingState.idle;
    await _storage?.saveTrackingState('idle');
    await _positionSub?.cancel();
    _positionSub = null;
    _batchTimer?.cancel();
    _batchTimer = null;
    await _flushQueue();
    _lastFix = null;
    _lastQueuedPoint = null;
    notifyListeners();
  }

  Future<void> _handlePosition(Position position) async {
    if (user?.attendanceId == null) return;

    final accuracy = position.accuracy;
    final lat = position.latitude;
    final lon = position.longitude;

    if (!_shouldAcceptPoint(lat, lon, accuracy)) return;

    final previous = _lastFix;
    _lastFix = _LastFix(lat, lon, accuracy);

    final batteryPercent = await _getBatteryPercent();
    final networkType = await _getNetworkType();

    final point = LocationPointDto(
      clientPointId: generateClientPointId(),
      sequenceNo: _sequence,
      capturedAt: DateTime.now().toUtc().toIso8601String(),
      latitude: lat,
      longitude: lon,
      accuracyM: accuracy,
      speedMps: position.speed,
      heading: position.heading,
      batteryPercent: batteryPercent,
      networkType: networkType,
      appState: _appLifecycleState == AppLifecycleState.resumed ? 'FOREGROUND' : 'BACKGROUND',
      isMocked: position.isMocked,
    );
    _sequence += 1;

    if (previous != null) {
      totalDistance += haversineDistanceMeters(previous.lat, previous.lon, lat, lon);
    }

    queue = [...queue, point];
    _lastQueuedPoint = point;
    currentLocation = LatLng(lat, lon);
    await _storage!.saveQueue(queue);
    notifyListeners();

    if (queue.length >= AppConfig.batchSize) {
      _flushQueue();
    }
  }

  /// Accuracy-aware jitter filter: a move only counts as real movement if
  /// it exceeds both the base filter and the combined GPS uncertainty of
  /// the two fixes being compared — otherwise normal jitter while
  /// stationary (multipath/urban canyon error) gets counted as movement.
  /// A single degraded fix can't permanently inflate the threshold because
  /// accuracy is capped before use. Mirrors shouldAcceptPoint in
  /// trackers/src/context/TrackerContext.tsx.
  bool _shouldAcceptPoint(double lat, double lon, double accuracy) {
    final last = _lastFix;
    if (last == null) return true;

    final distance = haversineDistanceMeters(last.lat, last.lon, lat, lon);
    final cappedAccuracy = accuracy.clamp(0, AppConfig.accuracyCapMeters);
    final cappedLastAccuracy = last.accuracyM.clamp(0, AppConfig.accuracyCapMeters);
    final effectiveThreshold = [
      AppConfig.distanceFilterMeters,
      cappedAccuracy,
      cappedLastAccuracy,
    ].reduce((a, b) => a > b ? a : b);

    if (distance < effectiveThreshold) return false;

    final lastQueued = _lastQueuedPoint;
    if (lastQueued != null &&
        lastQueued.latitude == lat &&
        lastQueued.longitude == lon &&
        lastQueued.accuracyM == accuracy) {
      return false;
    }

    return true;
  }

  Future<int> _getBatteryPercent() async {
    try {
      return await Battery().batteryLevel;
    } catch (_) {
      return 100;
    }
  }

  Future<String> _getNetworkType() async {
    try {
      final results = await Connectivity().checkConnectivity();
      final result = results.isNotEmpty ? results.first : ConnectivityResult.none;
      switch (result) {
        case ConnectivityResult.wifi:
          return 'WIFI';
        case ConnectivityResult.mobile:
          return 'CELLULAR';
        case ConnectivityResult.ethernet:
          return 'ETHERNET';
        default:
          return 'UNKNOWN';
      }
    } catch (_) {
      return 'UNKNOWN';
    }
  }

  Future<void> _flushQueue({bool sendEmpty = false}) async {
    if (user?.attendanceId == null) return;
    if (queue.isEmpty && !sendEmpty) return;
    if (_isUploading) return;

    final chunk = queue.take(AppConfig.maxBatchSize).toList();
    if (chunk.isEmpty && !sendEmpty) return;

    _isUploading = true;
    try {
      final result = await _locationService.uploadBatch(
        attendanceId: user!.attendanceId!,
        deviceId: _deviceId,
        points: chunk,
      );
      if (result.lastUpdatedAt != null) {
        lastSyncTime = DateTime.tryParse(result.lastUpdatedAt!);
      }
      lastError = null;
      _retryBackoffMs = 1000;

      if (chunk.isNotEmpty) {
        var newQueue = queue.where((p) => p.sequenceNo > result.lastAcceptedSequenceNo).toList();
        if (newQueue.length == queue.length) {
          // None of this chunk's points were newly accepted (duplicates or
          // rejected) — drop the chunk we just sent instead of retrying it
          // forever.
          newQueue = queue.skip(chunk.length).toList();
        }
        queue = newQueue;
        await _storage!.saveQueue(queue);
      }
      notifyListeners();

      if (queue.isNotEmpty && !_isUploading) {
        _flushQueue();
      }
    } catch (e) {
      lastError = 'Batch upload error: $e';
      notifyListeners();
      _retryWithBackoff();
    } finally {
      _isUploading = false;
    }
  }

  void _retryWithBackoff() {
    _retryTimer?.cancel();
    _retryTimer = Timer(Duration(milliseconds: _retryBackoffMs), () {
      if (queue.isNotEmpty && !_isUploading) {
        _flushQueue();
      }
      _retryBackoffMs = (_retryBackoffMs * 2).clamp(1000, 30000);
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _positionSub?.cancel();
    _batchTimer?.cancel();
    _statsTimer?.cancel();
    _timelineTimer?.cancel();
    _retryTimer?.cancel();
    super.dispose();
  }
}
