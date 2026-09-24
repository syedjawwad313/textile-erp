"use client";

import React from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";

interface ForbiddenStateProps {
  requiredPermission?: string;
  moduleName?: string;
}

export function ForbiddenState({
  requiredPermission,
  moduleName = "this module",
}: ForbiddenStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-slate-200 rounded-lg bg-white">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-600 mb-4">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">Access Restricted</h3>
      <p className="text-xs text-slate-500 max-w-md mt-1 mb-2 leading-relaxed">
        You do not have the required RBAC permissions to access {moduleName}.
      </p>
      {requiredPermission && (
        <code className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-700 mb-6">
          Required: {requiredPermission}
        </code>
      )}
      <Link href="/dashboard">
        <Button variant="outline" size="sm">
          <ArrowLeft className="w-3.5 h-3.5" />
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
