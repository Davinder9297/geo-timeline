import 'package:mobile_tracker/core/api_client.dart';
import 'package:mobile_tracker/models/attendance.dart';

class AttendanceService {
  final ApiClient _api;
  AttendanceService(this._api);

  Future<List<AttendanceDaily>> getAttendances() async {
    final json = await _api.get('/mobile/attendance');
    final list = json['data'] as List<dynamic>? ?? [];
    return list
        .map((a) => AttendanceDaily.fromJson(a as Map<String, dynamic>))
        .toList();
  }

  Future<AttendanceDaily> createAttendance() async {
    final json = await _api.post('/mobile/attendance');
    return AttendanceDaily.fromJson(json['data'] as Map<String, dynamic>);
  }

  Future<AttendanceDaily> checkOut(String attendanceId) async {
    final json = await _api.post('/mobile/attendance/$attendanceId/checkout');
    return AttendanceDaily.fromJson(json['data'] as Map<String, dynamic>);
  }

  Future<void> startTracking(String attendanceId) async {
    await _api.post('/mobile/attendance/$attendanceId/location/start');
  }
}
