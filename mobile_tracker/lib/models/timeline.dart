import 'attendance.dart';

class RawLocationPoint {
  final double latitude;
  final double longitude;
  final int sequenceNo;
  final String capturedAt;
  final String sessionId;

  const RawLocationPoint({
    required this.latitude,
    required this.longitude,
    required this.sequenceNo,
    required this.capturedAt,
    required this.sessionId,
  });

  factory RawLocationPoint.fromJson(Map<String, dynamic> json) =>
      RawLocationPoint(
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        sequenceNo: json['sequenceNo'] as int,
        capturedAt: json['capturedAt'] as String,
        sessionId: json['sessionId'] as String? ?? '',
      );
}

/// De-noised point backing encodedProcessedPolyline (quality-filtered,
/// jitter-filtered, Douglas-Peucker simplified, simplified per-session on
/// the backend). Prefer this over raw points when drawing the route.
class ProcessedPoint {
  final double latitude;
  final double longitude;
  final String capturedAt;
  final String sessionId;

  const ProcessedPoint({
    required this.latitude,
    required this.longitude,
    required this.capturedAt,
    required this.sessionId,
  });

  factory ProcessedPoint.fromJson(Map<String, dynamic> json) =>
      ProcessedPoint(
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        capturedAt: json['capturedAt'] as String,
        sessionId: json['sessionId'] as String? ?? '',
      );
}

class ProcessedRoute {
  final String encodedProcessedPolyline;
  final String encodedRawPolyline;
  final List<ProcessedPoint> points;

  const ProcessedRoute({
    required this.encodedProcessedPolyline,
    required this.encodedRawPolyline,
    this.points = const [],
  });

  factory ProcessedRoute.fromJson(Map<String, dynamic> json) =>
      ProcessedRoute(
        encodedProcessedPolyline: json['encodedProcessedPolyline'] as String? ?? '',
        encodedRawPolyline: json['encodedRawPolyline'] as String? ?? '',
        points: (json['points'] as List<dynamic>? ?? [])
            .map((p) => ProcessedPoint.fromJson(p as Map<String, dynamic>))
            .toList(),
      );
}

class TimelineTotals {
  final double rawDistanceMeters;
  final double processedDistanceMeters;
  final double workingSeconds;
  final double breakSeconds;
  final double movingSeconds;
  final double holdSeconds;
  final double dataGapSeconds;
  final double gpsQualityScore;

  const TimelineTotals({
    required this.rawDistanceMeters,
    required this.processedDistanceMeters,
    required this.workingSeconds,
    required this.breakSeconds,
    required this.movingSeconds,
    required this.holdSeconds,
    required this.dataGapSeconds,
    required this.gpsQualityScore,
  });

  factory TimelineTotals.fromJson(Map<String, dynamic> json) => TimelineTotals(
        rawDistanceMeters: (json['rawDistanceMeters'] as num? ?? 0).toDouble(),
        processedDistanceMeters:
            (json['processedDistanceMeters'] as num? ?? 0).toDouble(),
        workingSeconds: (json['workingSeconds'] as num? ?? 0).toDouble(),
        breakSeconds: (json['breakSeconds'] as num? ?? 0).toDouble(),
        movingSeconds: (json['movingSeconds'] as num? ?? 0).toDouble(),
        holdSeconds: (json['holdSeconds'] as num? ?? 0).toDouble(),
        dataGapSeconds: (json['dataGapSeconds'] as num? ?? 0).toDouble(),
        gpsQualityScore: (json['gpsQualityScore'] as num? ?? 0).toDouble(),
      );
}

class TimelineResponse {
  final AttendanceDaily attendance;
  final int rawPointsCount;
  final List<RawLocationPoint> rawPoints;
  final bool summaryAvailable;
  final ProcessedRoute? processedRoute;
  final TimelineTotals? totals;

  const TimelineResponse({
    required this.attendance,
    required this.rawPointsCount,
    required this.rawPoints,
    required this.summaryAvailable,
    this.processedRoute,
    this.totals,
  });

  factory TimelineResponse.fromJson(Map<String, dynamic> json) =>
      TimelineResponse(
        attendance:
            AttendanceDaily.fromJson(json['attendance'] as Map<String, dynamic>),
        rawPointsCount: json['rawPointsCount'] as int? ?? 0,
        rawPoints: (json['rawPoints'] as List<dynamic>? ?? [])
            .map((p) => RawLocationPoint.fromJson(p as Map<String, dynamic>))
            .toList(),
        summaryAvailable: json['summaryAvailable'] as bool? ?? false,
        processedRoute: json['processedRoute'] != null
            ? ProcessedRoute.fromJson(json['processedRoute'] as Map<String, dynamic>)
            : null,
        totals: json['totals'] != null
            ? TimelineTotals.fromJson(json['totals'] as Map<String, dynamic>)
            : null,
      );
}
