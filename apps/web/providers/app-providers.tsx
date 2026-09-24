"use client";

import React from "react";
import { QueryProvider } from "./query-provider";
import { AuthProvider } from "../lib/auth/auth-context";
import { ToastProvider } from "../components/ui/toast";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
