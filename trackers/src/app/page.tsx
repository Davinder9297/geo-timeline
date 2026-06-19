"use client";

import React, { useState } from "react";
import { useTracker } from "@/context/TrackerContext";
import type { AttendanceDaily } from "@/types";

export default function Home() {
  const {
    user,
    login,
    logout,
    trackingState,
    startTracking,
    stopTracking,
    queue,
    lastSyncTime,
    lastError,
    attendances,
    selectedAttendance,
    setSelectedAttendance,
    createAttendance,
    checkOutAttendance,
    isCreatingAttendance,
    isCheckingOut,
    totalDistance,
    isHydrated,
  } = useTracker();

  const [employeeId, setEmployeeId] = useState("emp-001");
  const [companyId, setCompanyId] = useState("acme-corp");
  const [password, setPassword] = useState("employee123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(companyId, employeeId, password);
    } catch {
      setError("Invalid credentials, please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAttendance = async () => {
    setError("");
    try {
      await createAttendance();
    } catch (err) {
      setError("Failed to create attendance: " + (err as Error).message);
    }
  };

  const handleCheckOut = async () => {
    setError("");
    try {
      await checkOutAttendance();
    } catch (err) {
      setError("Failed to check out: " + (err as Error).message);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const todayAttendance = attendances?.find(a => a.attendanceDate === today && !a.finalCheckOutAt);

  // Wait for hydration
  if (!isHydrated) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-white dark:bg-slate-900 min-h-screen text-gray-900 dark:text-slate-100">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">Geo Tracker Client</h1>
        <div className="text-center text-gray-500 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 bg-white dark:bg-slate-900 min-h-screen text-gray-900 dark:text-slate-100">
      <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">Geo Tracker Client</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-md text-sm">
          {error}
        </div>
      )}

      {!user ? (
        <form onSubmit={handleLogin} className="space-y-4 bg-gray-50 dark:bg-slate-800/30 p-6 rounded-lg border border-gray-100 dark:border-slate-800">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-slate-300">Company ID</label>
            <input
              type="text"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-slate-300">Employee ID</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-slate-300">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 cursor-pointer font-medium"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-800/30 p-4 rounded-md border border-gray-100 dark:border-slate-800">
            <div className="text-sm space-y-1">
              <p className="text-gray-700 dark:text-slate-300"><strong>Name:</strong> <span className="text-gray-900 dark:text-slate-100">{user.name}</span></p>
              <p className="text-gray-700 dark:text-slate-300"><strong>Employee:</strong> <span className="text-gray-900 dark:text-slate-100">{user.employeeId}</span></p>
              <p className="text-gray-700 dark:text-slate-300"><strong>Company:</strong> <span className="text-gray-900 dark:text-slate-100">{user.companyId}</span></p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 cursor-pointer text-sm font-medium"
            >
              Logout
            </button>
          </div>

          {!todayAttendance && !user.attendanceId ? (
            <button
              onClick={handleCreateAttendance}
              disabled={isCreatingAttendance}
              className="w-full py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 cursor-pointer font-semibold"
            >
              {isCreatingAttendance ? "Creating..." : "Check In"}
            </button>
          ) : selectedAttendance || user.attendanceId ? (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-md border border-gray-100 dark:border-slate-800">
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                <h3 className="font-semibold mb-2 text-gray-900 dark:text-slate-100">Today's Attendance</h3>
                <div className="text-sm space-y-1 text-gray-700 dark:text-slate-300">
                  <p><strong>Date:</strong> {new Date((selectedAttendance || todayAttendance)?.attendanceDate || today).toLocaleDateString()}</p>
                  <p><strong>Check In At:</strong> {new Date((selectedAttendance || todayAttendance)?.firstCheckInAt || "").toLocaleString()}</p>
                  <p><strong>Status:</strong> <span className="text-blue-600 dark:text-blue-400 font-semibold">{(selectedAttendance || todayAttendance)?.status}</span></p>
                </div>
              </div>

              {trackingState !== "active" && !(selectedAttendance || todayAttendance)?.finalCheckOutAt && (
                <button
                  onClick={startTracking}
                  disabled={trackingState !== "idle"}
                  className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer font-semibold"
                >
                  Start Tracking
                </button>
              )}

              {trackingState === "active" && (
                <button
                  onClick={stopTracking}
                  className="w-full py-3 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 cursor-pointer font-semibold"
                >
                  Stop Tracking
                </button>
              )}

              {!(selectedAttendance || todayAttendance)?.finalCheckOutAt && (
                <button
                  onClick={handleCheckOut}
                  disabled={isCheckingOut}
                  className="w-full py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 cursor-pointer font-semibold"
                >
                  {isCheckingOut ? "Checking Out..." : "Check Out"}
                </button>
              )}
            </div>
          ) : null}

          <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-md border border-gray-100 dark:border-slate-800">
            <h3 className="font-semibold mb-2 text-gray-900 dark:text-slate-100">Status</h3>
            <div className="text-sm space-y-1 text-gray-700 dark:text-slate-300">
              <p><strong>Tracking State:</strong> <span className="font-medium text-gray-900 dark:text-slate-200">{trackingState}</span></p>
              <p><strong>Queued Points:</strong> <span className="font-medium text-gray-900 dark:text-slate-200">{queue.length}</span></p>
              <p><strong>Last Sync:</strong> <span className="font-medium text-gray-900 dark:text-slate-200">{lastSyncTime ? lastSyncTime.toLocaleString() : "Never"}</span></p>
              <p><strong>Total Distance Moved:</strong> <span className="font-medium text-gray-900 dark:text-slate-200">{totalDistance.toFixed(2)} meters</span></p>
            </div>
            {lastError && (
              <p className="text-red-600 dark:text-red-400 mt-2 text-sm"><strong>Last Error:</strong> {lastError}</p>
            )}
          </div>

          {attendances && attendances.length > 0 && (
            <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-md border border-gray-100 dark:border-slate-800">
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-slate-100">Recent Attendances</h3>
              <div className="space-y-2">
                {attendances.slice(0, 5).map((attendance) => (
                  <div
                    key={attendance._id}
                    className={`p-3 rounded-md cursor-pointer transition-colors ${
                      (selectedAttendance?._id || user.attendanceId) === attendance._id
                        ? "bg-blue-100 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800/50"
                        : "bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900 dark:text-slate-100">{new Date(attendance.attendanceDate).toLocaleDateString()}</span>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{attendance.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      Check In: {new Date(attendance.firstCheckInAt).toLocaleTimeString()}
                      {attendance.finalCheckOutAt && ` | Check Out: ${new Date(attendance.finalCheckOutAt).toLocaleTimeString()}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
