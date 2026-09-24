"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { FactoryUnit, CreateFactoryUnitInput, UpdateFactoryUnitInput } from "../../lib/api/types";
import { useCreateFactoryUnit, useUpdateFactoryUnit } from "../../hooks/use-master-data";
import { useToast } from "../ui/toast";

interface FactoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  factory?: FactoryUnit | null;
}

export function FactoryDialog({ isOpen, onClose, factory }: FactoryDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("demo-company-1");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toast = useToast();
  const createMutation = useCreateFactoryUnit();
  const updateMutation = useUpdateFactoryUnit();

  const isEdit = !!factory;

  useEffect(() => {
    if (factory) {
      setCode(factory.code);
      setName(factory.name);
      setCompanyId(factory.companyId || "demo-company-1");
    } else {
      setCode("");
      setName("");
      setCompanyId("demo-company-1");
    }
    setErrors({});
  }, [factory, isOpen]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isEdit && !code.trim()) {
      errs.code = "Factory code is required";
    }
    if (!name.trim()) {
      errs.name = "Factory name is required";
    }
    if (!isEdit && !companyId.trim()) {
      errs.companyId = "Company identifier is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isEdit && factory) {
        await updateMutation.mutateAsync({
          id: factory.id,
          data: { name: name.trim() },
        });
        toast.success("Factory Updated", `Successfully updated ${name}`);
      } else {
        await createMutation.mutateAsync({
          code: code.trim(),
          name: name.trim(),
          companyId: companyId.trim(),
        });
        toast.success("Factory Created", `Successfully created ${name}`);
      }
      onClose();
    } catch (err: any) {
      toast.error("Operation Failed", err?.message || "Could not save factory");
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Factory Unit" : "Create New Factory Unit"}
      description={
        isEdit
          ? "Update manufacturing unit details"
          : "Define a new manufacturing plant / factory unit in your tenant"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Factory Code"
          placeholder="e.g. FAC-001"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={errors.code}
          disabled={isEdit || isSubmitting}
          required={!isEdit}
          helperText={isEdit ? "Factory code cannot be changed once created" : undefined}
        />

        <Input
          label="Factory Name"
          placeholder="e.g. Main Plant Alpha"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          disabled={isSubmitting}
          required
        />

        {!isEdit && (
          <Input
            label="Company ID"
            placeholder="e.g. demo-company-1"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            error={errors.companyId}
            disabled={isSubmitting}
            required
            helperText="Internal tenant company mapping"
          />
        )}

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
            {isEdit ? "Save Changes" : "Create Factory"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
