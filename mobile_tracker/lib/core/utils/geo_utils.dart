import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Mirrors trackers/src/utils.ts haversineDistance.
double haversineDistanceMeters(
  double lat1,
  double lon1,
  double lat2,
  double lon2,
) {
  const r = 6371000.0; // Earth radius in meters
  final phi1 = lat1 * math.pi / 180;
  final phi2 = lat2 * math.pi / 180;
  final dPhi = (lat2 - lat1) * math.pi / 180;
  final dLambda = (lon2 - lon1) * math.pi / 180;

  final a = math.sin(dPhi / 2) * math.sin(dPhi / 2) +
      math.cos(phi1) * math.cos(phi2) * math.sin(dLambda / 2) * math.sin(dLambda / 2);
  final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  return r * c;
}

/// Decodes a Google-encoded polyline into a list of (lat, lng) pairs.
/// Mirrors trackers/src/utils.ts decodePolyline.
List<List<double>> decodePolyline(String encoded) {
  final List<List<double>> points = [];
  int index = 0;
  int lat = 0;
  int lng = 0;

  while (index < encoded.length) {
    int shift = 0;
    int result = 0;
    int byte;
    do {
      byte = encoded.codeUnitAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    final deltaLat = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.codeUnitAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    final deltaLng = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    points.add([lat / 1e5, lng / 1e5]);
  }
  return points;
}

String formatWorkingTime(double seconds) {
  final totalSecs = seconds.round();
  final hrs = totalSecs ~/ 3600;
  final mins = (totalSecs % 3600) ~/ 60;
  return '${hrs}h ${mins}m';
}

String formatDistanceMeters(double meters) {
  if (meters < 1000) return '${meters.toStringAsFixed(0)} m';
  return '${(meters / 1000).toStringAsFixed(2)} km';
}

const List<Color> sessionColors = [
  Color(0xFF2196F3),
  Color(0xFF9C27B0),
  Color(0xFF009688),
  Color(0xFFFF9800),
  Color(0xFFE91E63),
  Color(0xFF3F51B5),
];

Color getSessionColor(int index) =>
    sessionColors[index % sessionColors.length];
