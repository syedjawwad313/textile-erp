"use client";

import React from "react";
import { Inbox, Plus } from "lucide-react";
import { Button } from "../ui/button";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = "No records found",
  description = "Get started by creating your first entry.",
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-4">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mt-1 mb-5">{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          <Plus className="w-3.5 h-3.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
