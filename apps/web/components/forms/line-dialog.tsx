"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { ProductionLine, FactoryUnit } from "../../lib/api/types";
import { useCreateProductionLine, useUpdateProductionLine, useFactoryUnits } from "../../hooks/use-master-data";
import { useToast } from "../ui/toast";

interface LineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  line?: ProductionLine | null;
}

export function LineDialog({ isOpen, onClose, line }: LineDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [factoryUnitId, setFactoryUnitId] = useState("");
  const [capacity, setCapacity] = useState<number | string>(1000);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toast = useToast();
  const { data: factories = [] } = useFactoryUnits();
  const createMutation = useCreateProductionLine();
  const updateMutation = useUpdateProductionLine();

  const isEdit = !!line;

  useEffect(() => {
    if (line) {
      setCode(line.code);
      setName(line.name);
      setFactoryUnitId(line.factoryUnitId || "");
      setCapacity(line.capacity !== undefined ? line.capacity : 1000);
    } else {
      setCode("");
      setName("");
      setFactoryUnitId(factories.length > 0 ? factories[0].id : "");
      setCapacity(1000);
    }
    setErrors({});
  }, [line, isOpen, factories]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isEdit && !code.trim()) {
      errs.code = "Line code is required";
    }
    if (!name.trim()) {
      errs.name = "Line name is required";
    }
    if (!isEdit && !factoryUnitId) {
      errs.factoryUnitId = "Factory unit is required";
    }
    if (capacity === "" || Number(capacity) < 0) {
      errs.capacity = "Valid capacity number is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isEdit && line) {
        await updateMutation.mutateAsync({
          id: line.id,
          data: {
            name: name.trim(),
            capacity: Number(capacity),
          },
        });
        toast.success("Production Line Updated", `Successfully updated ${name}`);
      } else {
        await createMutation.mutateAsync({
          code: code.trim(),
          name: name.trim(),
          factoryUnitId,
          capacity: Number(capacity),
        });
        toast.success("Production Line Created", `Successfully created ${name}`);
      }
      onClose();
    } catch (err: any) {
      toast.error("Operation Failed", err?.message || "Could not save production line");
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Production Line" : "Create Production Line"}
      description={
        isEdit
          ? "Update line capacity and metadata"
          : "Add an assembly/sewing line to a factory unit"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Line Code"
          placeholder="e.g. LINE-01"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={errors.code}
          disabled={isEdit || isSubmitting}
          required={!isEdit}
          helperText={isEdit ? "Line code cannot be changed once created" : undefined}
        />

        <Input
          label="Line Name"
          placeholder="e.g. Sewing Line Alpha-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          disabled={isSubmitting}
          required
        />

        {!isEdit && (
          <Select
            label="Assigned Factory Unit"
            value={factoryUnitId}
            onChange={(e) => setFactoryUnitId(e.target.value)}
            error={errors.factoryUnitId}
            disabled={isSubmitting}
            required
          >
            <option value="">Select a factory unit...</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </Select>
        )}

        <Input
          label="Daily Capacity (Pieces/Day)"
          type="number"
          min="0"
          placeholder="e.g. 1000"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          error={errors.capacity}
          disabled={isSubmitting}
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
            {isEdit ? "Save Changes" : "Create Line"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
