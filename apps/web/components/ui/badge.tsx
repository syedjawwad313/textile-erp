"use client";

import React from "react";
import { cn } from "../../lib/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "neutral"
    | "outline";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full tracking-wide",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        variant === "default" && "bg-slate-100 text-slate-800 border border-slate-200",
        variant === "success" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
        variant === "warning" && "bg-amber-50 text-amber-700 border border-amber-200",
        variant === "danger" && "bg-red-50 text-red-700 border border-red-200",
        variant === "info" && "bg-blue-50 text-blue-700 border border-blue-200",
        variant === "neutral" && "bg-slate-100 text-slate-600 border border-slate-200",
        variant === "outline" && "border border-slate-300 text-slate-700 bg-transparent",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
