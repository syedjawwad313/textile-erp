"use client";

import React, { useState, useEffect } from "react";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { Employee, EmployeeType } from "../../lib/api/types";
import { useCreateEmployee, useUpdateEmployee, useFactoryUnits } from "../../hooks/use-master-data";
import { useToast } from "../ui/toast";

interface EmployeeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee | null;
}

const EMPLOYEE_TYPES: Array<{ value: EmployeeType; label: string }> = [
  { value: "OPERATOR", label: "Shop-Floor Operator" },
  { value: "SUPERVISOR", label: "Line Supervisor" },
  { value: "QC", label: "Quality Control Inspector (QC)" },
];

export function EmployeeDialog({ isOpen, onClose, employee }: EmployeeDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<EmployeeType>("OPERATOR");
  const [factoryUnitId, setFactoryUnitId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toast = useToast();
  const { data: factories = [] } = useFactoryUnits();
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();

  const isEdit = !!employee;

  useEffect(() => {
    if (employee) {
      setCode(employee.code);
      setName(employee.name);
      setType(employee.type || "OPERATOR");
      setFactoryUnitId(employee.factoryUnitId || "");
    } else {
      setCode("");
      setName("");
      setType("OPERATOR");
      setFactoryUnitId(factories.length > 0 ? factories[0].id : "");
    }
    setErrors({});
  }, [employee, isOpen, factories]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!isEdit && !code.trim()) {
      errs.code = "Employee code / ID is required";
    }
    if (!name.trim()) {
      errs.name = "Full name is required";
    }
    if (!type) {
      errs.type = "Employee role type is required";
    }
    if (!isEdit && !factoryUnitId) {
      errs.factoryUnitId = "Factory unit assignment is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isEdit && employee) {
        await updateMutation.mutateAsync({
          id: employee.id,
          data: {
            name: name.trim(),
            type,
          },
        });
        toast.success("Employee Record Updated", `Successfully updated ${name}`);
      } else {
        await createMutation.mutateAsync({
          code: code.trim(),
          name: name.trim(),
          type,
          factoryUnitId,
        });
        toast.success("Employee Enrolled", `Successfully registered ${name}`);
      }
      onClose();
    } catch (err: any) {
      toast.error("Operation Failed", err?.message || "Could not save employee");
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Personnel Record" : "Enroll Factory Employee"}
      description={
        isEdit
          ? "Update personnel role or naming"
          : "Register shop-floor operators, supervisors, and QC staff"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Employee ID / Badge Code"
          placeholder="e.g. EMP-1042"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          error={errors.code}
          disabled={isEdit || isSubmitting}
          required={!isEdit}
          helperText={isEdit ? "Employee badge ID is immutable" : undefined}
        />

        <Input
          label="Full Name"
          placeholder="e.g. Sarah Jenkins"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          disabled={isSubmitting}
          required
        />

        <Select
          label="Designation / Operational Role"
          value={type}
          onChange={(e) => setType(e.target.value as EmployeeType)}
          error={errors.type}
          disabled={isSubmitting}
          required
        >
          {EMPLOYEE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>

        {!isEdit && (
          <Select
            label="Assigned Factory Plant"
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
            {isEdit ? "Save Changes" : "Enroll Personnel"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
