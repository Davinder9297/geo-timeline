class BreakWindow {
  final String breakId;
  final String startAt;
  final String? endAt;

  const BreakWindow({required this.breakId, required this.startAt, this.endAt});

  factory BreakWindow.fromJson(Map<String, dynamic> json) => BreakWindow(
        breakId: json['breakId'] as String,
        startAt: json['startAt'] as String,
        endAt: json['endAt'] as String?,
      );
}

class AttendanceSession {
  final String sessionId;
  final String checkInAt;
  final String? checkOutAt;
  final List<BreakWindow> breaks;

  const AttendanceSession({
    required this.sessionId,
    required this.checkInAt,
    this.checkOutAt,
    this.breaks = const [],
  });

  factory AttendanceSession.fromJson(Map<String, dynamic> json) =>
      AttendanceSession(
        sessionId: json['sessionId'] as String,
        checkInAt: json['checkInAt'] as String,
        checkOutAt: json['checkOutAt'] as String?,
        breaks: (json['breaks'] as List<dynamic>? ?? [])
            .map((b) => BreakWindow.fromJson(b as Map<String, dynamic>))
            .toList(),
      );
}

class AttendanceDaily {
  final String id;
  final String companyId;
  final String employeeId;
  final String attendanceDate;
  final String status;
  final String firstCheckInAt;
  final String? finalCheckOutAt;
  final String? trackingStoppedAt;
  final List<AttendanceSession> sessions;

  const AttendanceDaily({
    required this.id,
    required this.companyId,
    required this.employeeId,
    required this.attendanceDate,
    required this.status,
    required this.firstCheckInAt,
    this.finalCheckOutAt,
    this.trackingStoppedAt,
    this.sessions = const [],
  });

  factory AttendanceDaily.fromJson(Map<String, dynamic> json) =>
      AttendanceDaily(
        id: json['_id'] as String,
        companyId: json['companyId'] as String,
        employeeId: json['employeeId'] as String,
        attendanceDate: json['attendanceDate'] as String,
        status: json['status'] as String,
        firstCheckInAt: json['firstCheckInAt'] as String,
        finalCheckOutAt: json['finalCheckOutAt'] as String?,
        trackingStoppedAt: json['trackingStoppedAt'] as String?,
        sessions: (json['sessions'] as List<dynamic>? ?? [])
            .map((s) => AttendanceSession.fromJson(s as Map<String, dynamic>))
            .toList(),
      );
}
