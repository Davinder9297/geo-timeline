import 'dart:async';
import 'package:flutter/material.dart';
import 'package:mobile_tracker/core/utils/geo_utils.dart';

/// Ticks itself every second with a local Timer instead of listening to
/// TrackerProvider, so the live "current session" clock updates smoothly
/// without forcing the whole sidebar to rebuild on every tick (that
/// full-tree rebuild on every notifyListeners call, with no transition, was
/// the cause of the periodic UI "shake").
class LiveDurationText extends StatefulWidget {
  final DateTime checkInAt;
  final double breakSecondsSoFar;
  final TextStyle? style;

  const LiveDurationText({
    super.key,
    required this.checkInAt,
    required this.breakSecondsSoFar,
    this.style,
  });

  @override
  State<LiveDurationText> createState() => _LiveDurationTextState();
}

class _LiveDurationTextState extends State<LiveDurationText> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final elapsedSeconds = DateTime.now().difference(widget.checkInAt).inSeconds - widget.breakSecondsSoFar;
    return Text(
      formatWorkingTime(elapsedSeconds < 0 ? 0 : elapsedSeconds),
      style: widget.style,
    );
  }
}
