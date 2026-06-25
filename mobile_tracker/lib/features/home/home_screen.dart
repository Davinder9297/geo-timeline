import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:mobile_tracker/core/utils/geo_utils.dart';
import 'package:mobile_tracker/features/map/tracker_map_screen.dart';
import 'package:mobile_tracker/features/sidebar/sidebar_panel.dart';
import 'package:mobile_tracker/providers/tracker_provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _selectedSessionId;
  MapViewMode _viewMode = MapViewMode.route;
  int _tabIndex = 0; // 0 = map, 1 = panel

  String? _lastTimelineKey;

  @override
  Widget build(BuildContext context) {
    final tracker = context.watch<TrackerProvider>();
    final today = DateTime.now().toIso8601String().split('T')[0];

    // Default the selected session to the currently-open one (or most
    // recent) whenever the timeline for the chosen date (re)loads —
    // mirrors the equivalent effect in trackers/src/app/page.tsx.
    final timelineKey = '${tracker.selectedTimelineDate}-${tracker.timeline?.attendance.sessions.length ?? 0}';
    if (timelineKey != _lastTimelineKey) {
      _lastTimelineKey = timelineKey;
      final sessions = tracker.timeline?.attendance.sessions ?? [];
      if (sessions.isEmpty) {
        _selectedSessionId = null;
      } else {
        final open = sessions.where((s) => s.checkOutAt == null);
        _selectedSessionId = (open.isNotEmpty ? open.first : sessions.last).sessionId;
      }
    }

    final sessions = tracker.timeline?.attendance.sessions ?? [];
    final sessionIdx = sessions.indexWhere((s) => s.sessionId == _selectedSessionId);
    final selectedSession = sessionIdx >= 0 ? sessions[sessionIdx] : null;
    final sessionColor = getSessionColor(sessionIdx >= 0 ? sessionIdx : 0);
    final isToday = tracker.selectedTimelineDate == today;

    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        backgroundColor: const Color(0xFF020617),
        elevation: 0,
        titleSpacing: 12,
        title: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(6),
                gradient: const LinearGradient(colors: [Color(0xFF22D3EE), Color(0xFF8B5CF6)]),
              ),
            ),
            const SizedBox(width: 8),
            const Text('ELTS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
          ],
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(0),
          child: Container(height: 1, color: Colors.white10),
        ),
      ),
      body: IndexedStack(
        index: _tabIndex,
        children: [
          Stack(
            children: [
              TrackerMapScreen(
                timeline: tracker.timeline,
                selectedSessionId: _selectedSessionId,
                currentLocation: isToday ? tracker.currentLocation : null,
                viewMode: _viewMode,
                onViewModeChanged: (m) => setState(() => _viewMode = m),
              ),
              if (selectedSession != null)
                Positioned(
                  top: 12,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A).withOpacity(0.85),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.1)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(shape: BoxShape.circle, color: sessionColor),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Session ${sessionIdx + 1} · '
                          '${DateFormat('h:mm a').format(DateTime.parse(selectedSession.checkInAt))} – '
                          '${selectedSession.checkOutAt != null ? DateFormat('h:mm a').format(DateTime.parse(selectedSession.checkOutAt!)) : "now"}',
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ),
              if (tracker.currentLocation != null && isToday)
                Positioned(
                  bottom: 16,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A).withOpacity(0.85),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.1)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.circle, size: 8, color: Color(0xFF60A5FA)),
                        SizedBox(width: 8),
                        Text('Live location', style: TextStyle(color: Colors.white70, fontSize: 12)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          SidebarPanel(
            selectedSessionId: _selectedSessionId,
            onSelectSession: (id) => setState(() => _selectedSessionId = id),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        backgroundColor: const Color(0xFF020617),
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map), label: 'Map'),
          NavigationDestination(icon: Icon(Icons.menu), selectedIcon: Icon(Icons.menu_open), label: 'Panel'),
        ],
      ),
    );
  }
}
