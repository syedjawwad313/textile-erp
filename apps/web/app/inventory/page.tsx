"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api/client";
import { Warehouse, StockAudit } from "../../lib/api/types";
import { usePermissions } from "../../hooks/use-permissions";
import { useAuth } from "../../lib/auth/auth-context";
import { PageHeader } from "../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../components/tables/data-table";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { ForbiddenState } from "../../components/feedback/forbidden-state";
import { useToast } from "../../components/ui/toast";
import {
  Warehouse as WarehouseIcon,
  Plus,
  ClipboardCheck,
  CheckCircle,
  FileSpreadsheet,
} from "lucide-react";
import { ExportButton } from "../../components/export/export-button";

export default function InventoryPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"warehouses" | "audits">("warehouses");

  // Warehouse Form State
  const [createWarehouseOpen, setCreateWarehouseOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  // Stock Audit Form State
  const [createAuditOpen, setCreateAuditOpen] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [auditNotes, setAuditNotes] = useState("");

  // Count Entry State
  const [selectedAudit, setSelectedAudit] = useState<StockAudit | null>(null);
  const [countModalOpen, setCountModalOpen] = useState(false);
  const [countInputs, setCountInputs] = useState<Record<string, number>>({});

  const {
    data: warehouses = [],
    isLoading: isWarehousesLoading,
    isError: isWarehousesError,
    error: warehousesError,
    refetch: refetchWarehouses,
  } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get<Warehouse[]>("/warehouses"),
    enabled: isAuthenticated,
  });

  const {
    data: audits = [],
    isLoading: isAuditsLoading,
    isError: isAuditsError,
    error: auditsError,
    refetch: refetchAudits,
  } = useQuery({
    queryKey: ["stock-audits"],
    queryFn: () => api.get<StockAudit[]>("/api/v1/inventory/stock-audits"),
    enabled: isAuthenticated && activeTab === "audits",
  });

  const createWarehouseMutation = useMutation({
    mutationFn: (data: { code: string; name: string }) =>
      api.post<Warehouse>("/warehouses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Warehouse Registered", `Successfully registered ${name}`);
      setCreateWarehouseOpen(false);
      setCode("");
      setName("");
    },
    onError: (err: any) => {
      toast.error("Creation Failed", err?.message || "Could not register warehouse");
    },
  });

  const createAuditMutation = useMutation({
    mutationFn: (data: { warehouseId: string; notes?: string }) =>
      api.post<StockAudit>("/api/v1/inventory/stock-audits", data, {
        headers: { "x-idempotency-key": `audit-${Date.now()}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-audits"] });
      toast.success("Stock Audit Initiated", "Snapshot created with active ledger quantities.");
      setCreateAuditOpen(false);
      setSelectedWarehouseId("");
      setAuditNotes("");
    },
    onError: (err: any) => {
      toast.error("Audit Failed", err?.message || "Could not initiate stock audit.");
    },
  });

  const recordCountsMutation = useMutation({
    mutationFn: ({
      auditId,
      items,
    }: {
      auditId: string;
      items: { materialId: string; countedQuantity: number }[];
    }) => api.post(`/api/v1/inventory/stock-audits/${auditId}/counts`, { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-audits"] });
      toast.success("Physical Counts Logged", "Discrepancy quantities recalculated.");
      setCountModalOpen(false);
      setSelectedAudit(null);
    },
    onError: (err: any) => {
      toast.error("Count Update Failed", err?.message || "Could not record counts.");
    },
  });

  const reconcileAuditMutation = useMutation({
    mutationFn: (auditId: string) =>
      api.post(
        `/api/v1/inventory/stock-audits/${auditId}/reconcile`,
        {},
        { headers: { "x-idempotency-key": `reconcile-${auditId}-${Date.now()}` } },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-audits"] });
      toast.success("Ledger Reconciled", "Physical variances adjusted atomically via LedgerService.");
    },
    onError: (err: any) => {
      toast.error("Reconciliation Failed", err?.message || "Could not reconcile audit.");
    },
  });

  const handleCreateWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.error("Validation Error", "Code and name are required.");
      return;
    }
    createWarehouseMutation.mutate({ code: code.trim(), name: name.trim() });
  };

  const handleCreateAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseId) {
      toast.error("Validation Error", "Please select a warehouse facility.");
      return;
    }
    createAuditMutation.mutate({ warehouseId: selectedWarehouseId, notes: auditNotes });
  };

  const handleOpenCountModal = (audit: StockAudit) => {
    setSelectedAudit(audit);
    const initialCounts: Record<string, number> = {};
    audit.items?.forEach((item) => {
      initialCounts[item.materialId] = Number(item.countedQuantity || item.ledgerQuantity || 0);
    });
    setCountInputs(initialCounts);
    setCountModalOpen(true);
  };

  const handleSaveCounts = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAudit) return;

    const items = Object.entries(countInputs).map(([materialId, countedQuantity]) => ({
      materialId,
      countedQuantity: Number(countedQuantity),
    }));

    recordCountsMutation.mutate({ auditId: selectedAudit.id, items });
  };

  const warehouseColumns: ColumnDef<Warehouse>[] = [
    {
      header: "Warehouse Code",
      accessorKey: "code",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 text-blue-600">
            <WarehouseIcon className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-xs font-semibold text-slate-900">
            {row.code}
          </span>
        </div>
      ),
    },
    {
      header: "Facility Name",
      accessorKey: "name",
      cell: (row) => <span className="font-medium text-slate-900">{row.name}</span>,
    },
    {
      header: "Status",
      cell: () => (
        <Badge variant="success" size="sm">
          Active Storage
        </Badge>
      ),
    },
    {
      header: "Created Date",
      accessorKey: "createdAt",
      cell: (row) => (
        <span className="text-xs text-slate-500 font-mono">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"}
        </span>
      ),
    },
  ];

  const auditColumns: ColumnDef<StockAudit>[] = [
    {
      header: "Audit Number",
      accessorKey: "auditNumber",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-purple-50 text-purple-600">
            <ClipboardCheck className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-xs font-semibold text-slate-900">
            {row.auditNumber}
          </span>
        </div>
      ),
    },
    {
      header: "Warehouse Facility",
      cell: (row) => (
        <span className="font-medium text-slate-900">
          {row.warehouse?.name || row.warehouseId}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        let variant: "success" | "warning" | "info" = "info";
        if (row.status === "COMPLETED") variant = "success";
        else if (row.status === "IN_PROGRESS") variant = "warning";

        return (
          <Badge variant={variant} size="sm">
            {row.status}
          </Badge>
        );
      },
    },
    {
      header: "Items Audited",
      cell: (row) => (
        <span className="text-xs font-mono font-medium text-slate-700">
          {row.items?.length || 0} material(s)
        </span>
      ),
    },
    {
      header: "Total Variance",
      cell: (row) => {
        const variance = Number(row.totalVariance || 0);
        return (
          <span
            className={`font-mono text-xs font-bold ${
              variance > 0 ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {variance > 0 ? `±${variance.toLocaleString()}` : "0 (Balanced)"}
          </span>
        );
      },
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: (row) => (
        <span className="text-xs text-slate-500 font-mono">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.status !== "COMPLETED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenCountModal(row)}
            >
              <FileSpreadsheet className="w-3 h-3 text-slate-600" />
              Counts
            </Button>
          )}
          {row.status === "IN_PROGRESS" && can("INVENTORY:ADJUST") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => reconcileAuditMutation.mutate(row.id)}
              isLoading={reconcileAuditMutation.isPending}
            >
              <CheckCircle className="w-3 h-3" />
              Reconcile
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!can("WAREHOUSE:READ") && !can("INVENTORY:READ")) {
    return (
      <ForbiddenState
        requiredPermission="WAREHOUSE:READ"
        moduleName="Warehouse & Inventory"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehousing & Stock Control"
        description="Manage physical storage facilities, raw material ledger balances, and perform authoritative physical-to-ledger stock audits."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Supply Chain" },
          { label: "Inventory" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <ExportButton entity="WAREHOUSE" label="Export Warehouses" />
            <ExportButton entity="INVENTORY" label="Export Inventory" />
            {activeTab === "warehouses" && can("WAREHOUSE:WRITE") && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCode(`WH-${Date.now().toString().slice(-3)}`);
                  setName("");
                  setCreateWarehouseOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Register Warehouse
              </Button>
            )}
            {activeTab === "audits" && can("INVENTORY:WRITE") && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedWarehouseId(warehouses.length > 0 ? warehouses[0].id : "");
                  setAuditNotes("");
                  setCreateAuditOpen(true);
                }}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                Initiate Stock Audit
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("warehouses")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "warehouses"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <WarehouseIcon className="w-4 h-4" />
          Warehouses & Storage Facilities
        </button>
        <button
          onClick={() => setActiveTab("audits")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "audits"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Stock Audits & Ledger Reconciliation
        </button>
      </div>

      {activeTab === "warehouses" && (
        <DataTable
          title="Warehouses & Storage Facilities"
          subtitle="Physical fabric, yarn, and trim storage facilities"
          columns={warehouseColumns}
          data={warehouses}
          isLoading={isWarehousesLoading}
          isError={isWarehousesError}
          errorMessage={(warehousesError as any)?.message}
          onRetry={refetchWarehouses}
          searchKey="name"
          searchPlaceholder="Search warehouse by name or code..."
          emptyTitle="No Warehouses Configured"
          emptyDescription="Register your primary raw material warehouse to configure bin storage locations."
          emptyActionLabel="Register Warehouse"
          onEmptyAction={() => {
            setCode(`WH-${Date.now().toString().slice(-3)}`);
            setName("");
            setCreateWarehouseOpen(true);
          }}
        />
      )}

      {activeTab === "audits" && (
        <DataTable
          title="Physical Stock Audits Directory"
          subtitle="Authoritative physical count verification and ledger adjustment sheets"
          columns={auditColumns}
          data={audits}
          isLoading={isAuditsLoading}
          isError={isAuditsError}
          errorMessage={(auditsError as any)?.message}
          onRetry={refetchAudits}
          searchKey="auditNumber"
          searchPlaceholder="Search audit by number..."
          emptyTitle="No Stock Audits Initiated"
          emptyDescription="Initiate a physical stock audit to take a balance snapshot and reconcile discrepancies."
          emptyActionLabel="Initiate Stock Audit"
          onEmptyAction={() => {
            setSelectedWarehouseId(warehouses.length > 0 ? warehouses[0].id : "");
            setAuditNotes("");
            setCreateAuditOpen(true);
          }}
        />
      )}

      {/* Create Warehouse Dialog */}
      <Dialog
        isOpen={createWarehouseOpen}
        onClose={() => setCreateWarehouseOpen(false)}
        title="Register Storage Warehouse"
        description="Define a raw material or finished goods warehouse location."
      >
        <form onSubmit={handleCreateWarehouse} className="space-y-4">
          <Input
            label="Warehouse Code"
            placeholder="e.g. WH-FABRIC-01"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />

          <Input
            label="Warehouse Facility Name"
            placeholder="e.g. Central Fabric & Trim Depot"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateWarehouseOpen(false)}
              disabled={createWarehouseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createWarehouseMutation.isPending}
            >
              Register Facility
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Create Stock Audit Dialog */}
      <Dialog
        isOpen={createAuditOpen}
        onClose={() => setCreateAuditOpen(false)}
        title="Initiate Physical Stock Audit"
        description="Generates an audit count sheet capturing current LedgerService system balances."
      >
        <form onSubmit={handleCreateAudit} className="space-y-4">
          <Select
            label="Storage Facility / Warehouse"
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            required
          >
            <option value="">Select Warehouse...</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </Select>

          <Input
            label="Audit Notes / Reason"
            placeholder="e.g. End of month physical roll audit"
            value={auditNotes}
            onChange={(e) => setAuditNotes(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateAuditOpen(false)}
              disabled={createAuditMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createAuditMutation.isPending}
            >
              Snapshot Ledger & Start Audit
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Enter Physical Counts Dialog */}
      <Dialog
        isOpen={countModalOpen}
        onClose={() => setCountModalOpen(false)}
        title={`Record Physical Counts — ${selectedAudit?.auditNumber}`}
        description="Enter floor-counted quantities. The system will compute positive or negative variances against the ledger."
      >
        <form onSubmit={handleSaveCounts} className="space-y-4">
          <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
            {selectedAudit?.items && selectedAudit.items.length > 0 ? (
              selectedAudit.items.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-800">
                      {item.material?.name || item.materialId}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      System Balance: {Number(item.ledgerQuantity).toLocaleString()}{" "}
                      {item.material?.uom}
                    </div>
                  </div>
                  <div className="w-32">
                    <Input
                      label="Physical Count"
                      type="number"
                      step="any"
                      min="0"
                      value={countInputs[item.materialId] ?? Number(item.countedQuantity || 0)}
                      onChange={(e) =>
                        setCountInputs({
                          ...countInputs,
                          [item.materialId]: Number(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-xs text-slate-500">
                No items in this audit sheet.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCountModalOpen(false)}
              disabled={recordCountsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={recordCountsMutation.isPending}
            >
              Save Counts & Recalculate Variance
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
