import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile_tracker/core/utils/geo_utils.dart';
import 'package:mobile_tracker/models/stats.dart';

class StatsPanel extends StatelessWidget {
  final List<EmployeeStatsDay>? stats;
  final bool loading;
  const StatsPanel({super.key, required this.stats, required this.loading});

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return _Card(
        child: const Text('Loading stats…', style: TextStyle(color: Colors.white38, fontSize: 12)),
      );
    }
    final data = stats;
    if (data == null || data.isEmpty) return const SizedBox.shrink();

    final today = data.last;
    final totalWeekSeconds = data.fold<double>(0, (sum, d) => sum + d.workingSeconds);
    final totalWeekDistance = data.fold<double>(0, (sum, d) => sum + d.distanceMeters);

    return Column(
      children: [
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('WORKING HOURS',
                      style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600)),
                  Text('${formatWorkingTime(totalWeekSeconds)} / 7d',
                      style: const TextStyle(color: Colors.white38, fontSize: 11)),
                ],
              ),
              const SizedBox(height: 8),
              _BarChart(
                data: data,
                valueOf: (d) => d.workingSeconds,
                colors: const [Color(0xFF22D3EE), Color(0xFF818CF8)],
              ),
              const SizedBox(height: 4),
              Text(formatWorkingTime(today.workingSeconds),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)
                      .merge(const TextStyle(fontFeatures: [FontFeature.tabularFigures()]))),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('DISTANCE',
                      style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600)),
                  Text('${formatDistanceMeters(totalWeekDistance)} / 7d',
                      style: const TextStyle(color: Colors.white38, fontSize: 11)),
                ],
              ),
              const SizedBox(height: 8),
              _BarChart(
                data: data,
                valueOf: (d) => d.distanceMeters,
                colors: const [Color(0xFF34D399), Color(0xFF22D3EE)],
              ),
              const SizedBox(height: 4),
              Text(formatDistanceMeters(today.distanceMeters),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)
                      .merge(const TextStyle(fontFeatures: [FontFeature.tabularFigures()]))),
            ],
          ),
        ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: child,
    );
  }
}

class _BarChart extends StatelessWidget {
  final List<EmployeeStatsDay> data;
  final double Function(EmployeeStatsDay) valueOf;
  final List<Color> colors;
  const _BarChart({required this.data, required this.valueOf, required this.colors});

  @override
  Widget build(BuildContext context) {
    final maxValue = data.map(valueOf).fold<double>(1, (m, v) => v > m ? v : m);
    return SizedBox(
      height: 80,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < data.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: _Bar(
                heightFraction: valueOf(data[i]) / maxValue,
                isToday: i == data.length - 1,
                colors: colors,
                label: DateFormat('E').format(DateTime.parse(data[i].date))[0],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  final double heightFraction;
  final bool isToday;
  final List<Color> colors;
  final String label;
  const _Bar({
    required this.heightFraction,
    required this.isToday,
    required this.colors,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Expanded(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: TweenAnimationBuilder<double>(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOut,
              tween: Tween(begin: 0.02, end: heightFraction.clamp(0.02, 1.0)),
              builder: (context, animatedHeight, _) => FractionallySizedBox(
                heightFactor: animatedHeight,
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4),
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: colors,
                    ),
                  ),
                  margin: const EdgeInsets.symmetric(horizontal: 1),
                ).withOpacity(isToday ? 1 : 0.4),
              ),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 9)),
      ],
    );
  }
}

extension on Container {
  Widget withOpacity(double opacity) => Opacity(opacity: opacity, child: this);
}
