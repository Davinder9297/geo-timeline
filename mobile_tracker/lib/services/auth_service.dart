import 'package:mobile_tracker/core/api_client.dart';
import 'package:mobile_tracker/models/user_state.dart';

class AuthService {
  final ApiClient _api;
  AuthService(this._api);

  Future<UserState> login(String employeeId, String password) async {
    final json = await _api.post('/auth/login', body: {
      'employeeId': employeeId,
      'password': password,
    });
    return _userFromAuthResponse(json);
  }

  Future<UserState> signup(String employeeId, String name, String password) async {
    final json = await _api.post('/auth/register', body: {
      'employeeId': employeeId,
      'name': name,
      'password': password,
    });
    return _userFromAuthResponse(json);
  }

  UserState _userFromAuthResponse(Map<String, dynamic> json) {
    final employee = json['employee'] as Map<String, dynamic>;
    return UserState(
      employeeId: employee['employeeId'] as String,
      companyId: employee['companyId'] as String,
      name: employee['name'] as String,
      role: userRoleFromString(employee['role'] as String? ?? 'EMPLOYEE'),
      token: json['accessToken'] as String,
      attendanceId: null,
    );
  }
}
