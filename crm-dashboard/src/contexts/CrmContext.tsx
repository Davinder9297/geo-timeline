import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { LiveEmployee, TimelineResponse } from '../types';
import { LiveLocationStatus } from '../types';
import { CONFIG } from '../config';
import { useAuth } from './AuthContext';

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
} | null>(null);

export const CrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<LiveEmployee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [errorEmployees, setErrorEmployees] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [errorTimeline, setErrorTimeline] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const socketRef = useRef<Socket | null>(null);

  const fetchEmployees = useCallback(
    async (statusFilter?: LiveLocationStatus) => {
      if (!user) return;
      setLoadingEmployees(true);
      setErrorEmployees(null);
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        const response = await fetch(
          `${CONFIG.API_BASE_URL}/companies/${user.companyId}/geo/live-employees?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${user.token}`,
            },
          }
        );
        if (!response.ok) throw new Error('Failed to fetch employees');
        const data = await response.json();
        setEmployees(data.data);
      } catch (e) {
        setErrorEmployees((e as Error).message);
      } finally {
        setLoadingEmployees(false);
      }
    },
    [user]
  );

  const fetchTimeline = useCallback(
    async (employeeId: string, date: string) => {
      if (!user) return;
      setLoadingTimeline(true);
      setErrorTimeline(null);
      try {
        const params = new URLSearchParams();
        params.set('date', date);
        const response = await fetch(
          `${CONFIG.API_BASE_URL}/companies/${user.companyId}/employees/${employeeId}/geo-timeline?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${user.token}`,
            },
          }
        );
        if (!response.ok) throw new Error('Failed to fetch timeline');
        const data = await response.json();
        setTimeline(data.data);
      } catch (e) {
        setErrorTimeline((e as Error).message);
      } finally {
        setLoadingTimeline(false);
      }
    },
    [user]
  );

  const selectEmployee = useCallback(
    (employeeId: string) => {
      setSelectedEmployeeId(employeeId);
      fetchTimeline(employeeId, selectedDate);
    },
    [fetchTimeline, selectedDate]
  );

  const rebuildTimeline = useCallback(
    async (attendanceId: string) => {
      if (!user) return;
      await fetch(`${CONFIG.API_BASE_URL}/companies/${user.companyId}/attendance/${attendanceId}/geo-timeline/rebuild`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (selectedEmployeeId) {
        fetchTimeline(selectedEmployeeId, selectedDate);
      }
    },
    [user, selectedEmployeeId, selectedDate, fetchTimeline]
  );

  useEffect(() => {
    if (!user) return;
    fetchEmployees();

    socketRef.current = io(CONFIG.WS_URL, {
      extraHeaders: {
        Authorization: `Bearer ${user.token}`,
      },
    });

    socketRef.current.on('connect', () => {
      socketRef.current?.emit('company:subscribe', { companyId: user.companyId });
    });

    socketRef.current.on('employee:location:update', (data: LiveEmployee) => {
      setEmployees(prev => prev.map(e => e.employeeId === data.employeeId ? data : e));
    });

    socketRef.current.on('employee:status:update', (data: LiveEmployee) => {
      setEmployees(prev => prev.map(e => e.employeeId === data.employeeId ? data : e));
    });

    socketRef.current.on('timeline:recomputed', () => {
      if (selectedEmployeeId) {
        fetchTimeline(selectedEmployeeId, selectedDate);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user, fetchEmployees, selectedEmployeeId, selectedDate, fetchTimeline]);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchTimeline(selectedEmployeeId, selectedDate);
    }
  }, [selectedEmployeeId, selectedDate, fetchTimeline]);

  const selectedEmployee = employees.find(e => e.employeeId === selectedEmployeeId) || null;

  return (
    <CrmContext.Provider
      value={{
        employees,
        loadingEmployees,
        errorEmployees,
        selectedEmployeeId,
        selectedEmployee,
        selectEmployee,
        timeline,
        loadingTimeline,
        errorTimeline,
        selectedDate,
        setSelectedDate,
        rebuildTimeline,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
};

export const useCrm = () => {
  const context = useContext(CrmContext);
  if (!context) throw new Error('useCrm must be used within a CrmProvider');
  return context;
};
