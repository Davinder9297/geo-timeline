"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { LeftPanel } from "@/components/LeftPanel";
import { Map } from "@/components/Map";
import { RightPanel } from "@/components/RightPanel";
import { useCrm } from "@/context/CrmContext";

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth();
  const { selectedEmployee, selectedEmployeeId } = useCrm();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"employees" | "map" | "timeline">("map");

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        console.log("[DashboardPage] No user, redirecting to login...");
        router.push("/login");
      } else if (user.role !== "ADMIN" && user.role !== "MANAGER") {
        console.log("[DashboardPage] User does not have permission, logging out...");
        logout();
      }
    }
  }, [user, router, isLoading, logout]);

  // When an employee is selected, switch to map view on mobile
  useEffect(() => {
    if (selectedEmployeeId) {
      setActiveTab("map");
    }
  }, [selectedEmployeeId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
      <div className="h-14 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-6 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-500 shrink-0" />
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-gray-900 dark:text-slate-100 truncate">
            Employee Location Tracking System
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {selectedEmployee && (
            <div className="text-sm text-gray-600 dark:text-slate-300 hidden md:block">
              Viewing: <span className="font-semibold text-cyan-600 dark:text-cyan-400">{selectedEmployee.name}</span>
            </div>
          )}
          <button
            onClick={logout}
            className="px-4 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium cursor-pointer transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <LeftPanel className={activeTab === "employees" ? "flex" : "hidden lg:flex"} />
        
        <div className={`flex-1 h-full relative ${activeTab === "map" ? "block" : "hidden lg:block"}`}>
          <Map />
        </div>

        {selectedEmployee && (
          <RightPanel className={activeTab === "timeline" ? "flex" : "hidden lg:flex"} />
        )}
      </div>

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden h-16 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-around px-4 shrink-0">
        <button
          onClick={() => setActiveTab("employees")}
          className={`flex-1 py-2 text-center text-xs font-semibold rounded-md ${
            activeTab === "employees"
              ? "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20"
              : "text-gray-500 dark:text-slate-400"
          }`}
        >
          Employees
        </button>
        <button
          onClick={() => setActiveTab("map")}
          className={`flex-1 py-2 text-center text-xs font-semibold rounded-md ${
            activeTab === "map"
              ? "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20"
              : "text-gray-500 dark:text-slate-400"
          }`}
        >
          Map
        </button>
        <button
          onClick={() => {
            if (selectedEmployee) setActiveTab("timeline");
          }}
          disabled={!selectedEmployee}
          className={`flex-1 py-2 text-center text-xs font-semibold rounded-md ${
            !selectedEmployee
              ? "opacity-40 cursor-not-allowed text-gray-400 dark:text-slate-600"
              : activeTab === "timeline"
              ? "text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20"
              : "text-gray-500 dark:text-slate-400"
          }`}
        >
          Timeline
        </button>
      </div>
    </div>
  );
}
