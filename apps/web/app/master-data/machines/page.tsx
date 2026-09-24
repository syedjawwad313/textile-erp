"use client";

import React, { useState } from "react";
import { useMachines, useFactoryUnits } from "../../../hooks/use-master-data";
import { usePermissions } from "../../../hooks/use-permissions";
import { PageHeader } from "../../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../../components/tables/data-table";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { MachineDialog } from "../../../components/forms/machine-dialog";
import { ForbiddenState } from "../../../components/feedback/forbidden-state";
import { Machine } from "../../../lib/api/types";
import { Plus, Edit2, Cpu } from "lucide-react";

export default function MachinesPage() {
  const { data: machines, isLoading, isError, error, refetch } = useMachines();
  const { data: factories = [] } = useFactoryUnits();
  const { canCreateMachine, canReadMachine } = usePermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  if (!canReadMachine) {
    return (
      <ForbiddenState
        requiredPermission="MACHINE:READ"
        moduleName="Machine Assets"
      />
    );
  }

  const handleOpenCreate = () => {
    setSelectedMachine(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (machine: Machine) => {
    setSelectedMachine(machine);
    setDialogOpen(true);
  };

  const factoryMap = new Map(factories.map((f) => [f.id, f.name]));

  const columns: ColumnDef<Machine>[] = [
    {
      header: "Asset Code",
      accessorKey: "code",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-amber-50 text-amber-600">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono font-semibold text-xs text-slate-900">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      header: "Machine Description",
      accessorKey: "name",
      cell: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      header: "Equipment Type",
      accessorKey: "type",
      cell: (row) => (
        <Badge variant="neutral" size="sm" className="font-mono text-[11px]">
          {row.type ? row.type.replace(/_/g, " ") : "STANDARD"}
        </Badge>
      ),
    },
    {
      header: "Assigned Factory",
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
          Available
        </Badge>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          {canCreateMachine && (
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
        title="Industrial Equipment & Machines"
        description="Register and configure shop-floor sewing, cutting, spreading, and fusing machines."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Master Data", href: "/master-data" },
          { label: "Machines" },
        ]}
        actions={
          canCreateMachine && (
            <Button variant="secondary" size="sm" onClick={handleOpenCreate}>
              <Plus className="w-3.5 h-3.5" />
              Register Machine
            </Button>
          )
        }
      />

      <DataTable
        title="Machine Assets Registry"
        subtitle="All industrial equipment registered across factories"
        columns={columns}
        data={machines}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as any)?.message}
        onRetry={refetch}
        searchKey="name"
        searchPlaceholder="Search machine by name or code..."
        emptyTitle="No Machines Registered"
        emptyDescription="Register machine assets to allocate equipment to production lines."
        emptyActionLabel={canCreateMachine ? "Register Machine" : undefined}
        onEmptyAction={handleOpenCreate}
      />

      <MachineDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        machine={selectedMachine}
      />
    </div>
  );
}
