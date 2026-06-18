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
    } catch (e) {
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
    } catch (e) {
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
