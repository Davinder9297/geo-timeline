import 'package:mobile_tracker/core/api_client.dart';
import 'package:mobile_tracker/models/stats.dart';

class StatsService {
  final ApiClient _api;
  StatsService(this._api);

  Future<List<EmployeeStatsDay>> getStats({int days = 7}) async {
    final json = await _api.get('/mobile/attendance/stats', query: {'days': '$days'});
    final list = json['data'] as List<dynamic>? ?? [];
    return list
        .map((d) => EmployeeStatsDay.fromJson(d as Map<String, dynamic>))
        .toList();
  }
}
