import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_tracker/app.dart';

void main() {
  testWidgets('App boots and shows the loading screen before hydration', (tester) async {
    await tester.pumpWidget(const MobileTrackerApp());
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
