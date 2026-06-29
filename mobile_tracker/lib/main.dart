import 'package:flutter/material.dart';
import 'package:mobile_tracker/app.dart';
import 'package:mobile_tracker/core/foreground_task_handler.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initForegroundTask();
  runApp(const MobileTrackerApp());
}
