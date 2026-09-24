"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { Machine } from "../../lib/api/types";
import { useCreateMachine, useUpdateMachine, useFactoryUnits } from "../../hooks/use-master-data";
import { useToast } from "../ui/toast";

interface MachineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  machine?: Machine | null;
}

const MACHINE_TYPES = [
  "SINGLE_NEEDLE_LOCKSTITCH",
  "OVERLOCK_4_THREAD",
  "OVERLOCK_5_THREAD",
  "FLATLOCK",
  "BUTTON_ATTACH",
  "BUTTON_HOLE",
  "BARTACK",
  "CUTTING_AUTO_SPREADER",
  "FUSING_MACHINE",
  "IRON_VACUUM_TABLE",
];

export function MachineDialog({ isOpen, onClose, machine }: MachineDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState(MACHINE_TYPES[0]);
  const [factoryUnitId, setFactoryUnitId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toast = useToast();
  const { data: factories = [] } = useFactoryUnits();
  const createMutation = useCreateMachine();
  const updateMutation = useUpdateMachine();

  const isEdit = !!machine;

  useEffect(() => {
    if (machine) {
      setCode(machine.code);
      setName(machine.name);
      setType(machine.type || MACHINE_TYPES[0]);
      setFactoryUnitId(machine.factoryUnitId || "");
    } else {
      setCode("");
      setName("");
      setType(MACHINE_TYPES[0]);
      setFactoryUnitId(factories.length > 0 ? factories[0].id : "");
    }
    setErrors({});
  }, [machine, isOpen, factories]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isEdit && !code.trim()) {
      errs.code = "Machine code is required";
    }
    if (!name.trim()) {
      errs.name = "Machine name is required";
    }
    if (!type.trim()) {
      errs.type = "Machine type is required";
    }
    if (!isEdit && !factoryUnitId) {
      errs.factoryUnitId = "Factory unit is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isEdit && machine) {
        await updateMutation.mutateAsync({
          id: machine.id,
          data: {
            name: name.trim(),
            type: type.trim(),
          },
        });
        toast.success("Machine Updated", `Successfully updated ${name}`);
      } else {
        await createMutation.mutateAsync({
          code: code.trim(),
          name: name.trim(),
          type: type.trim(),
          factoryUnitId,
        });
        toast.success("Machine Created", `Successfully registered ${name}`);
      }
      onClose();
    } catch (err: any) {
      toast.error("Operation Failed", err?.message || "Could not save machine");
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Machine Asset" : "Register Machine Asset"}
      description={
        isEdit
          ? "Update equipment type and nomenclature"
          : "Register a manufacturing machine or asset in a factory unit"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Asset / Machine Code"
          placeholder="e.g. MCH-SN-001"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={errors.code}
          disabled={isEdit || isSubmitting}
          required={!isEdit}
          helperText={isEdit ? "Machine code cannot be modified" : undefined}
        />

        <Input
          label="Asset Name"
          placeholder="e.g. Juki DDL-9000C Lockstitch"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          disabled={isSubmitting}
          required
        />

        <Select
          label="Equipment Type / Classification"
          value={type}
          onChange={(e) => setType(e.target.value)}
          error={errors.type}
          disabled={isSubmitting}
          required
        >
          {MACHINE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </Select>

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
            {isEdit ? "Save Changes" : "Register Machine"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
