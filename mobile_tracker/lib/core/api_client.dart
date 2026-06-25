import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:mobile_tracker/core/config.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  ApiException(this.message, {this.statusCode});

  @override
  String toString() => message;
}

/// Thin wrapper around package:http mirroring the fetch() calls scattered
/// through trackers/src/context/TrackerContext.tsx — one place that knows
/// the base URL, auth header, and how to turn a non-2xx response into a
/// readable error message.
class ApiClient {
  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('${AppConfig.apiBaseUrl}$path').replace(queryParameters: query);

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) async {
    final response = await http.get(_uri(path, query), headers: _headers);
    return _decode(response);
  }

  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    final response = await http.post(
      _uri(path),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    Map<String, dynamic> json = {};
    if (response.body.isNotEmpty) {
      try {
        json = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {
        // Non-JSON body (e.g. empty 204) — fall through with {}.
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(_extractErrorMessage(json), statusCode: response.statusCode);
    }
    return json;
  }

  /// Mirrors extractErrorMessage in TrackerContext.tsx: the backend's
  /// error shape varies (string, {message}, {error:{message}}), so this
  /// covers all of them rather than assuming one.
  String _extractErrorMessage(Map<String, dynamic> json) {
    final error = json['error'];
    if (error is String) return error;
    if (error is Map<String, dynamic> && error['message'] != null) {
      final m = error['message'];
      return m is List ? m.join('; ') : m.toString();
    }
    if (json['message'] != null) {
      final m = json['message'];
      return m is List ? m.join('; ') : m.toString();
    }
    return 'Request failed';
  }
}
