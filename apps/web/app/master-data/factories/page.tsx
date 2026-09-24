"use client";

import React, { useState } from "react";
import { useFactoryUnits } from "../../../hooks/use-master-data";
import { usePermissions } from "../../../hooks/use-permissions";
import { PageHeader } from "../../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../../components/tables/data-table";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { FactoryDialog } from "../../../components/forms/factory-dialog";
import { ForbiddenState } from "../../../components/feedback/forbidden-state";
import { FactoryUnit } from "../../../lib/api/types";
import { Plus, Edit2, Building2 } from "lucide-react";

export default function FactoriesPage() {
  const { data: factories, isLoading, isError, error, refetch } = useFactoryUnits();
  const { canCreateFactory, canReadFactory } = usePermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFactory, setSelectedFactory] = useState<FactoryUnit | null>(null);

  if (!canReadFactory) {
    return (
      <ForbiddenState
        requiredPermission="FACTORY:READ"
        moduleName="Factory Units"
      />
    );
  }

  const handleOpenCreate = () => {
    setSelectedFactory(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (factory: FactoryUnit) => {
    setSelectedFactory(factory);
    setDialogOpen(true);
  };

  const columns: ColumnDef<FactoryUnit>[] = [
    {
      header: "Plant Code",
      accessorKey: "code",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 text-blue-600">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono font-semibold text-xs text-slate-900">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      header: "Factory Name",
      accessorKey: "name",
      cell: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      header: "Company Reference",
      accessorKey: "companyId",
      cell: (row) => (
        <span className="font-mono text-xs text-slate-600">{row.companyId}</span>
      ),
    },
    {
      header: "Status",
      cell: () => (
        <Badge variant="success" size="sm">
          Operational
        </Badge>
      ),
    },
    {
      header: "Created Date",
      accessorKey: "createdAt",
      cell: (row) => (
        <span className="text-xs text-slate-500">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          {canCreateFactory && (
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
        title="Factory Units & Plants"
        description="Manage physical manufacturing locations, industrial plants, and production units."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Master Data", href: "/master-data" },
          { label: "Factory Units" },
        ]}
        actions={
          canCreateFactory && (
            <Button variant="secondary" size="sm" onClick={handleOpenCreate}>
              <Plus className="w-3.5 h-3.5" />
              Add Factory Unit
            </Button>
          )
        }
      />

      <DataTable
        title="Factory Units Directory"
        subtitle="All registered manufacturing facilities within your tenant"
        columns={columns}
        data={factories}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as any)?.message}
        onRetry={refetch}
        searchKey="name"
        searchPlaceholder="Search by name or code..."
        emptyTitle="No Factory Units Found"
        emptyDescription="Create your first manufacturing plant to begin allocating production lines."
        emptyActionLabel={canCreateFactory ? "Create Factory Unit" : undefined}
        onEmptyAction={handleOpenCreate}
      />

      <FactoryDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        factory={selectedFactory}
      />
    </div>
  );
}
