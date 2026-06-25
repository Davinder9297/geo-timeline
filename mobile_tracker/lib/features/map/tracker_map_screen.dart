import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as gmaps;
import 'package:mobile_tracker/core/utils/geo_utils.dart';
import 'package:mobile_tracker/models/timeline.dart';
import 'package:mobile_tracker/providers/tracker_provider.dart' as tp;

enum MapViewMode { route, sequence }

class TrackerMapScreen extends StatefulWidget {
  final TimelineResponse? timeline;
  final String? selectedSessionId;
  final tp.LatLng? currentLocation;
  final MapViewMode viewMode;
  final ValueChanged<MapViewMode> onViewModeChanged;

  const TrackerMapScreen({
    super.key,
    required this.timeline,
    required this.selectedSessionId,
    required this.currentLocation,
    required this.viewMode,
    required this.onViewModeChanged,
  });

  @override
  State<TrackerMapScreen> createState() => _TrackerMapScreenState();
}

class _TrackerMapScreenState extends State<TrackerMapScreen> {
  final Completer<gmaps.GoogleMapController> _controller = Completer();
  static const gmaps.LatLng _defaultCenter = gmaps.LatLng(20.5937, 78.9629);

  @override
  void didUpdateWidget(TrackerMapScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.timeline != widget.timeline ||
        oldWidget.selectedSessionId != widget.selectedSessionId) {
      _fitToContent();
    }
  }

  List<String> _sessionOrder() {
    final order = <String>[];
    for (final p in widget.timeline?.rawPoints ?? <RawLocationPoint>[]) {
      if (p.sessionId.isNotEmpty && !order.contains(p.sessionId)) order.add(p.sessionId);
    }
    return order;
  }

  /// Prefer the de-noised processed points (quality-filtered, jitter-
  /// filtered, Douglas-Peucker simplified per session) over raw points,
  /// same reasoning as the admin dashboard's Map.tsx — raw points still
  /// carry GPS noise and zigzag visibly even when walking/driving straight.
  List<gmaps.LatLng> _pathForSession(String sessionId, List<String> sessionOrder) {
    final processed = widget.timeline?.processedRoute?.points ?? const <ProcessedPoint>[];
    if (processed.isNotEmpty) {
      final filtered = processed.where((p) => p.sessionId == sessionId).toList()
        ..sort((a, b) => a.capturedAt.compareTo(b.capturedAt));
      if (filtered.isNotEmpty) {
        return filtered.map((p) => gmaps.LatLng(p.latitude, p.longitude)).toList();
      }
    }
    return (widget.timeline?.rawPoints ?? const <RawLocationPoint>[])
        .where((p) => p.sessionId == sessionId)
        .map((p) => gmaps.LatLng(p.latitude, p.longitude))
        .toList();
  }

  Set<gmaps.Polyline> _buildPolylines() {
    final sessionOrder = _sessionOrder();
    final polylines = <gmaps.Polyline>{};

    if (sessionOrder.isEmpty) {
      final encoded = widget.timeline?.processedRoute?.encodedProcessedPolyline;
      if (encoded != null && encoded.isNotEmpty) {
        final path = decodePolyline(encoded).map((p) => gmaps.LatLng(p[0], p[1])).toList();
        polylines.add(gmaps.Polyline(
          polylineId: const gmaps.PolylineId('fallback'),
          points: path,
          color: const Color(0xFF2196F3),
          width: 4,
        ));
      }
      return polylines;
    }

    for (var i = 0; i < sessionOrder.length; i++) {
      final sessionId = sessionOrder[i];
      if (widget.selectedSessionId != null && widget.selectedSessionId != sessionId) {
        continue; // only draw the selected session, mirrors the dimmed/hidden behavior
      }
      final path = _pathForSession(sessionId, sessionOrder);
      if (path.isEmpty) continue;
      polylines.add(gmaps.Polyline(
        polylineId: gmaps.PolylineId(sessionId),
        points: path,
        color: getSessionColor(i),
        width: 4,
      ));
    }
    return polylines;
  }

  Set<gmaps.Marker> _buildMarkers() {
    final markers = <gmaps.Marker>{};

    if (widget.currentLocation != null) {
      markers.add(gmaps.Marker(
        markerId: const gmaps.MarkerId('live'),
        position: gmaps.LatLng(widget.currentLocation!.lat, widget.currentLocation!.lng),
        icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(gmaps.BitmapDescriptor.hueBlue),
        infoWindow: const gmaps.InfoWindow(title: 'You are here'),
      ));
    }

    if (widget.viewMode == MapViewMode.sequence) {
      final sessionOrder = _sessionOrder();
      for (final p in widget.timeline?.rawPoints ?? const <RawLocationPoint>[]) {
        if (widget.selectedSessionId != null && widget.selectedSessionId != p.sessionId) continue;
        final idx = sessionOrder.indexOf(p.sessionId);
        markers.add(gmaps.Marker(
          markerId: gmaps.MarkerId('seq-${p.sessionId}-${p.sequenceNo}'),
          position: gmaps.LatLng(p.latitude, p.longitude),
          icon: gmaps.BitmapDescriptor.defaultMarkerWithHue(_hueForIndex(idx)),
          infoWindow: gmaps.InfoWindow(title: 'Point #${p.sequenceNo}', snippet: p.capturedAt),
        ));
      }
    }

    return markers;
  }

  double _hueForIndex(int idx) {
    const hues = [
      gmaps.BitmapDescriptor.hueBlue,
      gmaps.BitmapDescriptor.hueViolet,
      gmaps.BitmapDescriptor.hueGreen,
      gmaps.BitmapDescriptor.hueOrange,
      gmaps.BitmapDescriptor.hueRose,
      gmaps.BitmapDescriptor.hueAzure,
    ];
    return hues[idx < 0 ? 0 : idx % hues.length];
  }

  Future<void> _fitToContent() async {
    if (!_controller.isCompleted) return;
    final controller = await _controller.future;

    if (widget.selectedSessionId != null) {
      final sessionOrder = _sessionOrder();
      final path = _pathForSession(widget.selectedSessionId!, sessionOrder);
      if (path.isNotEmpty) {
        await controller.animateCamera(gmaps.CameraUpdate.newLatLngZoom(path.first, 16));
        return;
      }
    }

    final allPoints = (widget.timeline?.rawPoints ?? const <RawLocationPoint>[])
        .map((p) => gmaps.LatLng(p.latitude, p.longitude))
        .toList();
    if (allPoints.isEmpty) return;
    if (allPoints.length == 1) {
      await controller.animateCamera(gmaps.CameraUpdate.newLatLngZoom(allPoints.first, 15));
      return;
    }
    final bounds = _boundsFor(allPoints);
    await controller.animateCamera(gmaps.CameraUpdate.newLatLngBounds(bounds, 48));
  }

  gmaps.LatLngBounds _boundsFor(List<gmaps.LatLng> points) {
    var minLat = points.first.latitude, maxLat = points.first.latitude;
    var minLng = points.first.longitude, maxLng = points.first.longitude;
    for (final p in points) {
      minLat = p.latitude < minLat ? p.latitude : minLat;
      maxLat = p.latitude > maxLat ? p.latitude : maxLat;
      minLng = p.longitude < minLng ? p.longitude : minLng;
      maxLng = p.longitude > maxLng ? p.longitude : maxLng;
    }
    return gmaps.LatLngBounds(
      southwest: gmaps.LatLng(minLat, minLng),
      northeast: gmaps.LatLng(maxLat, maxLng),
    );
  }

  Future<void> _goToLiveLocation() async {
    if (!_controller.isCompleted || widget.currentLocation == null) return;
    final controller = await _controller.future;
    await controller.animateCamera(gmaps.CameraUpdate.newLatLngZoom(
      gmaps.LatLng(widget.currentLocation!.lat, widget.currentLocation!.lng),
      17,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        gmaps.GoogleMap(
          initialCameraPosition: const gmaps.CameraPosition(target: _defaultCenter, zoom: 5),
          onMapCreated: (controller) {
            _controller.complete(controller);
            _fitToContent();
          },
          polylines: _buildPolylines(),
          markers: _buildMarkers(),
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
        ),
        Positioned(
          top: 12,
          right: 12,
          child: _ViewModeToggle(mode: widget.viewMode, onChanged: widget.onViewModeChanged),
        ),
        if (widget.currentLocation != null)
          Positioned(
            bottom: 16,
            right: 16,
            child: FloatingActionButton.small(
              onPressed: _goToLiveLocation,
              backgroundColor: const Color(0xFF0F172A),
              child: const Icon(Icons.my_location, color: Color(0xFF60A5FA)),
            ),
          ),
      ],
    );
  }
}

class _ViewModeToggle extends StatelessWidget {
  final MapViewMode mode;
  final ValueChanged<MapViewMode> onChanged;
  const _ViewModeToggle({required this.mode, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A).withOpacity(0.85),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _ToggleButton(label: 'Route', selected: mode == MapViewMode.route, onTap: () => onChanged(MapViewMode.route)),
          _ToggleButton(
              label: 'Sequence', selected: mode == MapViewMode.sequence, onTap: () => onChanged(MapViewMode.sequence)),
        ],
      ),
    );
  }
}

class _ToggleButton extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _ToggleButton({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? Colors.white.withOpacity(0.1) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label, style: TextStyle(color: selected ? Colors.white : Colors.white38, fontSize: 12)),
      ),
    );
  }
}
