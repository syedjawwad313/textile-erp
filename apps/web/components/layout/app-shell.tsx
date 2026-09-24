"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { X } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      {/* Desktop & Tablet Sidebar */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative flex w-64 max-w-xs flex-1 flex-col bg-slate-900 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="absolute top-2 right-2 p-1">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Close Sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
