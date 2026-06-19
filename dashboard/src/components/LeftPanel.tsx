"use client";

import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useCrm } from "@/context/CrmContext";
import { LiveLocationStatus } from "@/types";

const getStatusColor = (status: LiveLocationStatus, isStale: boolean) => {
  if (isStale) return { bg: "bg-gray-200", text: "text-gray-700" };
  switch (status) {
    case LiveLocationStatus.WORKING:
      return { bg: "bg-green-100", text: "text-green-800" };
    case LiveLocationStatus.ON_BREAK:
      return { bg: "bg-orange-100", text: "text-orange-800" };
    case LiveLocationStatus.OFFLINE:
      return { bg: "bg-gray-100", text: "text-gray-800" };
    case LiveLocationStatus.CHECKED_OUT:
      return { bg: "bg-red-100", text: "text-red-800" };
    default:
      return { bg: "bg-blue-100", text: "text-blue-800" };
  }
};

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
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className={`w-full lg:w-72 border-r border-gray-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 ${className}`}>
      <div className="p-4 border-b border-gray-200 dark:border-slate-800">
        <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-slate-100">Employees</h2>
        <input
          type="text"
          placeholder="Search employees..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-md text-sm placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="p-3 flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1 text-xs rounded-full border ${statusFilter === "all" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"}`}
        >
          All
        </button>
        {Object.values(LiveLocationStatus).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1 text-xs rounded-full border ${statusFilter === status ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"}`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingEmployees && (
          <div className="p-4 text-center text-gray-500 dark:text-slate-400">Loading employees...</div>
        )}
        {errorEmployees && (
          <div className="p-4 text-center text-red-600 dark:text-red-400">Error: {errorEmployees}</div>
        )}
        {!loadingEmployees && !errorEmployees && filteredEmployees.length === 0 && (
          <div className="p-4 text-center text-gray-500 dark:text-slate-400">No employees found</div>
        )}
        {filteredEmployees.map((emp) => {
          const statusStyle = getStatusColor(emp.status, emp.isStale);
          return (
            <div
              key={emp.employeeId}
              onClick={() => selectEmployee(emp.employeeId)}
              className={`p-4 border-b border-gray-100 dark:border-slate-800/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/30 ${selectedEmployeeId === emp.employeeId ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
            >
              <div className="flex justify-between items-start">
                <div className="font-medium text-gray-900 dark:text-slate-100">{emp.name}</div>
                <span className={`text-xs px-2 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text} ${emp.isStale ? "opacity-70" : ""}`}>
                  {emp.status}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Last seen: {formatDistanceToNow(new Date(emp.lastUpdatedAt), { addSuffix: true })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
