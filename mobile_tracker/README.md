# mobile_tracker — Flutter employee tracking app

Feature-equivalent mobile port of `trackers/` (the Next.js web tracker app),
talking to the same backend in `backend/`. Built against the same API
contracts, auth flow, GPS-jitter filtering logic, and route-rendering logic
already in the web app — see the inline comments referencing
`trackers/src/context/TrackerContext.tsx` and friends for exactly what each
file mirrors.

**Flutter is not installed on this machine, so none of this has been run or
compiled.** Everything below was written by hand against known Flutter/Dart
APIs. Follow the steps in order — `flutter pub get` and `flutter analyze`
(step 4) are the first real compile-checks this code will get, and there's a
reasonable chance you'll hit a small issue there (an outdated package
version pin, a renamed API in a newer plugin release, etc.) that needs a
one-line fix. That's normal for hand-written Flutter code that's never been
run; flag anything that comes up and it can be fixed quickly.

## Folder structure

```
mobile_tracker/
  lib/
    main.dart                    entry point
    app.dart                     MaterialApp + auth gate (logged out → AuthScreen, else → HomeScreen)
    core/
      config.dart                API base URL, batch/jitter-filter constants (mirrors config.ts)
      api_client.dart            thin http wrapper, auth header injection, error extraction
      storage_service.dart       shared_preferences wrapper (mirrors localStorage helpers)
      utils/
        geo_utils.dart           haversine distance, polyline decode, formatting, session colors
        id_generator.dart        uuid generation for clientPointId / deviceId
    models/                      plain Dart classes mirroring types.ts
    services/                    one class per API concern (auth, attendance, location, timeline, stats)
    providers/
      tracker_provider.dart      the core: auth + check-in/out + GPS queue/batch upload + polling
                                  (mirrors TrackerContext.tsx — deliberately one big provider,
                                  same reasoning as the web app: splitting it apart would just
                                  relocate the coupling between auth/attendance/tracking state)
    features/
      auth/auth_screen.dart      login/signup (mirrors AuthScreen in page.tsx)
      home/home_screen.dart      top bar + map/panel tabs (mirrors page.tsx's Home, tabbed instead
                                  of side-by-side since this is a phone, not a wide screen)
      sidebar/sidebar_panel.dart profile, check-in/out, date picker, sessions list, day summary,
                                  diagnostics (mirrors TrackerSidebar.tsx)
      sidebar/stats_panel.dart   7-day bar chart, hand-rolled like the web's SVG version — no
                                  extra chart dependency needed
      map/tracker_map_screen.dart Google Map: per-session polylines (de-noised processed points
                                  preferred over raw, same as the admin dashboard fix), live
                                  location marker, route/sequence view toggle (mirrors TrackerMap.tsx)
    widgets/                     small shared widgets
```

## What's faithfully ported vs. simplified

**Faithfully ported (same logic, not just same look):**
- Auth (login/signup), check-in/check-out, attendance list.
- The exact accuracy-aware GPS jitter filter from `TrackerContext.tsx`
  (`shouldAcceptPoint` → `_shouldAcceptPoint` in `tracker_provider.dart`),
  including the accuracy cap that stops one bad fix from poisoning later
  acceptance.
- Batch queue persisted locally, flushed on interval/size threshold, with
  retry-with-backoff on failure — same shape as the web app's queue.
- Timeline + 7-day stats, polled every 20s (same interval chosen for the web
  dashboard) so working hours/distance feel live.
- Route rendering prefers the backend's de-noised `processedRoute.points`
  over raw GPS points, same fix applied to the admin dashboard's map.

**Simplified (flagged, not silently dropped):**
- **No true background tracking.** `Geolocator.getPositionStream` keeps
  reporting while the app is foregrounded (and briefly backgrounded on most
  devices), but once the OS fully kills the app, tracking stops — same as
  closing the browser tab on the web version, but on mobile users expect
  tracking to survive being backgrounded for a full shift. Making that work
  reliably needs a native foreground service (Android) / background modes
  entitlement (iOS) wired up beyond what's in this pass — flag this if
  always-on tracking through app-switching/screen-off is a hard requirement,
  it's a real follow-up, not a "just enable a flag" change.
- **Sequence-mode markers** show the point number in a tap-to-open info
  window rather than printed directly on the pin (the web version draws a
  numbered circle). Functionally equivalent, just one extra tap.
- `isMocked` (mock-location detection) is read from `Position.isMocked` and
  sent to the backend like the web app sends it — but as noted earlier in
  this project, the backend doesn't actually enforce it yet either.

## Setup

### 1. Install Flutter

If you don't have it: https://docs.flutter.dev/get-started/install — pick
your OS, follow through to `flutter doctor` reporting no blocking issues
(Android Studio + an Android SDK is the minimum for Android; Xcode is
required additionally for iOS, Mac-only).

Verify:
```
flutter doctor
```

### 2. Generate the native platform folders

This repo only has `lib/` and `pubspec.yaml` — no `android/`/`ios/` folders,
since those need to be generated by your installed Flutter SDK version. From
inside `mobile_tracker/`:

```
cd mobile_tracker
flutter create .
```

This fills in `android/`, `ios/`, etc. around the existing `lib/` and
`pubspec.yaml` without touching them.

### 3. Add permissions and the Maps API key

**Android** — open `android/app/src/main/AndroidManifest.xml`, add inside
the `<manifest>` tag (siblings of `<application>`):
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```
And inside `<application>`, add your Maps API key:
```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_GOOGLE_MAPS_API_KEY" />
```

**iOS** — open `ios/Runner/Info.plist`, add:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to track attendance and routes while you're checked in.</string>
```
Open `ios/Runner/AppDelegate.swift` and add the Maps SDK key before
`GeneratedPluginRegistrant.register`:
```swift
GMSServices.provideAPIKey("YOUR_GOOGLE_MAPS_API_KEY")
```
(this requires `import GoogleMaps` at the top of that file).

Get a Maps API key from the Google Cloud Console with "Maps SDK for
Android" / "Maps SDK for iOS" enabled — same project/key you're already
using for `dashboard/` and `trackers/` works fine here too.

### 4. Point at your backend

Edit `lib/core/config.dart` → `apiBaseUrl`. The right value depends on
where you're running:

| Running on                  | Use                                              |
|------------------------------|---------------------------------------------------|
| Android emulator             | `http://10.0.2.2:3000/api/v1` (emulator's alias for your host machine's `localhost`) |
| iOS simulator                | `http://localhost:3000/api/v1` (works directly)   |
| Physical device (same Wi-Fi) | `http://<your-machine's-LAN-IP>:3000/api/v1` (e.g. `http://192.168.1.42:3000/api/v1`) |

Make sure `backend/` is actually running and reachable at that address
first.

### 5. Install dependencies

```
flutter pub get
```

### 6. Run

```
flutter run
```
Pick a connected device/emulator if prompted. Or run against a specific one:
```
flutter devices       # list available
flutter run -d <device-id>
```

## Sanity-checking before you rely on this

Run these and fix anything that comes up — again, none of this has been
compiled yet:
```
flutter analyze
```
Then actually walk through: sign up → check in → confirm GPS points are
queuing (the "Show sync diagnostics" toggle in the Panel tab shows queued
point count and last sync time) → walk/drive a short route → check out →
browse back to that day and confirm the map route renders.
