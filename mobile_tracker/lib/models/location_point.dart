class LocationPointDto {
  final String clientPointId;
  final int sequenceNo;
  final String capturedAt; // ISO 8601
  final double latitude;
  final double longitude;
  final double accuracyM;
  final double speedMps;
  final double heading;
  final int batteryPercent;
  final String networkType;
  final String appState; // FOREGROUND | BACKGROUND
  final bool isMocked;

  const LocationPointDto({
    required this.clientPointId,
    required this.sequenceNo,
    required this.capturedAt,
    required this.latitude,
    required this.longitude,
    required this.accuracyM,
    required this.speedMps,
    required this.heading,
    required this.batteryPercent,
    required this.networkType,
    required this.appState,
    required this.isMocked,
  });

  Map<String, dynamic> toJson() => {
        'clientPointId': clientPointId,
        'sequenceNo': sequenceNo,
        'capturedAt': capturedAt,
        'latitude': latitude,
        'longitude': longitude,
        'accuracyM': accuracyM,
        'speedMps': speedMps,
        'heading': heading,
        'batteryPercent': batteryPercent,
        'networkType': networkType,
        'appState': appState,
        'isMocked': isMocked,
      };

  factory LocationPointDto.fromJson(Map<String, dynamic> json) =>
      LocationPointDto(
        clientPointId: json['clientPointId'] as String,
        sequenceNo: json['sequenceNo'] as int,
        capturedAt: json['capturedAt'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        accuracyM: (json['accuracyM'] as num).toDouble(),
        speedMps: (json['speedMps'] as num).toDouble(),
        heading: (json['heading'] as num).toDouble(),
        batteryPercent: json['batteryPercent'] as int,
        networkType: json['networkType'] as String,
        appState: json['appState'] as String,
        isMocked: json['isMocked'] as bool,
      );
}
