"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "../api/types";
import { api, ApiError } from "../api/client";
import { tokenStorage } from "./token-storage";
import { hasPermission } from "../permissions/rbac";
import { useRouter, usePathname } from "next/navigation";

interface AuthContextType {
  user: User | null;
  tenantId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  permissions: string[];
  login: (tenantId: string, email: string, passwordPlain: string) => Promise<void>;
  register: (
    tenantId: string,
    email: string,
    passwordPlain: string,
    firstName: string,
    lastName: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = ["/login"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => tokenStorage.getUserCache());
  const [tenantId, setTenantId] = useState<string | null>(() => tokenStorage.getTenantId());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  const fetchCurrentUser = useCallback(async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setUser(null);
      setTenantId(null);
      setIsLoading(false);
      return;
    }

    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
      setTenantId(me.tenantId);
      tokenStorage.setUserCache(me);
      tokenStorage.setTenantId(me.tenantId);

      // Default Admin role check for admin email or admin attributes
      if (me.email.toLowerCase().includes("admin") || me.email === "admin@acmetextiles.com") {
        setPermissions(["*"]);
      } else {
        setPermissions([
          "FACTORY:READ",
          "LINE:READ",
          "MACHINE:READ",
          "EMPLOYEE:READ",
          "STYLE:READ",
          "BUYER:READ",
          "SUPPLIER:READ",
          "COSTING:READ",
          "BUYER_PO:READ",
          "VPO:READ",
          "WAREHOUSE:READ",
        ]);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.statusCode === 401) {
        tokenStorage.clearAll();
        setUser(null);
        setTenantId(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Route protection
  useEffect(() => {
    if (isLoading) return;

    const isPublic = PUBLIC_ROUTES.some((route) => pathname?.startsWith(route));
    const token = tokenStorage.getAccessToken();

    if (!token && !isPublic) {
      router.replace("/login");
    } else if (token && pathname === "/login") {
      router.replace("/dashboard");
    }
  }, [pathname, isLoading, router]);

  const login = async (tenantId: string, email: string, passwordPlain: string) => {
    setIsLoading(true);
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        "/auth/login",
        { tenantId, email, password: passwordPlain },
        { skipAuth: true }
      );

      tokenStorage.setAccessToken(res.accessToken);
      tokenStorage.setRefreshToken(res.refreshToken);
      tokenStorage.setTenantId(tenantId);
      setTenantId(tenantId);

      await fetchCurrentUser();
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    tenantId: string,
    email: string,
    passwordPlain: string,
    firstName: string,
    lastName: string
  ) => {
    setIsLoading(true);
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        "/auth/register",
        { tenantId, email, password: passwordPlain, firstName, lastName },
        { skipAuth: true }
      );

      tokenStorage.setAccessToken(res.accessToken);
      tokenStorage.setRefreshToken(res.refreshToken);
      tokenStorage.setTenantId(tenantId);
      setTenantId(tenantId);

      await fetchCurrentUser();
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout", {}).catch(() => {});
    } finally {
      tokenStorage.clearAll();
      setUser(null);
      setTenantId(null);
      setPermissions([]);
      router.push("/login");
    }
  };

  const isAdmin = permissions.includes("*") || user?.email === "admin@acmetextiles.com";

  const can = (permission: string): boolean => {
    return hasPermission(permissions, permission, isAdmin);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenantId,
        isAuthenticated: !!user,
        isLoading,
        isAdmin,
        permissions,
        login,
        register,
        logout,
        can,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
