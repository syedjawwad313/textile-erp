"use client";

import React from "react";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  variant?: "danger" | "primary";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false,
  variant = "primary",
}: ConfirmDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex items-start gap-4">
        {variant === "danger" && (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 text-red-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1 text-sm text-slate-600 leading-relaxed">{message}</div>
      </div>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "primary"}
          size="sm"
          onClick={onConfirm}
          isLoading={isLoading}
        >
          {confirmText}
        </Button>
      </div>
    </Dialog>
  );
}
