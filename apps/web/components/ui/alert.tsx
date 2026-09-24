"use client";

import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../../lib/utils/cn";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "warning" | "danger" | "success";
  title?: string;
}

export function Alert({
  className,
  variant = "info",
  title,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 p-4 rounded-lg border text-sm",
        variant === "info" && "bg-blue-50/70 border-blue-200 text-blue-900",
        variant === "warning" && "bg-amber-50/70 border-amber-200 text-amber-900",
        variant === "danger" && "bg-red-50/70 border-red-200 text-red-900",
        variant === "success" && "bg-emerald-50/70 border-emerald-200 text-emerald-900",
        className
      )}
      {...props}
    >
      <div className="shrink-0 mt-0.5">
        {variant === "info" && <Info className="w-5 h-5 text-blue-600" />}
        {variant === "warning" && <AlertTriangle className="w-5 h-5 text-amber-600" />}
        {variant === "danger" && <AlertCircle className="w-5 h-5 text-red-600" />}
        {variant === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
      </div>
      <div className="space-y-1">
        {title && <h5 className="font-semibold leading-none tracking-tight">{title}</h5>}
        <div className="text-xs text-slate-700 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
