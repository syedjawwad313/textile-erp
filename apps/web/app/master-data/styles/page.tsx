"use client";

import React, { useState } from "react";
import { useStyles } from "../../../hooks/use-master-data";
import { usePermissions } from "../../../hooks/use-permissions";
import { PageHeader } from "../../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../../components/tables/data-table";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { StyleDialog } from "../../../components/forms/style-dialog";
import { ForbiddenState } from "../../../components/feedback/forbidden-state";
import { Style } from "../../../lib/api/types";
import { Plus, Edit2, Shirt } from "lucide-react";
import { ExportButton } from "../../../components/export/export-button";

export default function StylesPage() {
  const { data: styles, isLoading, isError, error, refetch } = useStyles();
  const { canCreateStyle, canReadStyle } = usePermissions();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);

  if (!canReadStyle) {
    return (
      <ForbiddenState
        requiredPermission="STYLE:READ"
        moduleName="Styles Master"
      />
    );
  }

  const handleOpenCreate = () => {
    setSelectedStyle(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (style: Style) => {
    setSelectedStyle(style);
    setDialogOpen(true);
  };

  const columns: ColumnDef<Style>[] = [
    {
      header: "Style Code",
      accessorKey: "code",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-cyan-50 text-cyan-700">
            <Shirt className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono font-semibold text-xs text-slate-900">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      header: "Style Name / Silhouette",
      accessorKey: "name",
      cell: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      header: "Status",
      cell: () => (
        <Badge variant="success" size="sm">
          Active Style
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
          {canCreateStyle && (
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
        title="Garment Styles Master"
        description="Configure garment models, silhouettes, and style master records for BOM costing and production."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Master Data", href: "/master-data" },
          { label: "Styles" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton entity="STYLE" />
            {canCreateStyle && (
              <Button variant="secondary" size="sm" onClick={handleOpenCreate}>
                <Plus className="w-3.5 h-3.5" />
                Create Style
              </Button>
            )}
          </div>
        }
      />

      <DataTable
        title="Styles Directory"
        subtitle="Active apparel models and style codes in tenant catalog"
        columns={columns}
        data={styles}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as any)?.message}
        onRetry={refetch}
        searchKey="name"
        searchPlaceholder="Search style by name or code..."
        emptyTitle="No Styles Found"
        emptyDescription="Define your garment styles to begin building costing sheets and production orders."
        emptyActionLabel={canCreateStyle ? "Create Style" : undefined}
        onEmptyAction={handleOpenCreate}
      />

      <StyleDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        style={selectedStyle}
      />
    </div>
  );
}
