import 'package:flutter_foreground_task/flutter_foreground_task.dart';

/// Minimal task handler — its only job is to exist so Android/iOS keep the
/// app process (and therefore the real GPS stream + upload pipeline running
/// in the main isolate, see TrackerProvider) alive in the background. It
/// does not itself capture location; that stays in TrackerProvider so the
/// existing queue/batch/retry logic doesn't need to move to a background
/// isolate.
class TrackerTaskHandler extends TaskHandler {
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {}

  @override
  void onRepeatEvent(DateTime timestamp) {}

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {}
}

Future<void> initForegroundTask() async {
  FlutterForegroundTask.init(
    androidNotificationOptions: AndroidNotificationOptions(
      channelId: 'geo_timeline_tracking',
      channelName: 'Location Tracking',
      channelDescription: 'Shown while your work session is being tracked.',
      onlyAlertOnce: true,
    ),
    iosNotificationOptions: const IOSNotificationOptions(),
    foregroundTaskOptions: ForegroundTaskOptions(
      eventAction: ForegroundTaskEventAction.repeat(60000),
      autoRunOnBoot: false,
      allowWakeLock: true,
      allowWifiLock: false,
    ),
  );
}

Future<void> startForegroundTracking() async {
  if (await FlutterForegroundTask.isRunningService) return;
  await FlutterForegroundTask.startService(
    notificationTitle: 'Tracking active',
    notificationText: 'Your location is being tracked for this work session.',
    callback: startCallback,
  );
}

Future<void> stopForegroundTracking() async {
  await FlutterForegroundTask.stopService();
}

/// Refreshes the persistent notification's text with live stats — called
/// periodically (alongside the batch upload) and right after check-in, so
/// the notification reflects current numbers without the user opening the
/// app.
Future<void> updateForegroundNotification({
  required String currentSessionTime,
  required String currentSessionDistance,
  required String totalTodayTime,
  required String totalTodayDistance,
}) async {
  if (!await FlutterForegroundTask.isRunningService) return;
  await FlutterForegroundTask.updateService(
    notificationTitle: 'Tracking · $currentSessionTime this session',
    notificationText:
        'Session: $currentSessionTime, $currentSessionDistance  ·  Today: $totalTodayTime, $totalTodayDistance',
  );
}

@pragma('vm:entry-point')
void startCallback() {
  FlutterForegroundTask.setTaskHandler(TrackerTaskHandler());
}
