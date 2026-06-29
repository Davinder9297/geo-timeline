import 'dart:io';
import 'package:path_provider/path_provider.dart';

/// Append-only log of every GPS fix and what the anchor/confirmation
/// algorithm decided to do with it, written to a plain text file on device
/// so a "why did distance go up while I was standing still" report can be
/// diagnosed after the fact instead of needing a live debugger attached.
class GpsDebugLog {
  static File? _file;
  static bool _initFailed = false;

  static Future<File?> _getFile() async {
    if (_file != null) return _file;
    if (_initFailed) return null;
    try {
      final dir = await getApplicationDocumentsDirectory();
      _file = File('${dir.path}/gps_debug_log.txt');
      return _file;
    } catch (_) {
      _initFailed = true;
      return null;
    }
  }

  static Future<void> log(String message) async {
    final file = await _getFile();
    if (file == null) return;
    final line = '${DateTime.now().toIso8601String()}  $message\n';
    try {
      await file.writeAsString(line, mode: FileMode.append, flush: true);
    } catch (_) {
      // Disk full / permission issue — logging is best-effort, never let
      // it take down location tracking.
    }
  }

  static Future<String> readAll() async {
    final file = await _getFile();
    if (file == null || !await file.exists()) return '(no log file yet)';
    return file.readAsString();
  }

  static Future<void> clear() async {
    final file = await _getFile();
    if (file == null) return;
    if (await file.exists()) await file.writeAsString('');
  }

  static Future<String?> path() async {
    final file = await _getFile();
    return file?.path;
  }
}
