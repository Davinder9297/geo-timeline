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
  login: (
    companyId: string,
    employeeId: string,
    password: string
  ) => Promise<void>;
  logout: () => void;
  trackingState: "idle" | "active" | "stopped";
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
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
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(null);
  const lastQueuedPointRef = useRef<LocationPointDto | null>(null);
  const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryBackoffRef = useRef<number>(1000);
  const userRef = useRef<UserState | null>(null);
  const queueRef = useRef<LocationPointDto[]>([]);
  const isUploadingRef = useRef(false); // New ref to track upload status
  const currentChunkRef = useRef<LocationPointDto[]>([]); // Ref to track current chunk being sent

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
      if (!response.ok) throw new Error("Failed to create attendance");
      return await response.json() as CreateAttendanceResponse;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(['attendances'], (old: AttendanceDaily[] | undefined) => 
        old ? [data.data, ...old] : [data.data]
      );
      const newUser = { ...user, attendanceId: data.data._id } as UserState;
      setUser(newUser);
      saveUser(newUser);
      setSelectedAttendance(data.data);
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
      if (!response.ok) throw new Error("Failed to check out");
      return await response.json() as CheckOutAttendanceResponse;
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(['attendances'], (old: AttendanceDaily[] | undefined) => 
        old ? old.map(a => a._id === data.data._id ? data.data : a) : [data.data]
      );
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
      if (!response.ok) throw new Error("Failed to start tracking");
      return (await response.json()) as StartTrackingResponse;
    },
  });

  const stopTrackingMutation = useMutation({
    mutationFn: async () => {
      if (!user || !user.attendanceId) throw new Error("No active attendance");
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/mobile/attendance/${user.attendanceId}/location/stop`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      if (!response.ok) throw new Error("Failed to stop tracking");
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
      if (!response.ok) throw new Error("Batch upload failed");
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

      // Hard distance filter: reject if not enough movement
      if (distance < CONFIG.DISTANCE_FILTER_METERS) {
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

      // Reject accuracy spikes
      if (accuracy > 100 && lastAccuracy !== null && accuracy > lastAccuracy * 2) {
        return false;
      }

      return true;
    },
    [lastAccuracy],
  );

const addLocationToQueue = useCallback(async (
  latitude: number,
  longitude: number,
  accuracy: number = 0,
  speed: number = 0,
  heading: number = 0,
  bypassDistanceFilter: boolean = false // only true for explicit heartbeat pings, if you want those
) => {
  const currentUser = userRef.current;
  if (!currentUser || !currentUser.attendanceId) return;

  const capturedAt = new Date().toISOString();

  if (!bypassDistanceFilter && !shouldAcceptPoint(latitude, longitude, accuracy, capturedAt)) {
    return;
  }

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

  const distanceFromLastAccepted = lastLocationRef.current
    ? haversineDistance(
        lastLocationRef.current.lat,
        lastLocationRef.current.lon,
        latitude,
        longitude,
      )
    : 0;

  if (lastLocationRef.current && distanceFromLastAccepted > 0) {
    setTotalDistance((prev) => prev + distanceFromLastAccepted);
  }

  setQueue((prev) => [...prev, point]);
  queueRef.current = [...queueRef.current, point];
  lastLocationRef.current = { lat: latitude, lon: longitude };
  lastQueuedPointRef.current = point;
  setLastAccuracy(accuracy);

  if (queueRef.current.length >= CONFIG.BATCH_SIZE) {
    flushQueue();
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
        maximumAge: 30000,
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

  const login = async (
    companyId: string,
    employeeId: string,
    password: string
  ) => {
    const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, employeeId, password }),
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

  const startTracking = async () => {
    if (!user || !user.attendanceId) return;
    try {
      await startTrackingMutation.mutateAsync();
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
          maximumAge: 30000,
          timeout: 60000, // Increase timeout to 60 seconds
        }
      );

      batchIntervalRef.current = setInterval(() => {
        flushQueue(true); // Allow sending empty batches as heartbeat
      }, CONFIG.BATCH_INTERVAL_MS);
    } catch (error) {
      setLastError(`Start tracking error: ${(error as Error).message}`);
    }
  };

  const stopTracking = async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    setTrackingState("idle"); // Reset to idle so we can start again
    stopWatcher();
    stopBatchInterval();

    await flushQueue();
    lastLocationRef.current = null;
    lastQueuedPointRef.current = null;
    setLastAccuracy(null);

    try {
      await stopTrackingMutation.mutateAsync();
    } catch (error) {
      setLastError(`Stop tracking error: ${(error as Error).message}`);
    }
  };

  const createAttendance = async () => {
    await createAttendanceMutation.mutateAsync();
  };

  const checkOutAttendance = async () => {
    await checkOutAttendanceMutation.mutateAsync();
    const newUser = { ...user, attendanceId: null } as UserState;
    setUser(newUser);
    saveUser(newUser);
    setSelectedAttendance(undefined);
    setTrackingState("idle");
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
      lastLocationRef.current = { lat: lastPoint.latitude, lon: lastPoint.longitude };
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
          maximumAge: 30000,
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
        logout,
        trackingState,
        startTracking,
        stopTracking,
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
