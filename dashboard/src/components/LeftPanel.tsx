"use client";

import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useCrm } from "@/context/CrmContext";
import { LiveLocationStatus } from "@/types";

// Only real, assignable statuses are filterable — STALE is a derived overlay
// (isStale) shown as a badge/dot on top of an employee's real status, not a
// distinct state someone can be filtered into.
const FILTERABLE_STATUSES = [
  LiveLocationStatus.WORKING,
  LiveLocationStatus.ON_BREAK,
  LiveLocationStatus.OFFLINE,
  LiveLocationStatus.CHECKED_OUT,
] as const;

const STATUS_STYLES: Record<LiveLocationStatus, { dot: string; bg: string; text: string }> = {
  [LiveLocationStatus.WORKING]: { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300" },
  [LiveLocationStatus.ON_BREAK]: { dot: "bg-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-300" },
  [LiveLocationStatus.OFFLINE]: { dot: "bg-slate-400", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300" },
  [LiveLocationStatus.STALE]: { dot: "bg-slate-400", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300" },
  [LiveLocationStatus.CHECKED_OUT]: { dot: "bg-rose-500", bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-300" },
};

const initials = (name: string) =>
  (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

export const LeftPanel = ({ className = "" }: { className?: string }) => {
  const {
    employees,
    loadingEmployees,
    errorEmployees,
    selectedEmployeeId,
    selectEmployee,
  } = useCrm();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LiveLocationStatus | "all">("all");

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = (emp.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const workingCount = employees.filter((e) => e.status === LiveLocationStatus.WORKING).length;

  return (
    <div className={`w-full lg:w-80 border-r border-gray-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 ${className}`}>
      <div className="p-4 border-b border-gray-100 dark:border-slate-800/70">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Employees</h2>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
            {workingCount} active
          </span>
        </div>
        <div className="relative">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg text-sm placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="p-3 flex flex-wrap gap-1.5 border-b border-gray-100 dark:border-slate-800/70">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1 text-xs font-medium rounded-full border cursor-pointer transition-colors ${
            statusFilter === "all"
              ? "border-transparent bg-gradient-to-r from-cyan-500 to-violet-500 text-white"
              : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
          }`}
        >
          All
        </button>
        {FILTERABLE_STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1 text-xs font-medium rounded-full border cursor-pointer transition-colors capitalize ${
              statusFilter === status
                ? "border-transparent bg-gradient-to-r from-cyan-500 to-violet-500 text-white"
                : "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
            }`}
          >
            {status.replace("_", " ").toLowerCase()}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingEmployees && (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-slate-400">Loading employees…</div>
        )}
        {errorEmployees && (
          <div className="p-4 text-center text-sm text-red-600 dark:text-red-400">Error: {errorEmployees}</div>
        )}
        {!loadingEmployees && !errorEmployees && filteredEmployees.length === 0 && (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-slate-400">No employees found</div>
        )}
        {filteredEmployees.map((emp) => {
          // Staleness only matters while someone is supposed to be active —
          // once checked out, going stale is expected, not a warning, so
          // never let it override a CHECKED_OUT employee's color or label.
          const isStaleWhileActive = emp.isStale && emp.status !== LiveLocationStatus.CHECKED_OUT;
          const style = isStaleWhileActive
            ? STATUS_STYLES[LiveLocationStatus.STALE]
            : STATUS_STYLES[emp.status] || STATUS_STYLES[LiveLocationStatus.OFFLINE];
          const isSelected = selectedEmployeeId === emp.employeeId;
          return (
            <div
              key={emp.employeeId}
              onClick={() => selectEmployee(emp.employeeId)}
              className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-slate-800/50 cursor-pointer transition-colors ${
                isSelected
                  ? "bg-cyan-50/60 dark:bg-cyan-950/20"
                  : "hover:bg-gray-50 dark:hover:bg-slate-800/30"
              }`}
            >
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-xs font-bold text-white">
                  {initials(emp.name)}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${style.dot} ${
                    isStaleWhileActive ? "opacity-50" : ""
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-slate-100 truncate">{emp.name}</span>
                  <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                    {isStaleWhileActive ? "Stale" : emp.status.replace("_", " ")}
                  </span>
                </div>
                <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {formatDistanceToNow(new Date(emp.lastUpdatedAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
