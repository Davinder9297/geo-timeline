import { v4 as uuidv4 } from "uuid";
import type { LocationPointDto, UserState } from "./types";

const DEVICE_ID_KEY = "tracker_device_id";
const USER_KEY = "tracker_user";
const QUEUE_KEY = "tracker_queue";
const TRACKING_STATE_KEY = "tracker_tracking_state";

const isBrowser = typeof window !== "undefined";

export const getDeviceId = (): string => {
  if (!isBrowser) return "";
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

export const saveUser = (user: UserState): void => {
  if (!isBrowser) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const loadUser = (): UserState | null => {
  if (!isBrowser) return null;
  const user = localStorage.getItem(USER_KEY);
  if (user) {
    try {
      return JSON.parse(user);
    } catch {
      return null;
    }
  }
  return null;
};

export const clearUser = (): void => {
  if (!isBrowser) return;
  localStorage.removeItem(USER_KEY);
};

export const saveQueue = (queue: LocationPointDto[]): void => {
  if (!isBrowser) return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const loadQueue = (): LocationPointDto[] => {
  if (!isBrowser) return [];
  const queue = localStorage.getItem(QUEUE_KEY);
  if (queue) {
    try {
      return JSON.parse(queue);
    } catch {
      return [];
    }
  }
  return [];
};

export const clearQueue = (): void => {
  if (!isBrowser) return;
  localStorage.removeItem(QUEUE_KEY);
};

export const saveTrackingState = (state: "idle" | "active" | "stopped"): void => {
  if (!isBrowser) return;
  localStorage.setItem(TRACKING_STATE_KEY, state);
};

export const loadTrackingState = (): "idle" | "active" | "stopped" => {
  if (!isBrowser) return "idle";
  const state = localStorage.getItem(TRACKING_STATE_KEY);
  if (state && ["idle", "active", "stopped"].includes(state)) {
    return state as "idle" | "active" | "stopped";
  }
  return "idle";
};

export const clearTrackingState = (): void => {
  if (!isBrowser) return;
  localStorage.removeItem(TRACKING_STATE_KEY);
};

export const generateClientPointId = (): string => uuidv4();

export const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const decodePolyline = (encoded: string): [number, number][] => {
  let index = 0;
  const latlngs: [number, number][] = [];
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    latlngs.push([lat / 1e5, lng / 1e5]);
  }
  return latlngs;
};

export const formatTime = (seconds: number): string => {
  const totalSecs = Math.round(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  return `${hrs}h ${mins}m`;
};

export const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

export const SESSION_COLORS = [
  "#2196F3",
  "#9C27B0",
  "#009688",
  "#FF9800",
  "#E91E63",
  "#3F51B5",
];

export const getSessionColor = (index: number): string =>
  SESSION_COLORS[index % SESSION_COLORS.length];
