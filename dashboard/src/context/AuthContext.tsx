"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CONFIG } from "@/config";
import { UserState, UserRole } from "../types";

interface AuthContextType {
  user: UserState | null;
  isLoading: boolean;
  login: (companyId: string, employeeId: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserState | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [isHydrated, setIsHydrated] = useState(false);
  const router = useRouter();

  // Hydration: Load from localStorage after client mount
  useEffect(() => {
    const savedUser = localStorage.getItem("crm_user");
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Check if user has valid role
        if (parsedUser.role === UserRole.ADMIN || parsedUser.role === UserRole.MANAGER) {
          setUser(parsedUser);
        } else {
          // Invalid role, remove from localStorage
          localStorage.removeItem("crm_user");
        }
      } catch (e) {
        console.error("[AuthContext] Failed to parse saved user:", e);
        localStorage.removeItem("crm_user");
      }
    }
    setIsLoading(false);
    setIsHydrated(true);
  }, []);

  const login = async (companyId: string, employeeId: string, password: string) => {
    console.log("[AuthContext] Logging in...");
    const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, employeeId, password }),
    });

    if (!response.ok) throw new Error("Login failed");

    const data = await response.json();
    console.log("[AuthContext] Login response:", data);
    const newUser: UserState = {
      isAuthenticated: true,
      companyId: data.employee.companyId,
      employeeId: data.employee.employeeId,
      name: data.employee.name,
      role: data.employee.role as UserRole,
      token: data.accessToken,
    };

    // Check if user has admin or manager role
    if (newUser.role !== UserRole.ADMIN && newUser.role !== UserRole.MANAGER) {
      throw new Error("You do not have permission to access the dashboard");
    }

    setUser(newUser);
    localStorage.setItem("crm_user", JSON.stringify(newUser));
    console.log("[AuthContext] User saved to localStorage");
    router.push("/");
  };

  const logout = () => {
    console.log("[AuthContext] Logging out...");
    setUser(null);
    localStorage.removeItem("crm_user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
