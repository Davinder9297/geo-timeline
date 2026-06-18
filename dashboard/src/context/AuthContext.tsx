"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CONFIG } from "@/config";
import type { UserState, UserRole } from "../types";

interface AuthContextType {
  user: UserState | null;
  isLoading: boolean;
  login: (companyId: string, employeeId: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log("[AuthContext] Checking for saved user...");
    const savedUser = localStorage.getItem("crm_user");
    console.log("[AuthContext] Saved user found:", !!savedUser);
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        console.log("[AuthContext] Parsed user:", parsedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error("[AuthContext] Failed to parse saved user:", e);
        localStorage.removeItem("crm_user");
      }
    }
    setIsLoading(false);
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
