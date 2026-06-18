import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  LocationPointDto,
  UserState,
  BatchLocationPointsRequest,
  BatchLocationPointsResponse,
} from './types';
import {
  getDeviceId,
  saveUser,
  loadUser,
  clearUser,
  saveQueue,
  loadQueue,
  clearQueue,
  generateClientPointId,
  haversineDistance,
} from './utils';
import { CONFIG } from './config';

interface TrackerContextType {
  user: UserState | null;
  login: (employeeId: string, companyId: string, attendanceId: string, token: string) => void;
  logout: () => void;
  trackingState: 'idle' | 'active' | 'stopped';
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  queue: LocationPointDto[];
  lastSyncTime: Date | null;
  lastError: string | null;
}

const TrackerContext = createContext<TrackerContextType | undefined>(undefined);

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserState | null>(null);
  const [trackingState, setTrackingState] = useState<'idle' | 'active' | 'stopped'>('idle');
  const [queue, setQueue] = useState<LocationPointDto[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const watcherRef = useRef<number | null>(null);
  const sequenceRef = useRef<number>(0);
  const lastLocationRef = useRef<{ lat: number; lon: number } | null>(null);
  const batchIntervalRef = useRef<number | null>(null);
  const retryBackoffRef = useRef<number>(1000);

  useEffect(() => {
    const savedUser = loadUser();
    const savedQueue = loadQueue();
    if (savedUser) {
      setUser(savedUser);
    }
    if (savedQueue.length > 0) {
      setQueue(savedQueue);
    }
    if (savedQueue.length > 0) {
      const maxSeq = Math.max(...savedQueue.map(p => p.sequenceNo));
      sequenceRef.current = maxSeq + 1;
    }

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      stopWatcher();
      stopBatchInterval();
    };
  }, []);

  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  const login = useCallback(
    (employeeId: string, companyId: string, attendanceId: string, token: string) => {
      const newUser: UserState = { isAuthenticated: true, employeeId, companyId, attendanceId, token };
      setUser(newUser);
      saveUser(newUser);
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    clearUser();
    clearQueue();
    setQueue([]);
    setTrackingState('idle');
    setLastSyncTime(null);
    setLastError(null);
  }, []);

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
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      return conn.effectiveType || 'UNKNOWN';
    }
    return 'UNKNOWN';
  };

  const getBatteryPercent = async (): Promise<number> => {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      } catch (e) {
        return 50;
      }
    }
    return 50;
  };

  const getAppState = (): 'FOREGROUND' | 'BACKGROUND' => {
    return document.visibilityState === 'visible' ? 'FOREGROUND' : 'BACKGROUND';
  };

  const handlePosition = useCallback(
    async (position: GeolocationPosition) => {
      if (!user) return;
      const { latitude, longitude, accuracy, speed, heading } = position.coords;
      const capturedAt = new Date(position.timestamp).toISOString();

      if (
        lastLocationRef.current &&
        haversineDistance(
          lastLocationRef.current.lat,
          lastLocationRef.current.lon,
          latitude,
          longitude
        ) < CONFIG.DISTANCE_FILTER_METERS
      ) {
        return;
      }

      const batteryPercent = await getBatteryPercent();
      const appState = getAppState();
      const networkType = getNetworkType();

      const point: LocationPointDto = {
        clientPointId: generateClientPointId(),
        sequenceNo: sequenceRef.current++,
        capturedAt,
        latitude,
        longitude,
        accuracyM: accuracy || 0,
        speedMps: speed || 0,
        heading: heading || 0,
        batteryPercent,
        networkType,
        appState,
        isMocked: false, // Browser doesn't expose isMocked flag
      };

      setQueue(prev => [...prev, point]);
      lastLocationRef.current = { lat: latitude, lon: longitude };

      if (queue.length + 1 >= CONFIG.BATCH_SIZE) {
        flushQueue();
      }
    },
    [user, queue]
  );

  const handlePositionError = useCallback((error: GeolocationPositionError) => {
    console.error('Geolocation error:', error);
    setLastError(`Geolocation error: ${error.message}`);
  }, []);

  const flushQueue = useCallback(async () => {
    if (!user || queue.length === 0) return;
    try {
      const request: BatchLocationPointsRequest = {
        deviceId: getDeviceId(),
        points: queue,
      };
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/mobile/attendance/${user.attendanceId}/location-points/batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify(request),
        }
      );
      if (!response.ok) {
        throw new Error('Batch upload failed');
      }
      const data: BatchLocationPointsResponse = await response.json();
      const lastAcceptedSeq = data.data.lastAcceptedSequenceNo;
      setQueue(prev => prev.filter(p => p.sequenceNo > lastAcceptedSeq));
      setLastSyncTime(new Date());
      setLastError(null);
      retryBackoffRef.current = 1000;
    } catch (e) {
      setLastError(`Batch upload error: ${(e as Error).message}`);
      retryWithBackoff();
    }
  }, [user, queue]);

  const retryWithBackoff = () => {
    setTimeout(() => {
      flushQueue();
      retryBackoffRef.current = Math.min(retryBackoffRef.current * 2, 30000);
    }, retryBackoffRef.current);
  };

  const handleOnline = useCallback(() => {
    flushQueue();
  }, [flushQueue]);

  const startTracking = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/mobile/attendance/${user.attendanceId}/location/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      if (!response.ok) {
        throw new Error('Failed to start tracking');
      }
      await response.json();
      setTrackingState('active');

      watcherRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        handlePositionError,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000,
        }
      );

      batchIntervalRef.current = setInterval(() => {
        flushQueue();
      }, CONFIG.BATCH_INTERVAL_MS);
    } catch (e) {
      setLastError(`Start tracking error: ${(e as Error).message}`);
    }
  }, [user, handlePosition, handlePositionError, flushQueue]);

  const stopTracking = useCallback(async () => {
    if (!user) return;
    setTrackingState('stopped');
    stopWatcher();
    stopBatchInterval();

    await flushQueue();

    try {
      await fetch(
        `${CONFIG.API_BASE_URL}/mobile/attendance/${user.attendanceId}/location/stop`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
    } catch (e) {
      setLastError(`Stop tracking error: ${(e as Error).message}`);
    }
  }, [user, flushQueue]);

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
      }}
    >
      {children}
    </TrackerContext.Provider>
  );
};

export const useTracker = () => {
  const context = useContext(TrackerContext);
  if (context === undefined) {
    throw new Error('useTracker must be used within a TrackerProvider');
  }
  return context;
};
