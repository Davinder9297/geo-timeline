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
