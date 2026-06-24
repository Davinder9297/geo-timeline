"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDeviceId,
  saveUser,
  loadUser,
  clearUser,
  saveQueue,
  loadQueue,
  clearQueue,
  saveTrackingState,
  loadTrackingState,
  clearTrackingState,
  generateClientPointId,
  haversineDistance,
} from "../utils";
import { CONFIG } from "../config";
import type {
  LocationPointDto,
  UserState,
  UserRole,
  BatchLocationPointsRequest,
  BatchLocationPointsResponse,
  StartTrackingResponse,
  AttendanceDaily,
  GetAttendancesResponse,
  CreateAttendanceResponse,
  CheckOutAttendanceResponse,
  TimelineResponse,
  GetTimelineResponse,
  EmployeeStatsDay,
  GetStatsResponse,
} from "../types";

declare global {
  interface Navigator {
    connection?: {
      effectiveType?: string;
    };
    getBattery?: () => Promise<{ level: number }>;
  }
}

interface TrackerContextType {
  user: UserState | null;
  login: (employeeId: string, password: string) => Promise<void>;
  signup: (employeeId: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  trackingState: "idle" | "active" | "stopped";
  queue: LocationPointDto[];
  lastSyncTime: Date | null;
  lastError: string | null;
  attendances: AttendanceDaily[] | undefined;
  selectedAttendance: AttendanceDaily | undefined;
  setSelectedAttendance: (attendance: AttendanceDaily | undefined) => void;
  createAttendance: () => Promise<void>;
  checkOutAttendance: () => Promise<void>;
  isCreatingAttendance: boolean;
  isCheckingOut: boolean;
  totalDistance: number; // Total distance moved in meters
  isHydrated: boolean;
  currentLocation: { lat: number; lng: number } | null;
  selectedTimelineDate: string;
  setSelectedTimelineDate: (date: string) => void;
  timeline: TimelineResponse | null;
  loadingTimeline: boolean;
  errorTimeline: string | null;
  stats: EmployeeStatsDay[] | undefined;
  loadingStats: boolean;
}

const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

export const TrackerProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const queryClient = useQueryClient();
  // Declare refs FIRST
  const watcherRef = useRef<number | null>(null);
  const sequenceRef = useRef<number>(0);
  const lastLocationRef = useRef<{ lat: number; lon: number; accuracyM: number } | null>(null);
  const lastQueuedPointRef = useRef<LocationPointDto | null>(null);
  const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryBackoffRef = useRef<number>(1000);
  const userRef = useRef<UserState | null>(null);
  const queueRef = useRef<LocationPointDto[]>([]);
  const isUploadingRef = useRef(false); // New ref to track upload status
  const currentChunkRef = useRef<LocationPointDto[]>([]); // Ref to track current chunk being sent
  const isProcessingPositionRef = useRef(false);
  const [user, setUser] = useState<UserState | null>(null);
  const [trackingState, setTrackingState] = useState<
    "idle" | "active" | "stopped"
  >("idle");
  const [queue, setQueue] = useState<LocationPointDto[]>([]);
  const [isHydrated, setIsHydrated] = useState(false); // Track hydration state
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [selectedAttendance, setSelectedAttendance] = useState<AttendanceDaily | undefined>();
  const [totalDistance, setTotalDistance] = useState(0); // Total distance in meters
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedTimelineDate, setSelectedTimelineDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Keep refs updated
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const getAttendancesQuery = useQuery({
    queryKey: ['attendances'],
    queryFn: async () => {
      if (!user) return undefined;
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/mobile/attendance`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to load attendances');
      const data = await response.json() as GetAttendancesResponse;
      return data.data;
    },
    enabled: !!user,
  });

  const timelineQuery = useQuery({
    queryKey: ["timeline", selectedTimelineDate],
    queryFn: async () => {
      if (!user) return null;
      const params = new URLSearchParams();
      params.set("date", selectedTimelineDate);
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/mobile/attendance/timeline?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to load timeline");
      const data = (await response.json()) as GetTimelineResponse;
      return data.data;
    },
    enabled: !!user,
    refetchInterval: 20000,
  });

  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      if (!user) return undefined;
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/mobile/attendance/stats?days=7`,
        {
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      if (!response.ok) throw new Error("Failed to load stats");
      const data = (await response.json()) as GetStatsResponse;
      return data.data;
    },
    enabled: !!user,
    refetchInterval: 20000,
  });

  // Helper to extract friendly message from various backend error shapes
  const extractErrorMessage = (err: unknown, defaultMsg: string) => {
    if (!err) return defaultMsg;
    if (typeof err === 'string') return err;
    // New global filter: { success: false, error: { statusCode, message, error } }
    if (typeof err === 'object' && err !== null) {
      const obj = err as Record<string, unknown>;
      if (obj.error) {
        const e = obj.error;
        if (typeof e === 'string') return e;
        if (typeof e === 'object' && e !== null) {
          const eo = e as Record<string, unknown>;
          if ('message' in eo) {
            const m = eo['message'];
            return Array.isArray(m) ? m.join('; ') : String(m);
          }
        }
      }
      if ('message' in obj) {
        const m = obj.message;
        return Array.isArray(m) ? m.join('; ') : String(m);
      }
    }
    return defaultMsg;
  };

  const createAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/mobile/attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      if (!response.ok) {
        let msg = 'Failed to create attendance';
        try {
          const err = await response.json();
          msg = extractErrorMessage(err, msg);
        } catch {}
        throw new Error(msg);
      }
      return (await response.json()) as CreateAttendanceResponse;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(['attendances'], (old: AttendanceDaily[] | undefined) => {
        if (!old) return [data.data];
        const exists = old.some((a) => a._id === data.data._id);
        return exists
          ? old.map((a) => (a._id === data.data._id ? data.data : a))
          : [data.data, ...old];
      });
      const newUser = { ...user, attendanceId: data.data._id } as UserState;
      setUser(newUser);
      saveUser(newUser);
      setSelectedAttendance(data.data);
      await startTrackingMutation.mutateAsync().catch(() => {});
      beginGeoWatch();
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });

  const checkOutAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!user || !user.attendanceId) throw new Error("No active attendance");
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/mobile/attendance/${user.attendanceId}/checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      if (!response.ok) {
        let msg = 'Failed to check out';
        try {
          const err = await response.json();
          msg = extractErrorMessage(err, msg);
        } catch {}
        throw new Error(msg);
      }
      return (await response.json()) as CheckOutAttendanceResponse;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(['attendances'], (old: AttendanceDaily[] | undefined) =>
        old ? old.map(a => a._id === data.data._id ? data.data : a) : [data.data]
      );
      queryClient.invalidateQueries({ queryKey: ["timeline"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    }
  });

  const startTrackingMutation = useMutation({
    mutationFn: async () => {
      if (!user || !user.attendanceId) throw new Error("No active attendance");
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/mobile/attendance/${user.attendanceId}/location/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      if (!response.ok) {
        let msg = 'Failed to start tracking';
        try {
          const err = await response.json();
          msg = extractErrorMessage(err, msg);
        } catch {}
        throw new Error(msg);
      }
      return (await response.json()) as StartTrackingResponse;
    },
  });

  const uploadBatchMutation = useMutation({
    mutationFn: async (batch: BatchLocationPointsRequest) => {
      const currentUser = userRef.current;
      if (!currentUser || !currentUser.attendanceId) throw new Error("No active attendance");
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/mobile/attendance/${currentUser.attendanceId}/location-points/batch`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentUser.token}`,
          },
          body: JSON.stringify(batch),
        }
      );
      if (!response.ok) {
        let msg = 'Batch upload failed';
        try {
          const err = await response.json();
          msg = extractErrorMessage(err, msg);
        } catch {}
        throw new Error(msg);
      }
      return (await response.json()) as BatchLocationPointsResponse;
    },
    onMutate: () => {
      isUploadingRef.current = true;
    },
    onSuccess: (data) => {
      if (data.data.lastUpdatedAt) {
        setLastSyncTime(new Date(data.data.lastUpdatedAt));
      }
      setLastError(null);
      retryBackoffRef.current = 1000;
      const lastAccepted = data.data.lastAcceptedSequenceNo;
      
      // Only process queue if we actually sent a chunk with points
      if (currentChunkRef.current.length > 0) {
        // First, try to filter by sequence number > lastAccepted
        let newQueue = queueRef.current.filter((p) => p.sequenceNo > lastAccepted);
        
        // If the queue didn't change at all (meaning none of the points in the current chunk were accepted),
        // then just remove the current chunk (they're duplicates or rejected)
        if (newQueue.length === queueRef.current.length) {
          // Remove the first MAX_BATCH_SIZE points (the current chunk)
          newQueue = queueRef.current.slice(currentChunkRef.current.length);
        }
        
        setQueue(newQueue);
        queueRef.current = newQueue;
        // If there are still points left, flush again
        if (newQueue.length > 0 && !isUploadingRef.current) {
          flushQueue();
        }
      }
    },
    onError: (error) => {
      setLastError(`Batch upload error: ${(error as Error).message}`);
      retryWithBackoff();
    },
    onSettled: () => {
      isUploadingRef.current = false;
    },
  });

  const MAX_BATCH_SIZE = 200;

  const retryWithBackoff = () => {
    setTimeout(() => {
      if (queueRef.current.length > 0 && !isUploadingRef.current) {
        const chunk = queueRef.current.slice(0, MAX_BATCH_SIZE);
        currentChunkRef.current = chunk;
        const batch: BatchLocationPointsRequest = {
          deviceId: getDeviceId(),
          points: chunk,
        };
        uploadBatchMutation.mutate(batch);
      }
      retryBackoffRef.current = Math.min(retryBackoffRef.current * 2, 30000);
    }, retryBackoffRef.current);
  };

  const flushQueue = useCallback((sendEmpty: boolean = false) => {
    const currentUser = userRef.current;
    if (!currentUser || !currentUser.attendanceId || (queueRef.current.length === 0 && !sendEmpty) || isUploadingRef.current) return;
    const chunk = queueRef.current.slice(0, MAX_BATCH_SIZE);
    currentChunkRef.current = chunk;
    const batch: BatchLocationPointsRequest = {
      deviceId: getDeviceId(),
      points: chunk,
    };
    uploadBatchMutation.mutate(batch);
  }, [uploadBatchMutation]); // Only stable uploadBatchMutation!

  const stopWatcher = () => {
    if (watcherRef.current !== null) {
      navigator.geolocation.clearWatch(watcherRef.current);
      watcherRef.current = null;
    }
  };

  const stopBatchInterval = () => {
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }
  };

  const getNetworkType = (): string => {
    if ("connection" in navigator) {
      const conn = navigator.connection;
      return conn?.effectiveType || "UNKNOWN";
    }
    return "UNKNOWN";
  };

  const getBatteryPercent = async (): Promise<number> => {
    if ("getBattery" in navigator) {
      try {
        const battery = await navigator.getBattery!();
        return Math.round(battery.level * 100);
      } catch {
        return 50;
      }
    }
    return 50;
  };

  const getAppState = (): "FOREGROUND" | "BACKGROUND" => {
    return document.visibilityState === "visible" ? "FOREGROUND" : "BACKGROUND";
  };

  const shouldAcceptPoint = useCallback(
    (
      latitude: number,
      longitude: number,
      accuracy: number,
      capturedAt: string,
    ) => {
      if (!lastLocationRef.current) return true;

      const distance = haversineDistance(
        lastLocationRef.current.lat,
        lastLocationRef.current.lon,
        latitude,
        longitude,
      );

      // Accuracy-aware distance filter: a move is only "real" if it exceeds
      // both the base filter and the combined GPS uncertainty of the two
      // fixes being compared. Otherwise normal jitter while stationary
      // (multipath/urban canyon error) gets counted as movement. Accuracy
      // is capped before use so a single degraded fix (tunnel, indoors)
      // can't permanently inflate the threshold and suppress later good
      // fixes once signal recovers.
      const ACCURACY_CAP_METERS = 50;
      const effectiveThreshold = Math.max(
        CONFIG.DISTANCE_FILTER_METERS,
        Math.min(accuracy, ACCURACY_CAP_METERS),
        Math.min(lastLocationRef.current.accuracyM, ACCURACY_CAP_METERS),
      );
      if (distance < effectiveThreshold) {
        return false;
      }

      // Check against last queued point
      if (
        lastQueuedPointRef.current &&
        lastQueuedPointRef.current.latitude === latitude &&
        lastQueuedPointRef.current.longitude === longitude &&
        lastQueuedPointRef.current.accuracyM === accuracy
      ) {
        return false;
      }

      // Check against queue tail (handles race condition with simultaneous calls)
      if (queueRef.current.length > 0) {
        const queueTail = queueRef.current[queueRef.current.length - 1];
        if (
          queueTail.latitude === latitude &&
          queueTail.longitude === longitude &&
          queueTail.accuracyM === accuracy &&
          queueTail.capturedAt === capturedAt
        ) {
          return false;
        }
      }

      // Note: we intentionally don't reject low-accuracy fixes here anymore.
      // Dropping a point client-side loses it forever; the backend's
      // quality engine (poorAccuracyThresholdMeters) already classifies
      // poor fixes and excludes them from the processed route without
      // discarding the raw data.

      return true;
    },
    [],
  );

