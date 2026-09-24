"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../lib/auth/auth-context";
import { LogOut, Building2, User as UserIcon, Calendar, Menu, Shield } from "lucide-react";
import { Button } from "../ui/button";

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, tenantId, logout, isAdmin } = useAuth();
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const d = new Date();
    setCurrentDate(
      d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    );
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-sm">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Tenant Indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
          <Building2 className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-500">Tenant:</span>
          <span className="font-semibold text-slate-900">
            {tenantId || "Loading..."}
          </span>
        </div>

        {/* Live Date Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentDate}</span>
        </div>
      </div>

      {/* User info & Actions */}
      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                {user.firstName} {user.lastName}
                {isAdmin && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                    <Shield className="w-2.5 h-2.5" /> ADMIN
                  </span>
                )}
              </span>
              <span className="text-[11px] text-slate-500">{user.email}</span>
            </div>

            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
              {user.firstName ? user.firstName[0] : "U"}
              {user.lastName ? user.lastName[0] : ""}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-slate-500 hover:text-red-600 hover:bg-red-50 p-1.5"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline text-xs ml-1">Logout</span>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <UserIcon className="w-4 h-4" />
            <span>Not authenticated</span>
          </div>
        )}
      </div>
    </header>
  );
}
