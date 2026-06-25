import 'package:mobile_tracker/core/api_client.dart';
import 'package:mobile_tracker/models/timeline.dart';

class TimelineService {
  final ApiClient _api;
  TimelineService(this._api);

  /// Returns null on 404 (no attendance for that date) — mirrors the web
  /// app's "not an error, just an empty day" handling.
  Future<TimelineResponse?> getTimeline(String date) async {
    try {
      final json = await _api.get('/mobile/attendance/timeline', query: {'date': date});
      return TimelineResponse.fromJson(json['data'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      if (e.statusCode == 404) return null;
      rethrow;
    }
  }
}
