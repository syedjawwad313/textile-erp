"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Supplier } from "../../lib/api/types";
import { useCreateSupplier, useUpdateSupplier } from "../../hooks/use-master-data";
import { useToast } from "../ui/toast";

interface SupplierDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: Supplier | null;
}

export function SupplierDialog({ isOpen, onClose, supplier }: SupplierDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toast = useToast();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();

  const isEdit = !!supplier;

  useEffect(() => {
    if (supplier) {
      setCode(supplier.code);
      setName(supplier.name);
    } else {
      setCode("");
      setName("");
    }
    setErrors({});
  }, [supplier, isOpen]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isEdit && !code.trim()) {
      errs.code = "Supplier code is required";
    }
    if (!name.trim()) {
      errs.name = "Supplier enterprise name is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isEdit && supplier) {
        await updateMutation.mutateAsync({
          id: supplier.id,
          data: { name: name.trim() },
        });
        toast.success("Supplier Updated", `Successfully updated ${name}`);
      } else {
        await createMutation.mutateAsync({
          code: code.trim(),
          name: name.trim(),
        });
        toast.success("Supplier Registered", `Successfully registered ${name}`);
      }
      onClose();
    } catch (err: any) {
      toast.error("Operation Failed", err?.message || "Could not save supplier");
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Vendor / Supplier" : "Register Vendor / Supplier"}
      description={
        isEdit
          ? "Update raw material vendor details"
          : "Register a yarn, fabric, or accessories supplier for VPO procurement"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Supplier Code"
          placeholder="e.g. PYL-001"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={errors.code}
          disabled={isEdit || isSubmitting}
          required={!isEdit}
        />

        <Input
          label="Supplier Enterprise Name"
          placeholder="e.g. Premium Yarns Ltd"
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
            {isEdit ? "Save Changes" : "Register Supplier"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
