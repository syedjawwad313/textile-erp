"use client";

import React, { useState } from "react";
import { useSuppliers } from "../../../hooks/use-master-data";
import { usePermissions } from "../../../hooks/use-permissions";
import { PageHeader } from "../../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../../components/tables/data-table";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { SupplierDialog } from "../../../components/forms/supplier-dialog";
import { ForbiddenState } from "../../../components/feedback/forbidden-state";
import { Supplier } from "../../../lib/api/types";
import { Plus, Edit2, Truck } from "lucide-react";
import { ExportButton } from "../../../components/export/export-button";

export default function SuppliersPage() {
  const { data: suppliers, isLoading, isError, error, refetch } = useSuppliers();
  const { canCreateSupplier, canReadSupplier } = usePermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  if (!canReadSupplier) {
    return (
      <ForbiddenState
        requiredPermission="SUPPLIER:READ"
        moduleName="Suppliers Directory"
      />
    );
  }

  const handleOpenCreate = () => {
    setSelectedSupplier(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setDialogOpen(true);
  };

  const columns: ColumnDef<Supplier>[] = [
    {
      header: "Supplier Code",
      accessorKey: "code",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-rose-50 text-rose-700">
            <Truck className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono font-semibold text-xs text-slate-900">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      header: "Supplier / Vendor Name",
      accessorKey: "name",
      cell: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      header: "Status",
      cell: () => (
        <Badge variant="success" size="sm">
          Approved Vendor
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
          {canCreateSupplier && (
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
        title="Suppliers & Material Vendors"
        description="Manage yarn, fabric, trim, and accessory vendors for procurement and VPOs."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Master Data", href: "/master-data" },
          { label: "Suppliers" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton entity="SUPPLIER" />
            {canCreateSupplier && (
              <Button variant="secondary" size="sm" onClick={handleOpenCreate}>
                <Plus className="w-3.5 h-3.5" />
                Register Supplier
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        title="Suppliers Directory"
        subtitle="All approved raw material and trim vendors"
        columns={columns}
        data={suppliers}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as any)?.message}
        onRetry={refetch}
        searchKey="name"
        searchPlaceholder="Search supplier by name or code..."
        emptyTitle="No Suppliers Found"
        emptyDescription="Register suppliers to generate Vendor Purchase Orders and inventory receipts."
        emptyActionLabel={canCreateSupplier ? "Register Supplier" : undefined}
        onEmptyAction={handleOpenCreate}
      />

      <SupplierDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        supplier={selectedSupplier}
      />
    </div>
  );
}
