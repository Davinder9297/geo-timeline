import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:mobile_tracker/core/gps_debug_log.dart';
import 'package:mobile_tracker/core/utils/geo_utils.dart';
import 'package:mobile_tracker/features/sidebar/live_duration_text.dart';
import 'package:mobile_tracker/features/sidebar/stats_panel.dart';
import 'package:mobile_tracker/providers/tracker_provider.dart';

const _tabularFigures = TextStyle(fontFeatures: [FontFeature.tabularFigures()]);

class SidebarPanel extends StatefulWidget {
  final String? selectedSessionId;
  final ValueChanged<String> onSelectSession;
  const SidebarPanel({super.key, required this.selectedSessionId, required this.onSelectSession});

  @override
  State<SidebarPanel> createState() => _SidebarPanelState();
}

class _SidebarPanelState extends State<SidebarPanel> {
  String? _error;
  bool _showDiagnostics = false;

  /// Same denoised-over-raw preference as the map screen's per-session
  /// path lookup — historical sessions have no server-computed distance
  /// field, so it's derived here from whichever point set is available.
  double _distanceForSession(TrackerProvider tracker, String sessionId) {
    final processed = (tracker.timeline?.processedRoute?.points ?? const [])
        .where((p) => p.sessionId == sessionId)
        .toList()
      ..sort((a, b) => a.capturedAt.compareTo(b.capturedAt));
    final points = processed.isNotEmpty
        ? processed.map((p) => [p.latitude, p.longitude]).toList()
        : ((tracker.timeline?.rawPoints ?? const [])
                .where((p) => p.sessionId == sessionId)
                .toList()
              ..sort((a, b) => a.capturedAt.compareTo(b.capturedAt)))
            .map((p) => [p.latitude, p.longitude])
            .toList();
    return routeDistanceMeters(points);
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).take(2);
    final letters = parts.map((p) => p[0].toUpperCase()).join();
    return letters.isEmpty ? '?' : letters;
  }

  Future<void> _checkIn(TrackerProvider tracker) async {
    setState(() => _error = null);
    try {
      await tracker.createAttendance();
      await _promptDisableBatteryOptimization();
    } catch (e) {
      setState(() => _error = '$e');
    }
  }

  /// Android, especially on Samsung/Xiaomi/Oppo/etc., kills background
  /// services under battery optimization even with a foreground-service
  /// notification running. Asking the user to whitelist the app right after
  /// check-in is the point they're most motivated to say yes, since
  /// tracking is about to start.
  Future<void> _promptDisableBatteryOptimization() async {
    final alreadyIgnoring = await FlutterForegroundTask.isIgnoringBatteryOptimizations;
    if (alreadyIgnoring || !mounted) return;

    final shouldOpenSettings = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Keep tracking running in the background'),
        content: const Text(
          'Your phone\'s battery optimization can pause location tracking '
          'when the app is in the background, which means your route or '
          'working hours may not be recorded correctly.\n\n'
          'To prevent this, please allow this app to run without battery '
          'restrictions on the next screen.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Not now'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Allow'),
          ),
        ],
      ),
    );

    if (shouldOpenSettings == true) {
      await FlutterForegroundTask.requestIgnoreBatteryOptimization();
    }
  }

  Future<void> _showGpsLog() async {
    final content = await GpsDebugLog.readAll();
    final path = await GpsDebugLog.path();
    if (!mounted) return;
    await showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: const Color(0xFF0F172A),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('GPS debug log',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 4),
              if (path != null)
                Text(path, style: const TextStyle(color: Colors.white30, fontSize: 10)),
              const SizedBox(height: 12),
              Flexible(
                child: SingleChildScrollView(
                  child: SelectableText(
                    content,
                    style: const TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'monospace'),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Close'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _checkOut(TrackerProvider tracker) async {
    setState(() => _error = null);
    try {
      await tracker.checkOutAttendance();
    } catch (e) {
      setState(() => _error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final tracker = context.watch<TrackerProvider>();
    final user = tracker.user!;
    final today = DateTime.now().toIso8601String().split('T')[0];
    final isToday = tracker.selectedTimelineDate == today;

    final todayAttendance = tracker.attendances
        .where((a) => a.attendanceDate == today)
        .toList();
    final activeAttendance = tracker.selectedAttendance ?? (todayAttendance.isNotEmpty ? todayAttendance.first : null);
    final todaySessions = activeAttendance?.sessions ?? [];
    final hasOpenSession = todaySessions.isNotEmpty && todaySessions.last.checkOutAt == null;

    final dayAttendance = tracker.timeline?.attendance;
    final daySessions = dayAttendance?.sessions ?? [];

    return Container(
      color: const Color(0xFF020617),
      child: SafeArea(
        child: Column(
          children: [
            // Profile header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(colors: [Color(0xFF22D3EE), Color(0xFF8B5CF6)]),
                    ),
                    alignment: Alignment.center,
                    child: Text(_initials(user.name),
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user.name,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
                        Text(user.employeeId,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Colors.white38, fontSize: 11)),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: tracker.logout,
                    icon: const Icon(Icons.logout, size: 18, color: Colors.white54),
                    tooltip: 'Log out',
                  ),
                ],
              ),
            ),
            const Divider(color: Colors.white10, height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  if (_error != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.red.withOpacity(0.2)),
                      ),
                      child: Text(_error!, style: const TextStyle(color: Color(0xFFFB7185), fontSize: 12)),
                    ),

                  // Status hero
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white.withOpacity(0.1)),
                      color: Colors.white.withOpacity(0.04),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: hasOpenSession ? const Color(0xFF34D399) : Colors.white24,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              hasOpenSession ? 'LIVE · TRACKING' : 'OFF THE CLOCK',
                              style: const TextStyle(
                                  color: Colors.white60, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: hasOpenSession
                                ? (tracker.isCheckingOut ? null : () => _checkOut(tracker))
                                : (tracker.isCreatingAttendance ? null : () => _checkIn(tracker)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: hasOpenSession ? const Color(0xFFFB7185) : const Color(0xFF34D399),
                              foregroundColor: const Color(0xFF020617),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: Text(
                              hasOpenSession
                                  ? (tracker.isCheckingOut ? 'Checking out…' : 'Check Out')
                                  : (tracker.isCreatingAttendance ? 'Checking in…' : 'Check In'),
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: _MiniStat(label: 'Sessions today', value: '${todaySessions.length}'),
                            ),
                            Expanded(
                              child: hasOpenSession
                                  ? _MiniStat.live(
                                      label: 'Current session · time',
                                      child: LiveDurationText(
                                        checkInAt: DateTime.parse(todaySessions.last.checkInAt).toLocal(),
                                        breakSecondsSoFar: breakSecondsFor(todaySessions.last.breaks),
                                        style: const TextStyle(
                                            color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)
                                            .merge(_tabularFigures),
                                      ),
                                    )
                                  : const _MiniStat(label: 'Current session · time', value: '—'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _MiniStat(
                                label: 'Current session · distance',
                                value: '${(tracker.totalDistance / 1000).toStringAsFixed(2)} km',
                              ),
                            ),
                            Expanded(
                              child: _MiniStat(
                                label: 'Total today · distance',
                                value: formatDistanceMeters(
                                  tracker.timeline?.totals?.processedDistanceMeters ?? 0,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Date selector
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('BROWSE DAY',
                          style: TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.w600)),
                      if (!isToday)
                        TextButton(
                          onPressed: () => tracker.setSelectedTimelineDate(today),
                          child: const Text('Jump to today', style: TextStyle(color: Color(0xFF67E8F9), fontSize: 11)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  InkWell(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: DateTime.parse(tracker.selectedTimelineDate),
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now(),
                      );
                      if (picked != null) {
                        tracker.setSelectedTimelineDate(DateFormat('yyyy-MM-dd').format(picked));
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.white.withOpacity(0.1)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            DateFormat('MMM d, yyyy').format(DateTime.parse(tracker.selectedTimelineDate)),
                            style: const TextStyle(color: Colors.white, fontSize: 13),
                          ),
                          const Icon(Icons.calendar_today, size: 14, color: Colors.white38),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 16),

                  if (tracker.loadingTimeline)
                    const Text('Loading sessions…', style: TextStyle(color: Colors.white38, fontSize: 12)),
                  if (!tracker.loadingTimeline && tracker.errorTimeline != null)
                    Text(tracker.errorTimeline!, style: const TextStyle(color: Color(0xFFFB7185), fontSize: 12)),
                  if (!tracker.loadingTimeline && tracker.errorTimeline == null && daySessions.isEmpty)
                    Text(
                      '${user.name} ${isToday ? "has" : "had"} not checked in on '
                      '${DateFormat('MMM d, yyyy').format(DateTime.parse(tracker.selectedTimelineDate))}',
                      style: const TextStyle(color: Colors.white38, fontSize: 12),
                    ),
                  if (daySessions.isNotEmpty) ...[
                    Text(
                      'SESSIONS · ${DateFormat('MMM d').format(DateTime.parse(tracker.selectedTimelineDate))}',
                      style: const TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    for (var i = 0; i < daySessions.length; i++) ...[
                      _SessionTile(
                        index: i,
                        checkInAt: daySessions[i].checkInAt,
                        checkOutAt: daySessions[i].checkOutAt,
                        breakSeconds: breakSecondsFor(daySessions[i].breaks),
                        distanceMeters: _distanceForSession(tracker, daySessions[i].sessionId),
                        isSelected: widget.selectedSessionId == daySessions[i].sessionId,
                        onTap: () => widget.onSelectSession(daySessions[i].sessionId),
                      ),
                      const SizedBox(height: 6),
                    ],
                  ],

                  if (tracker.timeline?.summaryAvailable == true && tracker.timeline?.totals != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withOpacity(0.1)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: _MiniStat(
                              label: 'Total today · working hours',
                              value: formatWorkingTime(tracker.timeline!.totals!.workingSeconds),
                            ),
                          ),
                          Expanded(
                            child: _MiniStat(
                              label: 'Total today · break time',
                              value: formatWorkingTime(tracker.timeline!.totals!.breakSeconds),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),
                  StatsPanel(stats: tracker.stats, loading: tracker.loadingStats),

                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => setState(() => _showDiagnostics = !_showDiagnostics),
                    child: Text(
                      '${_showDiagnostics ? "Hide" : "Show"} sync diagnostics',
                      style: const TextStyle(color: Colors.white30, fontSize: 11),
                    ),
                  ),
                  if (_showDiagnostics)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withOpacity(0.1)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Queued points: ${tracker.queue.length}',
                              style: const TextStyle(color: Colors.white54, fontSize: 11).merge(_tabularFigures)),
                          Text(
                            'Last sync: ${tracker.lastSyncTime != null ? DateFormat('h:mm:ss a').format(tracker.lastSyncTime!) : "Never"}',
                            style: const TextStyle(color: Colors.white54, fontSize: 11).merge(_tabularFigures),
                          ),
                          if (tracker.lastError != null)
                            Text(tracker.lastError!, style: const TextStyle(color: Color(0xFFFB7185), fontSize: 11)),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              TextButton(
                                onPressed: _showGpsLog,
                                style: TextButton.styleFrom(padding: EdgeInsets.zero),
                                child: const Text('View GPS debug log',
                                    style: TextStyle(color: Color(0xFF67E8F9), fontSize: 11)),
                              ),
                              const SizedBox(width: 12),
                              TextButton(
                                onPressed: () async {
                                  await GpsDebugLog.clear();
                                  if (mounted) setState(() {});
                                },
                                style: TextButton.styleFrom(padding: EdgeInsets.zero),
                                child: const Text('Clear', style: TextStyle(color: Colors.white30, fontSize: 11)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String? value;
  final Widget? child;
  const _MiniStat({required this.label, required String this.value}) : child = null;
  const _MiniStat.live({required this.label, required Widget this.child}) : value = null;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(),
            style: const TextStyle(color: Colors.white38, fontSize: 10, letterSpacing: 0.5)),
        const SizedBox(height: 2),
        child ??
            Text(
              value!,
              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)
                  .merge(_tabularFigures),
            ),
      ],
    );
  }
}

class _SessionTile extends StatelessWidget {
  final int index;
  final String checkInAt;
  final String? checkOutAt;
  final double breakSeconds;
  final double distanceMeters;
  final bool isSelected;
  final VoidCallback onTap;
  const _SessionTile({
    required this.index,
    required this.checkInAt,
    required this.checkOutAt,
    required this.breakSeconds,
    required this.distanceMeters,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('h:mm a');
    final checkIn = DateTime.parse(checkInAt).toLocal();
    final isOpen = checkOutAt == null;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF22D3EE).withOpacity(0.1) : Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? const Color(0xFF22D3EE).withOpacity(0.4) : Colors.white.withOpacity(0.1),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text('${index + 1}', style: const TextStyle(color: Colors.white38, fontSize: 11)),
                    const SizedBox(width: 8),
                    Text(
                      '${fmt.format(checkIn)} – ${checkOutAt != null ? fmt.format(DateTime.parse(checkOutAt!).toLocal()) : "now"}',
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                  ],
                ),
                if (isOpen)
                  const Text('ACTIVE',
                      style: TextStyle(color: Color(0xFF34D399), fontSize: 10, fontWeight: FontWeight.w600)),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.timer_outlined, size: 12, color: Colors.white38),
                const SizedBox(width: 4),
                isOpen
                    ? LiveDurationText(
                        checkInAt: checkIn,
                        breakSecondsSoFar: breakSeconds,
                        style: const TextStyle(color: Colors.white60, fontSize: 11).merge(_tabularFigures),
                      )
                    : Text(
                        formatWorkingTime(
                          DateTime.parse(checkOutAt!).toLocal().difference(checkIn).inSeconds - breakSeconds,
                        ),
                        style: const TextStyle(color: Colors.white60, fontSize: 11).merge(_tabularFigures),
                      ),
                const SizedBox(width: 14),
                const Icon(Icons.route_outlined, size: 12, color: Colors.white38),
                const SizedBox(width: 4),
                Text(
                  formatDistanceMeters(distanceMeters),
                  style: const TextStyle(color: Colors.white60, fontSize: 11).merge(_tabularFigures),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
