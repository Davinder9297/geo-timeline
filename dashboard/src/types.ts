export const LiveLocationStatus = {
  WORKING: "WORKING",
  ON_BREAK: "ON_BREAK",
  OFFLINE: "OFFLINE",
  STALE: "STALE",
  CHECKED_OUT: "CHECKED_OUT",
} as const;
export type LiveLocationStatus = typeof LiveLocationStatus[keyof typeof LiveLocationStatus];

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export interface LiveEmployee {
  employeeId: string;
  name: string;
  status: LiveLocationStatus;
  isStale: boolean;
  lastLocation: { latitude: number; longitude: number };
  lastUpdatedAt: string;
}

export interface TimelineEvent {
  type: "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END" | "STOP";
  at?: string;
  startAt?: string;
  endAt?: string;
  durationSeconds?: number;
}

export interface Anomaly {
  type: string;
  startAt: string;
  endAt: string;
  durationSeconds: number;
}

export interface TimelineSummary {
  companyId: string;
  employeeId: string;
  attendanceId: string;
  attendanceDate: string;
  rawDistanceMeters: number;
  processedDistanceMeters: number;
  workingSeconds: number;
  breakSeconds: number;
  movingSeconds: number;
  holdSeconds: number;
  dataGapSeconds: number;
  gpsQualityScore: number;
  encodedRawPolyline: string;
  encodedProcessedPolyline: string;
  timelineEvents: TimelineEvent[];
  anomalies: Anomaly[];
  lastComputedAt: string;
}

export interface AttendanceSession {
  sessionId: string;
  checkInAt: string;
  checkOutAt?: string;
  breaks: { breakId: string; startAt: string; endAt?: string }[];
}

export interface AttendanceDaily {
  _id: string;
  companyId: string;
  employeeId: string;
  attendanceDate: string;
  status: string;
  firstCheckInAt: string;
  finalCheckOutAt?: string;
  trackingStoppedAt?: string;
  sessions: AttendanceSession[];
}

export interface RawLocationPoint {
  latitude: number;
  longitude: number;
  sequenceNo: number;
  capturedAt: string;
  sessionId: string;
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
  anomalies?: Anomaly[];
}

export interface UserState {
  isAuthenticated: boolean;
  companyId: string;
  employeeId: string;
  name: string;
  role: UserRole;
  token: string;
}
