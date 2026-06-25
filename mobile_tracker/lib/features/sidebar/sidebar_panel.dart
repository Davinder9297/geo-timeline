import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:mobile_tracker/core/utils/geo_utils.dart';
import 'package:mobile_tracker/features/sidebar/stats_panel.dart';
import 'package:mobile_tracker/providers/tracker_provider.dart';

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

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).take(2);
    final letters = parts.map((p) => p[0].toUpperCase()).join();
    return letters.isEmpty ? '?' : letters;
  }

  Future<void> _checkIn(TrackerProvider tracker) async {
    setState(() => _error = null);
    try {
      await tracker.createAttendance();
    } catch (e) {
      setState(() => _error = '$e');
    }
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
                              child: _MiniStat(
                                label: 'Distance',
                                value: '${(tracker.totalDistance / 1000).toStringAsFixed(2)} km',
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
                              label: 'Working',
                              value: formatWorkingTime(tracker.timeline!.totals!.workingSeconds),
                            ),
                          ),
                          Expanded(
                            child: _MiniStat(
                              label: 'Break',
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
                              style: const TextStyle(color: Colors.white54, fontSize: 11)),
                          Text(
                            'Last sync: ${tracker.lastSyncTime != null ? DateFormat('h:mm:ss a').format(tracker.lastSyncTime!) : "Never"}',
                            style: const TextStyle(color: Colors.white54, fontSize: 11),
                          ),
                          if (tracker.lastError != null)
                            Text(tracker.lastError!, style: const TextStyle(color: Color(0xFFFB7185), fontSize: 11)),
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
  final String value;
  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label.toUpperCase(),
            style: const TextStyle(color: Colors.white38, fontSize: 10, letterSpacing: 0.5)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
      ],
    );
  }
}

class _SessionTile extends StatelessWidget {
  final int index;
  final String checkInAt;
  final String? checkOutAt;
  final bool isSelected;
  final VoidCallback onTap;
  const _SessionTile({
    required this.index,
    required this.checkInAt,
    required this.checkOutAt,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('h:mm a');
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
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Text('${index + 1}', style: const TextStyle(color: Colors.white38, fontSize: 11)),
                const SizedBox(width: 8),
                Text(
                  '${fmt.format(DateTime.parse(checkInAt))} – ${checkOutAt != null ? fmt.format(DateTime.parse(checkOutAt!)) : "now"}',
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ],
            ),
            if (checkOutAt == null)
              const Text('ACTIVE',
                  style: TextStyle(color: Color(0xFF34D399), fontSize: 10, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
