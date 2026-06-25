class EmployeeStatsDay {
  final String date;
  final double workingSeconds;
  final double distanceMeters;
  final int sessionsCount;

  const EmployeeStatsDay({
    required this.date,
    required this.workingSeconds,
    required this.distanceMeters,
    required this.sessionsCount,
  });

  factory EmployeeStatsDay.fromJson(Map<String, dynamic> json) =>
      EmployeeStatsDay(
        date: json['date'] as String,
        workingSeconds: (json['workingSeconds'] as num? ?? 0).toDouble(),
        distanceMeters: (json['distanceMeters'] as num? ?? 0).toDouble(),
        sessionsCount: json['sessionsCount'] as int? ?? 0,
      );
}
