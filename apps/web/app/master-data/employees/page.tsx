"use client";

import React, { useState } from "react";
import { useEmployees, useFactoryUnits } from "../../../hooks/use-master-data";
import { usePermissions } from "../../../hooks/use-permissions";
import { PageHeader } from "../../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../../components/tables/data-table";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { EmployeeDialog } from "../../../components/forms/employee-dialog";
import { ForbiddenState } from "../../../components/feedback/forbidden-state";
import { Employee } from "../../../lib/api/types";
import { Plus, Edit2, Users, Shield, Award, UserCheck } from "lucide-react";

export default function EmployeesPage() {
  const { data: employees, isLoading, isError, error, refetch } = useEmployees();
  const { data: factories = [] } = useFactoryUnits();
  const { canCreateEmployee, canReadEmployee } = usePermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  if (!canReadEmployee) {
    return (
      <ForbiddenState
        requiredPermission="EMPLOYEE:READ"
        moduleName="Personnel Directory"
      />
    );
  }

  const handleOpenCreate = () => {
    setSelectedEmployee(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setDialogOpen(true);
  };

  const factoryMap = new Map(factories.map((f) => [f.id, f.name]));

  const columns: ColumnDef<Employee>[] = [
    {
      header: "Employee ID",
      accessorKey: "code",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-emerald-50 text-emerald-600">
            <Users className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono font-semibold text-xs text-slate-900">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      header: "Full Name",
      accessorKey: "name",
      cell: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      header: "Designation / Role",
      accessorKey: "type",
      cell: (row) => {
        if (row.type === "SUPERVISOR") {
          return (
            <Badge variant="info" size="sm" className="gap-1">
              <Shield className="w-3 h-3" />
              Supervisor
            </Badge>
          );
        }
        if (row.type === "QC") {
          return (
            <Badge variant="warning" size="sm" className="gap-1">
              <Award className="w-3 h-3" />
              QC Inspector
            </Badge>
          );
        }
        return (
          <Badge variant="neutral" size="sm" className="gap-1">
            <UserCheck className="w-3 h-3" />
            Operator
          </Badge>
        );
      },
    },
    {
      header: "Assigned Plant",
      cell: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {factoryMap.get(row.factoryUnitId) || row.factoryUnitId}
        </span>
      ),
    },
    {
      header: "Status",
      cell: () => (
        <Badge variant="success" size="sm">
          Active
        </Badge>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          {canCreateEmployee && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenEdit(row)}
              className="h-7 px-2.5 text-xs"
            >
              <Edit2 className="w-3 h-3 mr-1" />
              Edit
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personnel & Shop-Floor Employees"
        description="Manage operators, supervisors, QC staff, and line workforce assignments."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Master Data", href: "/master-data" },
          { label: "Employees" },
        ]}
        actions={
          canCreateEmployee && (
            <Button variant="secondary" size="sm" onClick={handleOpenCreate}>
              <Plus className="w-3.5 h-3.5" />
              Enroll Employee
            </Button>
          )
        }
      />

      <DataTable
        title="Personnel Directory"
        subtitle="All active workforce members across factories and production lines"
        columns={columns}
        data={employees}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as any)?.message}
        onRetry={refetch}
        searchKey="name"
        searchPlaceholder="Search employee by name or ID..."
        emptyTitle="No Employees Enrolled"
        emptyDescription="Enroll shop-floor operators and supervisors to attribute WIP steps and quality checks."
        emptyActionLabel={canCreateEmployee ? "Enroll Employee" : undefined}
        onEmptyAction={handleOpenCreate}
      />

      <EmployeeDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        employee={selectedEmployee}
      />
    </div>
  );
}
