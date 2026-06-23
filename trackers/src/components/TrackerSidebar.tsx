"use client";

import React, { useState } from "react";
import { useTracker } from "@/context/TrackerContext";
import { StatsPanel } from "@/components/StatsPanel";
import { formatTime } from "@/utils";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

interface TrackerSidebarProps {
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

export const TrackerSidebar = ({ selectedSessionId, onSelectSession }: TrackerSidebarProps) => {
  const {
    user,
    logout,
    queue,
    lastSyncTime,
    lastError,
    attendances,
    selectedAttendance,
    createAttendance,
    checkOutAttendance,
    isCreatingAttendance,
    isCheckingOut,
    totalDistance,
    selectedTimelineDate,
    setSelectedTimelineDate,
    timeline,
    loadingTimeline,
    errorTimeline,
    stats,
    loadingStats,
  } = useTracker();

  const [error, setError] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const isToday = selectedTimelineDate === today;
  const todayAttendance = attendances?.find((a) => a.attendanceDate === today);
  const activeAttendance = selectedAttendance || todayAttendance;
  const todaySessions = activeAttendance?.sessions || [];
  const lastTodaySession = todaySessions[todaySessions.length - 1];
  const hasOpenSession = !!lastTodaySession && !lastTodaySession.checkOutAt;

  const dayAttendance = timeline?.attendance;
  const daySessions = dayAttendance?.sessions || [];

  const handleCreateAttendance = async () => {
    setError("");
    try {
      await createAttendance();
    } catch (err) {
      setError((err as Error).message || "Failed to check in");
    }
  };

  const handleCheckOut = async () => {
    setError("");
    try {
      await checkOutAttendance();
    } catch (err) {
      setError((err as Error).message || "Failed to check out");
    }
  };

  return (
    <div className="flex flex-col h-full text-white">
      {/* Profile header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-xs font-bold shrink-0">
            {initials(user?.name || "")}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{user?.name}</div>
            <div className="text-[11px] text-white/40 truncate">{user?.employeeId}</div>
          </div>
        </div>
        <button
          onClick={logout}
          title="Log out"
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {error && (
          <div className="px-3 py-2 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-xl text-xs">
            {error}
          </div>
        )}

        {/* Status hero */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-2.5 w-2.5">
              {hasOpenSession && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  hasOpenSession ? "bg-emerald-400" : "bg-white/30"
                }`}
              />
            </span>
            <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
              {hasOpenSession ? "Live · Tracking" : "Off the clock"}
            </span>
          </div>

          {!hasOpenSession ? (
            <button
              onClick={handleCreateAttendance}
              disabled={isCreatingAttendance}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-semibold text-sm cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isCreatingAttendance ? "Checking in…" : "Check In"}
            </button>
          ) : (
            <button
              onClick={handleCheckOut}
              disabled={isCheckingOut}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-400 to-orange-400 text-slate-950 font-semibold text-sm cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isCheckingOut ? "Checking out…" : "Check Out"}
            </button>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wide">Sessions today</div>
              <div className="text-sm font-semibold mt-0.5">{todaySessions.length}</div>
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wide">Distance</div>
              <div className="text-sm font-semibold mt-0.5">{(totalDistance / 1000).toFixed(2)} km</div>
            </div>
          </div>
        </div>

        {/* Date selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide">Browse day</h3>
            {!isToday && (
              <button
                onClick={() => setSelectedTimelineDate(today)}
                className="text-[11px] text-cyan-300 hover:text-cyan-200 cursor-pointer"
              >
                Jump to today
              </button>
            )}
          </div>
          <input
            type="date"
            value={selectedTimelineDate}
            max={today}
            onChange={(e) => setSelectedTimelineDate(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40 [color-scheme:dark]"
          />
        </div>

        {/* Sessions for selected day */}
        {loadingTimeline && (
          <div className="text-xs text-white/40 px-1">Loading sessions…</div>
        )}
        {!loadingTimeline && errorTimeline && (
          <div className="text-xs text-rose-300 px-1">{errorTimeline}</div>
        )}
        {!loadingTimeline && !errorTimeline && daySessions.length === 0 && (
          <div className="text-xs text-white/40 px-1">
            {user?.name} {isToday ? "has" : "had"} not checked in on{" "}
            {new Date(selectedTimelineDate).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}
        {daySessions.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">
              Sessions · {new Date(selectedTimelineDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </h3>
            <div className="space-y-1.5">
              {daySessions.map((s, i) => {
                const isSelected = selectedSessionId === s.sessionId;
                return (
                  <button
                    key={s.sessionId}
                    onClick={() => onSelectSession(s.sessionId)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-sm cursor-pointer transition-colors border ${
                      isSelected
                        ? "border-cyan-400/40 bg-cyan-400/10"
                        : "border-white/10 bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-white/40 text-xs w-4">{i + 1}</span>
                      <span>
                        {new Date(s.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {s.checkOutAt
                          ? new Date(s.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "now"}
                      </span>
                    </span>
                    {!s.checkOutAt && (
                      <span className="text-[10px] font-medium text-emerald-300 uppercase tracking-wide shrink-0">
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Day summary */}
        {timeline?.summaryAvailable && timeline.totals && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wide">Working</div>
              <div className="text-sm font-semibold mt-0.5">{formatTime(timeline.totals.workingSeconds)}</div>
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wide">Break</div>
              <div className="text-sm font-semibold mt-0.5">{formatTime(timeline.totals.breakSeconds)}</div>
            </div>
          </div>
        )}

        {/* 7-day stats */}
        <StatsPanel stats={stats} loading={loadingStats} />

        {/* Diagnostics (collapsed by default) */}
        <div>
          <button
            onClick={() => setShowDiagnostics((v) => !v)}
            className="text-[11px] text-white/30 hover:text-white/50 cursor-pointer"
          >
            {showDiagnostics ? "Hide" : "Show"} sync diagnostics
          </button>
          {showDiagnostics && (
            <div className="mt-2 bg-white/5 border border-white/10 rounded-xl p-3 text-[11px] text-white/50 space-y-1">
              <div>Queued points: {queue.length}</div>
              <div>Last sync: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : "Never"}</div>
              {lastError && <div className="text-rose-300">{lastError}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
