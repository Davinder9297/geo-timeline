import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile_tracker/features/auth/auth_screen.dart';
import 'package:mobile_tracker/features/home/home_screen.dart';
import 'package:mobile_tracker/providers/tracker_provider.dart';
import 'package:mobile_tracker/widgets/loading_view.dart';

class MobileTrackerApp extends StatelessWidget {
  const MobileTrackerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => TrackerProvider(),
      child: MaterialApp(
        title: 'Employee Location Tracking',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          brightness: Brightness.dark,
          scaffoldBackgroundColor: const Color(0xFF020617),
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF22D3EE),
            brightness: Brightness.dark,
          ),
        ),
        home: const _RootGate(),
      ),
    );
  }
}

class _RootGate extends StatelessWidget {
  const _RootGate();

  @override
  Widget build(BuildContext context) {
    final tracker = context.watch<TrackerProvider>();
    if (!tracker.isHydrated) return const LoadingView();
    if (tracker.user == null) return const AuthScreen();
    return const HomeScreen();
  }
}
