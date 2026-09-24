"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Style } from "../../lib/api/types";
import { useCreateStyle, useUpdateStyle } from "../../hooks/use-master-data";
import { useToast } from "../ui/toast";

interface StyleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  style?: Style | null;
}

export function StyleDialog({ isOpen, onClose, style }: StyleDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toast = useToast();
  const createMutation = useCreateStyle();
  const updateMutation = useUpdateStyle();

  const isEdit = !!style;

  useEffect(() => {
    if (style) {
      setCode(style.code);
      setName(style.name);
    } else {
      setCode("");
      setName("");
    }
    setErrors({});
  }, [style, isOpen]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isEdit && !code.trim()) {
      errs.code = "Style code is required";
    }
    if (!name.trim()) {
      errs.name = "Style name is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isEdit && style) {
        await updateMutation.mutateAsync({
          id: style.id,
          data: { name: name.trim() },
        });
        toast.success("Style Updated", `Successfully updated ${name}`);
      } else {
        await createMutation.mutateAsync({
          code: code.trim(),
          name: name.trim(),
        });
        toast.success("Style Created", `Successfully created ${name}`);
      }
      onClose();
    } catch (err: any) {
      toast.error("Operation Failed", err?.message || "Could not save style");
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Garment Style" : "Create Garment Style"}
      description={
        isEdit
          ? "Update product naming and master record"
          : "Define a style / SKU master for costing and production orders"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Style Code"
          placeholder="e.g. STY-TS-001"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={errors.code}
          disabled={isEdit || isSubmitting}
          required={!isEdit}
        />

        <Input
          label="Style Name / Description"
          placeholder="e.g. Basic Crew Neck T-Shirt"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          disabled={isSubmitting}
          required
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
          >
            {isEdit ? "Save Changes" : "Create Style"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
