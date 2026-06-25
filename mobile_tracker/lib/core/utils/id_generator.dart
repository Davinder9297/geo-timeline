import 'package:uuid/uuid.dart';

const _uuid = Uuid();

String generateClientPointId() => _uuid.v4();

String generateDeviceId() => _uuid.v4();
