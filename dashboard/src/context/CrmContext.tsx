"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import type {
  LiveEmployee,
  TimelineResponse,
} from "../types";
import { CONFIG } from "../config";
import { useAuth } from "./AuthContext";
import { extractErrorMessage } from "../utils/error";

const CrmContext = createContext<{
  employees: LiveEmployee[];
  loadingEmployees: boolean;
  errorEmployees: string | null;
  selectedEmployeeId: string | null;
  selectedEmployee: LiveEmployee | null;
  selectEmployee: (employeeId: string) => void;
  timeline: TimelineResponse | null;
  loadingTimeline: boolean;
  errorTimeline: string | null;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  rebuildTimeline: (attendanceId: string) => Promise<void>;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  playbackTime: number;
  setPlaybackTime: (seconds: number) => void;
  timelineDurationSeconds: number;
  selectedSessionId: string | null;
  setSelectedSessionId: (sessionId: string | null) => void;
} | null>(null);

export const CrmProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const employeesQuery = useQuery({
    queryKey: ["live-employees"],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/companies/${user.companyId}/geo/live-employees`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      if (response.status === 401) {
        console.error("[CrmContext] Token expired or invalid, logging out...");
        logout();
        throw new Error("Unauthorized");
      }
      if (!response.ok) {
        let msg = 'Failed to fetch employees';
        try {
          const err = await response.json();
          msg = extractErrorMessage(err, msg);
        } catch {}
        throw new Error(msg);
      }
      const data = await response.json();
      return data.data as LiveEmployee[];
    },
    enabled: !!user,
  });

  const timelineQuery = useQuery({
    queryKey: ["timeline", selectedEmployeeId, selectedDate],
    queryFn: async () => {
      if (!user || !selectedEmployeeId) return null;
      const params = new URLSearchParams();
      params.set("date", selectedDate);
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/companies/${user.companyId}/employees/${selectedEmployeeId}/geo-timeline?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      if (response.status === 401) {
        console.error("[CrmContext] Token expired or invalid, logging out...");
        logout();
        throw new Error("Unauthorized");
      }
      // No attendance exists for this employee/date — not an error, just an
      // empty day. Let the UI show a friendly "didn't check in" message.
      if (response.status === 404) return null;
        if (!response.ok) {
          let msg = 'Failed to fetch timeline';
          try {
            const err = await response.json();
            msg = extractErrorMessage(err, msg);
          } catch {}
          throw new Error(msg);
        }
        const data = await response.json();
      return data.data as TimelineResponse;
    },
    enabled: !!user && !!selectedEmployeeId,
  });

  const rebuildTimelineMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      if (!user) throw new Error("Not authenticated");
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/companies/${user.companyId}/attendance/${attendanceId}/geo-timeline/rebuild`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      if (response.status === 401) {
        console.error("[CrmContext] Token expired or invalid, logging out...");
        logout();
        throw new Error("Unauthorized");
      }
        if (!response.ok) {
          let msg = 'Failed to rebuild timeline';
          try {
            const err = await response.json();
            msg = extractErrorMessage(err, msg);
          } catch {}
          throw new Error(msg);
        }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["timeline", selectedEmployeeId, selectedDate],
      });
    },
  });

  const selectEmployee = useCallback((employeeId: string) => {
    setSelectedEmployeeId(employeeId);
  }, []);

  const rebuildTimeline = useCallback(
    async (attendanceId: string) => {
      await rebuildTimelineMutation.mutateAsync(attendanceId);
    },
    [rebuildTimelineMutation]
  );


  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      return;
    }

    socketRef.current = io(CONFIG.WS_URL, {
      extraHeaders: {
        Authorization: `Bearer ${user.token}`,
      },
    });

    socketRef.current.on("connect", () => {
      socketRef.current?.emit("company:subscribe", { companyId: user.companyId });
    });

    // The backend only broadcasts a partial payload (employeeId, location,
    // status, isStale, lastUpdatedAt — no `name`), so these handlers must
    // merge into the existing cached record rather than replacing it
    // wholesale, or fields like `name` get wiped and crash consumers like
    // LeftPanel's `.toLowerCase()` search filter. If the employee isn't in
    // the cache yet (e.g. just signed up), refetch the full list instead.
    type LiveLocationUpdatePayload = {
      employeeId: string;
      location?: { latitude: number; longitude: number };
      status?: LiveEmployee["status"];
      isStale?: boolean;
      lastUpdatedAt?: string;
    };

    const mergeLiveEmployeeUpdate = (data: LiveLocationUpdatePayload) => {
      queryClient.setQueryData(["live-employees"], (old: LiveEmployee[] | undefined) => {
        if (!old) return old;
        const exists = old.some((e) => e.employeeId === data.employeeId);
        if (!exists) {
          queryClient.invalidateQueries({ queryKey: ["live-employees"] });
          return old;
        }
        return old.map((e) =>
          e.employeeId === data.employeeId
            ? {
                ...e,
                lastLocation: data.location ?? e.lastLocation,
                status: data.status ?? e.status,
                isStale: data.isStale ?? e.isStale,
                lastUpdatedAt: data.lastUpdatedAt ?? e.lastUpdatedAt,
              }
            : e
        );
      });
    };

    socketRef.current.on("employee:location:update", mergeLiveEmployeeUpdate);
    socketRef.current.on("employee:status:update", mergeLiveEmployeeUpdate);

    socketRef.current.on("timeline:recomputed", () => {
      queryClient.invalidateQueries({
        queryKey: ["timeline", selectedEmployeeId, selectedDate],
      });
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user, queryClient, selectedEmployeeId, selectedDate]);

  // Reset playback when switching employees or changing selected date/timeline
  useEffect(() => {
    // Reset playback time and stop playing so UI resets cleanly
    // Defer with setTimeout to avoid synchronous state updates during render
    const t = setTimeout(() => {
      setIsPlaying(false);
      setPlaybackTime(0);
      setSelectedSessionId(null);
    }, 0);
    return () => clearTimeout(t);
  }, [selectedEmployeeId, selectedDate]);

  const selectedEmployee =
    employeesQuery.data?.find((e) => e.employeeId === selectedEmployeeId) || null;

  const timelineDurationSeconds = React.useMemo(() => {
    if (timelineQuery.data?.rawPoints?.length && timelineQuery.data.rawPoints.length > 0) {
      const points = timelineQuery.data.rawPoints;
      const first = new Date(points[0].capturedAt).getTime();
      const last = new Date(points[points.length - 1].capturedAt).getTime();
      return Math.max(0, (last - first) / 1000);
    }
    return 0;
  }, [timelineQuery.data]);

  return (
    <CrmContext.Provider
      value={{
        employees: employeesQuery.data || [],
        loadingEmployees: employeesQuery.isLoading,
        errorEmployees: employeesQuery.error?.message || null,
        selectedEmployeeId,
        selectedEmployee,
        selectEmployee,
        timeline: timelineQuery.data || null,
        loadingTimeline: timelineQuery.isLoading,
        errorTimeline: timelineQuery.error?.message || null,
        selectedDate,
        setSelectedDate,
        rebuildTimeline,
        isPlaying,
        setIsPlaying,
        playbackSpeed,
        setPlaybackSpeed,
        playbackTime,
        setPlaybackTime,
        timelineDurationSeconds,
        selectedSessionId,
        setSelectedSessionId,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
};

export const useCrm = () => {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error("useCrm must be used within a CrmProvider");
  }
  return context;
};
