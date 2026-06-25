enum UserRole { admin, manager, employee }

UserRole userRoleFromString(String value) {
  switch (value.toUpperCase()) {
    case 'ADMIN':
      return UserRole.admin;
    case 'MANAGER':
      return UserRole.manager;
    default:
      return UserRole.employee;
  }
}

class UserState {
  final String employeeId;
  final String companyId;
  final String name;
  final UserRole role;
  final String token;
  final String? attendanceId;

  const UserState({
    required this.employeeId,
    required this.companyId,
    required this.name,
    required this.role,
    required this.token,
    this.attendanceId,
  });

  UserState copyWith({String? attendanceId}) {
    return UserState(
      employeeId: employeeId,
      companyId: companyId,
      name: name,
      role: role,
      token: token,
      attendanceId: attendanceId,
    );
  }

  Map<String, dynamic> toJson() => {
        'employeeId': employeeId,
        'companyId': companyId,
        'name': name,
        'role': role.name,
        'token': token,
        'attendanceId': attendanceId,
      };

  factory UserState.fromJson(Map<String, dynamic> json) => UserState(
        employeeId: json['employeeId'] as String,
        companyId: json['companyId'] as String,
        name: json['name'] as String,
        role: userRoleFromString(json['role'] as String? ?? 'EMPLOYEE'),
        token: json['token'] as String,
        attendanceId: json['attendanceId'] as String?,
      );
}
