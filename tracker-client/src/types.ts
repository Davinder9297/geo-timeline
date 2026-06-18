export interface LocationPointDto {
  clientPointId: string;
  sequenceNo: number;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  speedMps: number;
  heading: number;
  batteryPercent: number;
  networkType: string;
  appState: 'FOREGROUND' | 'BACKGROUND';
  isMocked: boolean;
}

export interface BatchLocationPointsRequest {
  deviceId: string;
  points: LocationPointDto[];
}

export interface BatchLocationPointsResponse {
  success: boolean;
  data: {
    accepted: number;
    duplicates: number;
    rejected: number;
    lastAcceptedSequenceNo: number;
  };
}

export interface StartTrackingResponse {
  success: boolean;
  data: {
    trackingEnabled: boolean;
    locationIntervalSeconds: number;
    distanceFilterMeters: number;
    batchSize: number;
  };
}

export interface UserState {
  isAuthenticated: boolean;
  employeeId: string;
  companyId: string;
  attendanceId: string;
  token: string;
}
