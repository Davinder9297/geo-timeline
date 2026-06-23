"use client";

import React, { useEffect, useState } from "react";
import { useTracker } from "@/context/TrackerContext";
import { TrackerMap } from "@/components/TrackerMap";
import { TrackerSidebar } from "@/components/TrackerSidebar";
import { getSessionColor } from "@/utils";

function AuthScreen() {
  const { login, signup } = useTracker();
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (authMode === "login") {
        await login(employeeId, password);
      } else {
        await signup(employeeId, name, password);
      }
    } catch (err) {
      setError(
        authMode === "login"
          ? "Invalid credentials, please try again."
          : (err as Error).message || "Sign up failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-20 w-96 h-96 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Employee Location Tracking System</h1>
          <p className="text-xs text-white/40 mt-1">Live attendance & location tracking</p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
          <div className="flex mb-6 bg-white/5 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className={`flex-1 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${
                authMode === "login" ? "bg-white/10 text-white" : "text-white/40"
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${
                authMode === "signup" ? "bg-white/10 text-white" : "text-white/40"
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-xl text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-white/50">Employee ID</label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              />
            </div>

            {authMode === "signup" && (
              <div>
                <label className="block text-xs font-medium mb-1.5 text-white/50">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1.5 text-white/50">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 font-semibold text-sm cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading
                ? authMode === "login" ? "Logging in…" : "Creating account…"
                : authMode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, isHydrated, currentLocation, timeline, selectedTimelineDate } = useTracker();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"route" | "sequence">("route");
  const [mobileView, setMobileView] = useState<"map" | "panel">("map");

  const today = new Date().toISOString().split("T")[0];

  // Default the selected session to the currently-open one (or most recent)
  // whenever the timeline for the chosen date loads.
  useEffect(() => {
    const sessions = timeline?.attendance?.sessions || [];
    if (sessions.length === 0) {
      setSelectedSessionId(null);
      return;
    }
    const open = sessions.find((s) => !s.checkOutAt);
    setSelectedSessionId((open || sessions[sessions.length - 1]).sessionId);
  }, [timeline]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-white/40 text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const sessions = timeline?.attendance?.sessions || [];
  const sessionIdx = sessions.findIndex((s) => s.sessionId === selectedSessionId);
  const selectedSession = sessionIdx >= 0 ? sessions[sessionIdx] : null;
  const sessionColor = getSessionColor(sessionIdx >= 0 ? sessionIdx : 0);

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-white/10 bg-slate-950">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 shrink-0" />
          <span className="text-sm font-bold text-white tracking-tight truncate">
            <span className="sm:hidden">ELTS</span>
            <span className="hidden sm:inline">Employee Location Tracking System</span>
          </span>
        </div>
        <div className="flex lg:hidden bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => setMobileView("map")}
            className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
              mobileView === "map" ? "bg-white/10 text-white" : "text-white/40"
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setMobileView("panel")}
            className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
              mobileView === "panel" ? "bg-white/10 text-white" : "text-white/40"
            }`}
          >
            Panel
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`w-full lg:w-[360px] shrink-0 border-r border-white/10 bg-slate-950 ${
            mobileView === "panel" ? "flex" : "hidden lg:flex"
          }`}
        >
          <TrackerSidebar selectedSessionId={selectedSessionId} onSelectSession={setSelectedSessionId} />
        </aside>

        {/* Map — takes priority space */}
        <main className={`flex-1 relative ${mobileView === "map" ? "block" : "hidden lg:block"}`}>
          <TrackerMap
            timeline={timeline}
            selectedSessionId={selectedSessionId}
            currentLocation={selectedTimelineDate === today ? currentLocation : null}
            viewMode={viewMode}
          />

          {/* Floating view-mode toggle */}
          <div className="absolute top-4 right-4 flex bg-slate-950/80 backdrop-blur border border-white/10 rounded-xl p-1 shadow-lg">
            <button
              onClick={() => setViewMode("route")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                viewMode === "route" ? "bg-white/10 text-white" : "text-white/40"
              }`}
            >
              Route
            </button>
            <button
              onClick={() => setViewMode("sequence")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                viewMode === "sequence" ? "bg-white/10 text-white" : "text-white/40"
              }`}
            >
              Sequence
            </button>
          </div>

          {/* Floating selected-session pill */}
          {selectedSession && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-slate-950/80 backdrop-blur border border-white/10 rounded-xl px-3 py-2 shadow-lg">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sessionColor }} />
              <span className="text-xs font-medium text-white">
                Session {sessionIdx + 1} ·{" "}
                {new Date(selectedSession.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {" – "}
                {selectedSession.checkOutAt
                  ? new Date(selectedSession.checkOutAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "now"}
              </span>
            </div>
          )}

          {/* Floating live indicator */}
          {currentLocation && selectedTimelineDate === today && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-slate-950/80 backdrop-blur border border-white/10 rounded-xl px-3 py-2 shadow-lg">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
              </span>
              <span className="text-xs font-medium text-white/80">Live location</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
