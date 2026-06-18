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
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-center mb-6">Geo Tracker Client</h1>
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-center mb-6">Geo Tracker Client</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
          {error}
        </div>
      )}

      {!user ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Company ID</label>
            <input
              type="text"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Employee ID</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="text-sm">
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>Employee:</strong> {user.employeeId}</p>
              <p><strong>Company:</strong> {user.companyId}</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Logout
            </button>
          </div>

          {!todayAttendance && !user.attendanceId ? (
            <button
              onClick={handleCreateAttendance}
              disabled={isCreatingAttendance}
              className="w-full py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {isCreatingAttendance ? "Creating..." : "Check In"}
            </button>
          ) : selectedAttendance || user.attendanceId ? (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md">
                {/* eslint-disable-next-line react/no-unescaped-entities */}
                <h3 className="font-semibold mb-2">Today's Attendance</h3>
                <p><strong>Date:</strong> {new Date((selectedAttendance || todayAttendance)?.attendanceDate || today).toLocaleDateString()}</p>
                <p><strong>Check In At:</strong> {new Date((selectedAttendance || todayAttendance)?.firstCheckInAt || "").toLocaleString()}</p>
                <p><strong>Status:</strong> {(selectedAttendance || todayAttendance)?.status}</p>
              </div>

              {trackingState !== "active" && !(selectedAttendance || todayAttendance)?.finalCheckOutAt && (
                <button
                  onClick={startTracking}
                  disabled={trackingState !== "idle"}
                  className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Start Tracking
                </button>
              )}

              {trackingState === "active" && (
                <button
                  onClick={stopTracking}
                  className="w-full py-3 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                >
                  Stop Tracking
                </button>
              )}

              {!(selectedAttendance || todayAttendance)?.finalCheckOutAt && (
                <button
                  onClick={handleCheckOut}
                  disabled={isCheckingOut}
                  className="w-full py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
                >
                  {isCheckingOut ? "Checking Out..." : "Check Out"}
                </button>
              )}
            </div>
          ) : null}

          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="font-semibold mb-2">Status</h3>
            <p><strong>Tracking State:</strong> {trackingState}</p>
            <p><strong>Queued Points:</strong> {queue.length}</p>
            <p><strong>Last Sync:</strong> {lastSyncTime ? lastSyncTime.toLocaleString() : "Never"}</p>
            <p><strong>Total Distance Moved:</strong> {totalDistance.toFixed(2)} meters</p>
            {lastError && (
              <p className="text-red-600 mt-2"><strong>Last Error:</strong> {lastError}</p>
            )}
          </div>

          {attendances && attendances.length > 0 && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h3 className="font-semibold mb-2">Recent Attendances</h3>
              <div className="space-y-2">
                {attendances.slice(0, 5).map((attendance) => (
                  <div
                    key={attendance._id}
                    className={`p-3 rounded-md cursor-pointer ${
                      (selectedAttendance?._id || user.attendanceId) === attendance._id
                        ? "bg-blue-100 border border-blue-300"
                        : "bg-white border border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{new Date(attendance.attendanceDate).toLocaleDateString()}</span>
                      <span className="text-sm text-gray-500">{attendance.status}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
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
