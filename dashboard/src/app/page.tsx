"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { LeftPanel } from "@/components/LeftPanel";
import { Map } from "@/components/Map";
import { RightPanel } from "@/components/RightPanel";
import { useCrm } from "@/context/CrmContext";

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth();
  const { selectedEmployee } = useCrm();
  const router = useRouter();

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

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-6 bg-white">
        <h1 className="text-lg font-semibold">Geo Timeline CRM</h1>
        <div className="flex items-center gap-4">
          {selectedEmployee && (
            <div className="text-sm text-gray-600">
              Viewing: <span className="font-medium">{selectedEmployee.name}</span>
            </div>
          )}
          <button
            onClick={logout}
            className="px-4 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
          >
            Logout
          </button>
        </div>
      </div>
      <div className="flex-1 flex">
        <LeftPanel />
        <Map />
        {selectedEmployee && <RightPanel />}
      </div>
    </div>
  );
}
