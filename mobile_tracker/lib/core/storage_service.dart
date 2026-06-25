import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile_tracker/core/utils/id_generator.dart';
import 'package:mobile_tracker/models/user_state.dart';
import 'package:mobile_tracker/models/location_point.dart';

/// Mirrors trackers/src/utils.ts's localStorage helpers, backed by
/// shared_preferences so the queue/user/tracking-state survive app
/// restarts the same way the web app survives a page reload.
class StorageService {
  static const _deviceIdKey = 'tracker_device_id';
  static const _userKey = 'tracker_user';
  static const _queueKey = 'tracker_queue';
  static const _trackingStateKey = 'tracker_tracking_state';

  final SharedPreferences _prefs;

  StorageService(this._prefs);

  static Future<StorageService> create() async {
    final prefs = await SharedPreferences.getInstance();
    return StorageService(prefs);
  }

  Future<String> getOrCreateDeviceId() async {
    final existing = _prefs.getString(_deviceIdKey);
    if (existing != null) return existing;
    final id = generateDeviceId();
    await _prefs.setString(_deviceIdKey, id);
    return id;
  }

  Future<void> saveUser(UserState user) async {
    await _prefs.setString(_userKey, jsonEncode(user.toJson()));
  }

  UserState? loadUser() {
    final raw = _prefs.getString(_userKey);
    if (raw == null) return null;
    try {
      return UserState.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> clearUser() async {
    await _prefs.remove(_userKey);
  }

  Future<void> saveQueue(List<LocationPointDto> queue) async {
    final encoded = jsonEncode(queue.map((p) => p.toJson()).toList());
    await _prefs.setString(_queueKey, encoded);
  }

  List<LocationPointDto> loadQueue() {
    final raw = _prefs.getString(_queueKey);
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((p) => LocationPointDto.fromJson(p as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> clearQueue() async {
    await _prefs.remove(_queueKey);
  }

  Future<void> saveTrackingState(String state) async {
    await _prefs.setString(_trackingStateKey, state);
  }

  String loadTrackingState() {
    return _prefs.getString(_trackingStateKey) ?? 'idle';
  }

  Future<void> clearTrackingState() async {
    await _prefs.remove(_trackingStateKey);
  }
}
