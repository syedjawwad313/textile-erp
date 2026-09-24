"use client";

import React, { useState } from "react";
import { useBuyers } from "../../../hooks/use-master-data";
import { usePermissions } from "../../../hooks/use-permissions";
import { PageHeader } from "../../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../../components/tables/data-table";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { BuyerDialog } from "../../../components/forms/buyer-dialog";
import { ForbiddenState } from "../../../components/feedback/forbidden-state";
import { Buyer } from "../../../lib/api/types";
import { Plus, Edit2, Briefcase } from "lucide-react";
import { ExportButton } from "../../../components/export/export-button";

export default function BuyersPage() {
  const { data: buyers, isLoading, isError, error, refetch } = useBuyers();
  const { canCreateBuyer, canReadBuyer } = usePermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null);

  if (!canReadBuyer) {
    return (
      <ForbiddenState
        requiredPermission="BUYER:READ"
        moduleName="Buyers Directory"
      />
    );
  }

  const handleOpenCreate = () => {
    setSelectedBuyer(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (buyer: Buyer) => {
    setSelectedBuyer(buyer);
    setDialogOpen(true);
  };

  const columns: ColumnDef<Buyer>[] = [
    {
      header: "Buyer Code",
      accessorKey: "code",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-purple-50 text-purple-700">
            <Briefcase className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono font-semibold text-xs text-slate-900">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      header: "Buyer Enterprise Name",
      accessorKey: "name",
      cell: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      header: "Status",
      cell: () => (
        <Badge variant="success" size="sm">
          Active Account
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
          {canCreateBuyer && (
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
        title="Buyers & Retail Clients"
        description="Manage brand accounts, retail buyers, and commercial client profiles."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Master Data", href: "/master-data" },
          { label: "Buyers" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton entity="BUYER" />
            {canCreateBuyer && (
              <Button variant="secondary" size="sm" onClick={handleOpenCreate}>
                <Plus className="w-3.5 h-3.5" />
                Register Buyer
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        title="Buyers Directory"
        subtitle="All active corporate brand accounts"
        columns={columns}
        data={buyers}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as any)?.message}
        onRetry={refetch}
        searchKey="name"
        searchPlaceholder="Search buyer by name or code..."
        emptyTitle="No Buyers Found"
        emptyDescription="Register client accounts to begin issuing Buyer Purchase Orders."
        emptyActionLabel={canCreateBuyer ? "Register Buyer" : undefined}
        onEmptyAction={handleOpenCreate}
      />

      <BuyerDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        buyer={selectedBuyer}
      />
    </div>
  );
}
