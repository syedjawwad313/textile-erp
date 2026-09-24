"use client";

import React, { useState } from "react";
import { useProductionLines, useFactoryUnits } from "../../../hooks/use-master-data";
import { usePermissions } from "../../../hooks/use-permissions";
import { PageHeader } from "../../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../../components/tables/data-table";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { LineDialog } from "../../../components/forms/line-dialog";
import { ForbiddenState } from "../../../components/feedback/forbidden-state";
import { ProductionLine } from "../../../lib/api/types";
import { Plus, Edit2, GitBranch } from "lucide-react";

export default function ProductionLinesPage() {
  const { data: lines, isLoading, isError, error, refetch } = useProductionLines();
  const { data: factories = [] } = useFactoryUnits();
  const { canCreateLine, canReadLine } = usePermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<ProductionLine | null>(null);

  if (!canReadLine) {
    return (
      <ForbiddenState
        requiredPermission="LINE:READ"
        moduleName="Production Lines"
      />
    );
  }

  const handleOpenCreate = () => {
    setSelectedLine(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (line: ProductionLine) => {
    setSelectedLine(line);
    setDialogOpen(true);
  };

  const factoryMap = new Map(factories.map((f) => [f.id, f.name]));

  const columns: ColumnDef<ProductionLine>[] = [
    {
      header: "Line Code",
      accessorKey: "code",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-indigo-50 text-indigo-600">
            <GitBranch className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono font-semibold text-xs text-slate-900">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      header: "Line Name",
      accessorKey: "name",
      cell: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
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
      header: "Target Capacity",
      accessorKey: "capacity",
      cell: (row) => (
        <div className="font-mono text-xs font-semibold text-slate-900">
          {(row.capacity ?? 0).toLocaleString()} <span className="text-slate-500 font-normal">pcs/day</span>
        </div>
      ),
    },
    {
      header: "Status",
      cell: () => (
        <Badge variant="success" size="sm">
          Active Line
        </Badge>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          {canCreateLine && (
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
        title="Production & Assembly Lines"
        description="Configure sewing lines, assembly flows, and throughput capacities per plant."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Master Data", href: "/master-data" },
          { label: "Production Lines" },
        ]}
        actions={
          canCreateLine && (
            <Button variant="secondary" size="sm" onClick={handleOpenCreate}>
              <Plus className="w-3.5 h-3.5" />
              Add Production Line
            </Button>
          )
        }
      />

      <DataTable
        title="Production Lines Directory"
        subtitle="All active sewing and manufacturing lines across plants"
        columns={columns}
        data={lines}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as any)?.message}
        onRetry={refetch}
        searchKey="name"
        searchPlaceholder="Search lines..."
        emptyTitle="No Production Lines Found"
        emptyDescription="Define assembly and sewing lines to begin tracking shop-floor WIP and output."
        emptyActionLabel={canCreateLine ? "Create Production Line" : undefined}
        onEmptyAction={handleOpenCreate}
      />

      <LineDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        line={selectedLine}
      />
    </div>
  );
}
