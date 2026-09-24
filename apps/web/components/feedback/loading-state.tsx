"use client";

import React from "react";
import { TableSkeleton } from "../ui/skeleton";

export function LoadingState({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="h-4 w-32 bg-slate-200 animate-pulse rounded" />
        <div className="h-8 w-24 bg-slate-200 animate-pulse rounded" />
      </div>
      <TableSkeleton rows={rows} cols={cols} />
    </div>
  );
}
