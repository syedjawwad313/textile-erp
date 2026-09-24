"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Buyer } from "../../lib/api/types";
import { useCreateBuyer, useUpdateBuyer } from "../../hooks/use-master-data";
import { useToast } from "../ui/toast";

interface BuyerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  buyer?: Buyer | null;
}

export function BuyerDialog({ isOpen, onClose, buyer }: BuyerDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toast = useToast();
  const createMutation = useCreateBuyer();
  const updateMutation = useUpdateBuyer();

  const isEdit = !!buyer;

  useEffect(() => {
    if (buyer) {
      setCode(buyer.code);
      setName(buyer.name);
    } else {
      setCode("");
      setName("");
    }
    setErrors({});
  }, [buyer, isOpen]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isEdit && !code.trim()) {
      errs.code = "Buyer code is required";
    }
    if (!name.trim()) {
      errs.name = "Buyer company name is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isEdit && buyer) {
        await updateMutation.mutateAsync({
          id: buyer.id,
          data: { name: name.trim() },
        });
        toast.success("Buyer Updated", `Successfully updated ${name}`);
      } else {
        await createMutation.mutateAsync({
          code: code.trim(),
          name: name.trim(),
        });
        toast.success("Buyer Registered", `Successfully registered ${name}`);
      }
      onClose();
    } catch (err: any) {
      toast.error("Operation Failed", err?.message || "Could not save buyer");
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Buyer Account" : "Register Buyer Account"}
      description={
        isEdit
          ? "Update client / brand account details"
          : "Register a commercial buyer for PO allocations and merchandising"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Buyer Code"
          placeholder="e.g. GBI-001"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={errors.code}
          disabled={isEdit || isSubmitting}
          required={!isEdit}
        />

        <Input
          label="Buyer Enterprise Name"
          placeholder="e.g. Global Brands Inc"
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
            {isEdit ? "Save Changes" : "Register Buyer"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
