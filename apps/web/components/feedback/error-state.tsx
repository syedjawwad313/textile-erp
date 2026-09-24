"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Failed to load data",
  message = "An error occurred while communicating with the server. Please verify your connection or permissions.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-red-200 rounded-lg bg-red-50/40">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-4">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-red-900">{title}</h3>
      <p className="text-xs text-red-700 max-w-md mt-1 mb-5 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Request
        </Button>
      )}
    </div>
  );
}
