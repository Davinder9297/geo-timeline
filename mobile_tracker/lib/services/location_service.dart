import 'package:mobile_tracker/core/api_client.dart';
import 'package:mobile_tracker/models/location_point.dart';

class BatchUploadResult {
  final int accepted;
  final int duplicates;
  final int rejected;
  final int lastAcceptedSequenceNo;
  final String? lastUpdatedAt;

  const BatchUploadResult({
    required this.accepted,
    required this.duplicates,
    required this.rejected,
    required this.lastAcceptedSequenceNo,
    this.lastUpdatedAt,
  });

  factory BatchUploadResult.fromJson(Map<String, dynamic> json) =>
      BatchUploadResult(
        accepted: json['accepted'] as int? ?? 0,
        duplicates: json['duplicates'] as int? ?? 0,
        rejected: json['rejected'] as int? ?? 0,
        lastAcceptedSequenceNo: json['lastAcceptedSequenceNo'] as int? ?? 0,
        lastUpdatedAt: json['lastUpdatedAt'] as String?,
      );
}

class LocationService {
  final ApiClient _api;
  LocationService(this._api);

  Future<BatchUploadResult> uploadBatch({
    required String attendanceId,
    required String deviceId,
    required List<LocationPointDto> points,
  }) async {
    final json = await _api.post(
      '/mobile/attendance/$attendanceId/location-points/batch',
      body: {
        'deviceId': deviceId,
        'points': points.map((p) => p.toJson()).toList(),
      },
    );
    return BatchUploadResult.fromJson(json['data'] as Map<String, dynamic>);
  }
}