const addLocationToQueue = useCallback(async (
  latitude: number,
  longitude: number,
  accuracy: number = 0,
  speed: number = 0,
  heading: number = 0,
  bypassDistanceFilter: boolean = false
) => {
  const currentUser = userRef.current;
  if (!currentUser || !currentUser.attendanceId) return;

  if (isProcessingPositionRef.current) return;
  isProcessingPositionRef.current = true;

  try {
    const capturedAt = new Date().toISOString();

    if (!bypassDistanceFilter && !shouldAcceptPoint(latitude, longitude, accuracy, capturedAt)) {
      return;
    }

    // Capture the previous point BEFORE we overwrite the ref, so distance
    // calculation below still works correctly.
    const previousLocation = lastLocationRef.current;

    // Claim this location synchronously, before any async work, to prevent
    // concurrent calls (getCurrentPosition + watchPosition firing close
    // together) from both treating this as the "first" point.
    lastLocationRef.current = { lat: latitude, lon: longitude, accuracyM: accuracy };

    const batteryPercent = await getBatteryPercent();
    const appState = getAppState();
    const networkType = getNetworkType();

    const point: LocationPointDto = {
      clientPointId: generateClientPointId(),
      sequenceNo: sequenceRef.current,
      capturedAt,
      latitude,
      longitude,
      accuracyM: accuracy,
      speedMps: speed,
      heading,
      batteryPercent,
      networkType,
      appState,
      isMocked: false,
    };

    sequenceRef.current += 1;

    const distanceFromLastAccepted = previousLocation
      ? haversineDistance(
          previousLocation.lat,
          previousLocation.lon,
          latitude,
          longitude,
        )
      : 0;

    if (previousLocation && distanceFromLastAccepted > 0) {
      setTotalDistance((prev) => prev + distanceFromLastAccepted);
    }

    setQueue((prev) => [...prev, point]);
    queueRef.current = [...queueRef.current, point];
    lastQueuedPointRef.current = point;
    setLastAccuracy(accuracy);
    setCurrentLocation({ lat: latitude, lng: longitude });

    if (queueRef.current.length >= CONFIG.BATCH_SIZE) {
      flushQueue();
    }
  } finally {
    isProcessingPositionRef.current = false;
  }
}, [flushQueue, shouldAcceptPoint]);

  const getCurrentLocation = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        await addLocationToQueue(latitude, longitude, accuracy, speed || 0, heading || 0);
      },
      (error) => {
        console.warn("Get current location error:", error);
        // Don't set a permanent error, just log it, since it might be a temporary timeout
        // setLastError(`Get current location error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 60000, // Increase timeout to 60 seconds
        maximumAge: 5000,
      }
    );
  }, [addLocationToQueue]);

