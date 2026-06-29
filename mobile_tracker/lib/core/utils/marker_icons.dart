import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

/// google_maps_flutter has no built-in "numbered marker" support (unlike the
/// JS Maps SDK used on the web tracker) — a label has to be baked into a
/// bitmap ourselves. Cached by (number, color) since regenerating the same
/// bitmap per rebuild would be wasteful and markers redraw often while
/// polling.
class NumberedMarkerIcons {
  static final Map<String, BitmapDescriptor> _cache = {};

  static Future<BitmapDescriptor> get(int number, Color color) async {
    final key = '$number-${color.value}';
    final cached = _cache[key];
    if (cached != null) return cached;

    final icon = await _render(number, color);
    _cache[key] = icon;
    return icon;
  }

  static Future<BitmapDescriptor> _render(int number, Color color) async {
    const double size = 64;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder, const Rect.fromLTWH(0, 0, size, size));

    final paint = Paint()..color = color;
    canvas.drawCircle(const Offset(size / 2, size / 2), size / 2 - 2, paint);
    canvas.drawCircle(
      const Offset(size / 2, size / 2),
      size / 2 - 2,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );

    final textPainter = TextPainter(
      text: TextSpan(
        text: '$number',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 26,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    textPainter.paint(
      canvas,
      Offset((size - textPainter.width) / 2, (size - textPainter.height) / 2),
    );

    final picture = recorder.endRecording();
    final image = await picture.toImage(size.toInt(), size.toInt());
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    return BitmapDescriptor.bytes(Uint8List.view(bytes!.buffer));
  }
}
