export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export enum AttendanceStatus {
  WORKING = 'WORKING',
  ON_BREAK = 'ON_BREAK',
  OFFLINE = 'OFFLINE',
  CHECKED_OUT = 'CHECKED_OUT',
}

export interface Break {
  breakId: string;
  startAt: string;
  endAt?: string;
}

export interface Session {
  sessionId: string;
  checkInAt: string;
  checkOutAt?: string;
  breaks: Break[];
}

export interface AttendanceDaily {
  _id: string;
  companyId: string;
  employeeId: string;
  attendanceDate: string;
  timezone: string;
  status: AttendanceStatus;
  firstCheckInAt: string;
  finalCheckOutAt?: string;
  trackingStoppedAt?: string;
  sessions: Session[];
  createdAt: string;
  updatedAt: string;
}

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
  appState: "FOREGROUND" | "BACKGROUND";
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
    lastUpdatedAt: string | null;
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
  name: string;
  role: UserRole;
  token: string;
  attendanceId: string | null;
}

export interface GetAttendancesResponse {
  success: boolean;
  data: AttendanceDaily[];
}

export interface CreateAttendanceResponse {
  success: boolean;
  data: AttendanceDaily;
}

export interface CheckOutAttendanceResponse {
  success: boolean;
  data: AttendanceDaily;
}

export interface RawLocationPoint {
  latitude: number;
  longitude: number;
  sequenceNo: number;
  capturedAt: string;
  sessionId: string;
}

export interface TimelineEvent {
  type: "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END" | "STOP";
  at?: string;
  startAt?: string;
  endAt?: string;
  durationSeconds?: number;
}

export interface TimelineAnomaly {
  type: string;
  startAt: string;
  endAt: string;
  durationSeconds: number;
}

export interface TimelineResponse {
  attendance: AttendanceDaily;
  rawPointsCount: number;
  rawPoints: RawLocationPoint[];
  summaryAvailable: boolean;
  processedRoute?: {
    encodedProcessedPolyline: string;
    encodedRawPolyline: string;
  };
  totals?: {
    rawDistanceMeters: number;
    processedDistanceMeters: number;
    workingSeconds: number;
    breakSeconds: number;
    movingSeconds: number;
    holdSeconds: number;
    dataGapSeconds: number;
    gpsQualityScore: number;
  };
  timelineEvents?: TimelineEvent[];
  anomalies?: TimelineAnomaly[];
}

export interface GetTimelineResponse {
  success: boolean;
  data: TimelineResponse;
}

export interface EmployeeStatsDay {
  date: string;
  workingSeconds: number;
  distanceMeters: number;
  sessionsCount: number;
}

export interface GetStatsResponse {
  success: boolean;
  data: EmployeeStatsDay[];
}