const handlePosition = useCallback(
  async (position: GeolocationPosition) => {
    const currentUser = userRef.current;
    if (!currentUser || !currentUser.attendanceId) return;
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    await addLocationToQueue(latitude, longitude, accuracy, speed || 0, heading || 0);
  },
  [addLocationToQueue]
);

  const handlePositionError = useCallback((error: GeolocationPositionError) => {
    console.warn("Geolocation error:", error);
    // Don't set lastError for every geolocation error, since they can be frequent (timeouts, etc.)
    // setLastError(`Geolocation error: ${error.message}`);
  }, []);

  const login = async (employeeId: string, password: string) => {
    // Clear any persisted session state before logging in so new tracking starts fresh.
    clearUser();
    clearQueue();
    clearTrackingState();
    setUser(null);
    setQueue([]);
    queueRef.current = [];
    setTrackingState("idle");
    setLastError(null);
    setTotalDistance(0);

    const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, password }),
    });

    if (!response.ok) throw new Error("Login failed");

    const data = await response.json();
    const newUser: UserState = {
      isAuthenticated: true,
      companyId: data.employee.companyId,
      employeeId: data.employee.employeeId,
      name: data.employee.name,
      role: data.employee.role as UserRole,
      token: data.accessToken,
      attendanceId: null,
    };

    setUser(newUser);
    saveUser(newUser);
  };

  const signup = async (employeeId: string, name: string, password: string) => {
    clearUser();
    clearQueue();
    clearTrackingState();
    setUser(null);
    setQueue([]);
    queueRef.current = [];
    setTrackingState("idle");
    setLastError(null);
    setTotalDistance(0);

    const response = await fetch(`${CONFIG.API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, name, password }),
    });

    if (!response.ok) {
      let msg = "Signup failed";
      try {
        const err = await response.json();
        msg = extractErrorMessage(err, msg);
      } catch {}
      throw new Error(msg);
    }

    const data = await response.json();
    const newUser: UserState = {
      isAuthenticated: true,
      companyId: data.employee.companyId,
      employeeId: data.employee.employeeId,
      name: data.employee.name,
      role: data.employee.role as UserRole,
      token: data.accessToken,
      attendanceId: null,
    };

    setUser(newUser);
    saveUser(newUser);
  };

  const logout = () => {
    setUser(null);
    clearUser();
    clearQueue();
    clearTrackingState();
    setQueue([]);
    queueRef.current = []; // Reset ref too
    setTrackingState("idle");
    setLastSyncTime(null);
    setLastError(null);
    setSelectedAttendance(undefined);
    setTotalDistance(0); // Reset total distance
    stopWatcher();
    stopBatchInterval();
  };

  const beginGeoWatch = useCallback(() => {
    setTrackingState("active");

    // Reset stale state when starting a fresh tracking session
    if (queueRef.current.length === 0) {
      lastLocationRef.current = null;
      lastQueuedPointRef.current = null;
      setLastAccuracy(null);
    }

    // Get current location immediately
    getCurrentLocation();

    watcherRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handlePositionError,
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 60000, // Increase timeout to 60 seconds
      }
    );

    batchIntervalRef.current = setInterval(() => {
      flushQueue(true); // Allow sending empty batches as heartbeat
    }, CONFIG.BATCH_INTERVAL_MS);
  }, [getCurrentLocation, handlePosition, handlePositionError, flushQueue]);

  const endGeoWatch = useCallback(async () => {
    setTrackingState("idle");
    stopWatcher();
    stopBatchInterval();

    await flushQueue();
    lastLocationRef.current = null;
    lastQueuedPointRef.current = null;
    setLastAccuracy(null);
  }, [flushQueue]);

  const createAttendance = async () => {
    await createAttendanceMutation.mutateAsync();
  };

  const checkOutAttendance = async () => {
    await endGeoWatch();
    await checkOutAttendanceMutation.mutateAsync();
    const newUser = { ...user, attendanceId: null } as UserState;
    setUser(newUser);
    saveUser(newUser);
    setSelectedAttendance(undefined);
    setTotalDistance(0); // Reset total distance on checkout
  };

  // Hydration effect: Load saved data after client-side mount
  useEffect(() => {
    const savedUser = loadUser();
    const savedQueue = loadQueue();
    const savedTrackingState = loadTrackingState();
    if (savedUser) {
      setUser(savedUser);
      userRef.current = savedUser;
    }
    if (savedQueue.length > 0) {
      setQueue(savedQueue);
      queueRef.current = savedQueue;
      const maxSeq = Math.max(...savedQueue.map((p) => p.sequenceNo));
      sequenceRef.current = maxSeq + 1;
      const lastPoint = savedQueue[savedQueue.length - 1];
      lastLocationRef.current = { lat: lastPoint.latitude, lon: lastPoint.longitude, accuracyM: lastPoint.accuracyM };
      lastQueuedPointRef.current = lastPoint;
      setLastAccuracy(lastPoint.accuracyM);
    }
    setTrackingState(savedTrackingState);
    setIsHydrated(true);
  }, []);

  // First useEffect (online listener only)
  useEffect(() => {
    const handleOnline = () => {
      const currentUser = userRef.current;
      if (currentUser && currentUser.attendanceId && !isUploadingRef.current) {
        flushQueue(true);
      }
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
      stopWatcher();
      stopBatchInterval();
    };
  }, [flushQueue]);

  // Resume tracking if was active and we have a user (only after hydration)
  useEffect(() => {
    if (isHydrated && trackingState === "active" && user && user.attendanceId) {
      // Get current location immediately
      getCurrentLocation();
      
      // Start watcher and batch interval
      watcherRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        handlePositionError,
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 60000, // Increase timeout to 60 seconds
        }
      );

      batchIntervalRef.current = setInterval(() => {
        flushQueue(true); // Allow sending empty batches as heartbeat
      }, CONFIG.BATCH_INTERVAL_MS);
    } else if (isHydrated) {
      // Stop everything if not active (only after hydration)
      stopWatcher();
      stopBatchInterval();
    }
  }, [isHydrated, trackingState, user, handlePosition, handlePositionError, flushQueue, getCurrentLocation]);

  useEffect(() => {
    saveTrackingState(trackingState);
  }, [trackingState]);

  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  useEffect(() => {
    if (user && !user.attendanceId && getAttendancesQuery.data) {
      const todayAttendance = getAttendancesQuery.data.find(a => a.attendanceDate === new Date().toISOString().split('T')[0] && !a.finalCheckOutAt);
      if (todayAttendance) {
        setSelectedAttendance(todayAttendance);
        const newUser = { ...user, attendanceId: todayAttendance._id } as UserState;
        setUser(newUser);
        saveUser(newUser);
      }
    }
  }, [getAttendancesQuery.data, user?.attendanceId]); // Only depend on user.attendanceId instead of whole user!

  return (
    <TrackerContext.Provider
      value={{
        user,
        login,
        signup,
        logout,
        trackingState,
        queue,
        lastSyncTime,
        lastError,
        attendances: getAttendancesQuery.data,
        selectedAttendance,
        setSelectedAttendance,
        createAttendance,
        checkOutAttendance,
        isCreatingAttendance: createAttendanceMutation.isPending,
        isCheckingOut: checkOutAttendanceMutation.isPending,
        totalDistance,
        isHydrated,
        currentLocation,
        selectedTimelineDate,
        setSelectedTimelineDate,
        timeline: timelineQuery.data || null,
        loadingTimeline: timelineQuery.isLoading,
        errorTimeline: timelineQuery.error?.message || null,
        stats: statsQuery.data,
        loadingStats: statsQuery.isLoading,
      }}
    >
      {children}
    </TrackerContext.Provider>
  );
};

export const useTracker = () => {
  const context = useContext(TrackerContext);
  if (!context) {
    throw new Error("useTracker must be used within a TrackerProvider");
  }
  return context;
};
