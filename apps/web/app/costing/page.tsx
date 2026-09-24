"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api/client";
import { CostingSheet, JobCostSummary } from "../../lib/api/types";
import { useStyles } from "../../hooks/use-master-data";
import { useProductionOrders } from "../../hooks/use-production";
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
  Calculator,
  Plus,
  TrendingUp,
  DollarSign,
  FileText,
  CheckCircle,
  Percent,
} from "lucide-react";

export default function CostingPage() {
  const { isAuthenticated } = useAuth();
  const { canCostingWrite, can } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"sheets" | "job-costs">("sheets");

  // Sheet Form state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [styleId, setStyleId] = useState("");
  const [season, setSeason] = useState("SS-2026");

  // Job Costing Form state
  const [jobCostModalOpen, setJobCostModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [minuteLaborRate, setMinuteLaborRate] = useState<number | string>(0.1);
  const [overheadPercent, setOverheadPercent] = useState<number | string>(20);
  const [jobCostNotes, setJobCostNotes] = useState("");

  const { data: styles = [] } = useStyles();
  const { data: orders = [] } = useProductionOrders();

  const {
    data: sheets = [],
    isLoading: isSheetsLoading,
    isError: isSheetsError,
    error: sheetsError,
    refetch: refetchSheets,
  } = useQuery({
    queryKey: ["costing-sheets"],
    queryFn: () => api.get<CostingSheet[]>("/costing/sheets"),
    enabled: isAuthenticated && activeTab === "sheets",
  });

  const {
    data: jobCosts = [],
    isLoading: isJobCostsLoading,
    isError: isJobCostsError,
    error: jobCostsError,
    refetch: refetchJobCosts,
  } = useQuery({
    queryKey: ["job-costs"],
    queryFn: () => api.get<JobCostSummary[]>("/costing/jobs"),
    enabled: isAuthenticated && activeTab === "job-costs",
  });

  const createSheetMutation = useMutation({
    mutationFn: (data: { styleId: string; season: string }) =>
      api.post<CostingSheet>("/costing/sheets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costing-sheets"] });
      toast.success("Costing Sheet Created", "New costing sheet registered.");
      setCreateModalOpen(false);
    },
    onError: (err: any) => {
      toast.error("Creation Failed", err?.message || "Could not create sheet");
    },
  });

  const calculateJobCostMutation = useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string;
      data: { minuteLaborRate?: number; overheadPercent?: number; notes?: string };
    }) => api.post(`/costing/jobs/${orderId}/calculate`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-costs"] });
      toast.success("Job Costing Calculated", "Actual costs and realized margins computed.");
      setJobCostModalOpen(false);
      setSelectedOrderId("");
    },
    onError: (err: any) => {
      toast.error("Calculation Failed", err?.message || "Could not calculate job costs.");
    },
  });

  const handleCreateSheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!styleId) {
      toast.error("Validation Error", "Please select a garment style");
      return;
    }
    createSheetMutation.mutate({ styleId, season });
  };

  const handleCalculateJobCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      toast.error("Validation Error", "Please select a production order.");
      return;
    }
    calculateJobCostMutation.mutate({
      orderId: selectedOrderId,
      data: {
        minuteLaborRate: Number(minuteLaborRate),
        overheadPercent: Number(overheadPercent),
        notes: jobCostNotes.trim() || undefined,
      },
    });
  };

  const styleMap = new Map(styles.map((s) => [s.id, s.name]));

  const sheetColumns: ColumnDef<CostingSheet>[] = [
    {
      header: "Sheet ID",
      accessorKey: "id",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 text-blue-600">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-xs font-semibold text-slate-900">
            {row.id.substring(0, 8)}...
          </span>
        </div>
      ),
    },
    {
      header: "Garment Style",
      cell: (row) => (
        <span className="font-medium text-slate-900">
          {styleMap.get(row.styleId) || row.styleId}
        </span>
      ),
    },
    {
      header: "Season / Campaign",
      accessorKey: "season",
      cell: (row) => <span className="text-xs text-slate-600 font-mono">{row.season}</span>,
    },
    {
      header: "Approval Status",
      accessorKey: "status",
      cell: (row) => {
        if (row.status === "APPROVED") {
          return (
            <Badge variant="success" size="sm">
              Approved
            </Badge>
          );
        }
        if (row.status === "SUBMITTED") {
          return (
            <Badge variant="warning" size="sm">
              Pending Approval
            </Badge>
          );
        }
        return (
          <Badge variant="neutral" size="sm">
            Draft
          </Badge>
        );
      },
    },
    {
      header: "Created Date",
      accessorKey: "createdAt",
      cell: (row) => (
        <span className="text-xs text-slate-500 font-mono">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const jobCostColumns: ColumnDef<JobCostSummary>[] = [
    {
      header: "Production Order",
      accessorKey: "productionOrderId",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-emerald-50 text-emerald-700">
            <Calculator className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-xs font-semibold text-slate-900">
            {row.productionOrder?.orderNumber || row.productionOrderId.slice(0, 8)}
          </span>
        </div>
      ),
    },
    {
      header: "Standard Budget",
      cell: (row) => (
        <span className="text-xs font-mono text-slate-600">
          ${Number(row.totalStandardCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: "Actual Job Cost",
      cell: (row) => (
        <span className="text-xs font-mono font-bold text-slate-900">
          ${Number(row.totalActualCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: "Cost Variance",
      cell: (row) => {
        const variance = Number(row.costVariance);
        return (
          <span
            className={`font-mono text-xs font-semibold ${
              variance > 0 ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {variance > 0 ? `+$${variance.toFixed(2)}` : `-$${Math.abs(variance).toFixed(2)}`}
          </span>
        );
      },
    },
    {
      header: "Invoiced Revenue",
      cell: (row) => (
        <span className="text-xs font-mono text-slate-700">
          ${Number(row.invoicedRevenue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: "Realized Profit",
      cell: (row) => {
        const profit = Number(row.realizedProfit);
        return (
          <span
            className={`font-mono text-xs font-bold ${
              profit >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            ${profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      header: "Gross Margin %",
      cell: (row) => {
        const margin = Number(row.realizedMarginPercent);
        return (
          <Badge variant={margin >= 15 ? "success" : margin > 0 ? "warning" : "danger"} size="sm">
            {margin.toFixed(1)}%
          </Badge>
        );
      },
    },
    {
      header: "Calculated At",
      accessorKey: "calculatedAt",
      cell: (row) => (
        <span className="text-xs text-slate-500 font-mono">
          {new Date(row.calculatedAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  if (!can("COSTING:READ")) {
    return (
      <ForbiddenState
        requiredPermission="COSTING:READ"
        moduleName="Commercial Costing"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commercial Costing & Job Profitability"
        description="Pre-order garment BOM costing sheets, real-time production job costing, and realized commercial invoice margins."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Commercial" },
          { label: "Costing" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "sheets" && canCostingWrite && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStyleId(styles.length > 0 ? styles[0].id : "");
                  setCreateModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                New Costing Sheet
              </Button>
            )}
            {activeTab === "job-costs" && canCostingWrite && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedOrderId(orders.length > 0 ? orders[0].id : "");
                  setJobCostModalOpen(true);
                }}
              >
                <Calculator className="w-3.5 h-3.5" />
                Calculate Order Profitability
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("sheets")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "sheets"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FileText className="w-4 h-4" />
          Pre-Production Costing Sheets (BOM)
        </button>
        <button
          onClick={() => setActiveTab("job-costs")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "job-costs"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Actual Job Costing & Invoice Profitability
        </button>
      </div>

      {activeTab === "sheets" && (
        <DataTable
          title="Costing Sheets Directory"
          subtitle="Commercial BOM sheets and target margin calculations"
          columns={sheetColumns}
          data={sheets}
          isLoading={isSheetsLoading}
          isError={isSheetsError}
          errorMessage={(sheetsError as any)?.message}
          onRetry={refetchSheets}
          searchKey="season"
          searchPlaceholder="Search by season or style..."
          emptyTitle="No Costing Sheets Found"
          emptyDescription="Create a commercial costing sheet to analyze fabric consumption, labor, overheads, and target profit margins."
          emptyActionLabel={canCostingWrite ? "Create Costing Sheet" : undefined}
          onEmptyAction={() => {
            setStyleId(styles.length > 0 ? styles[0].id : "");
            setCreateModalOpen(true);
          }}
        />
      )}

      {activeTab === "job-costs" && (
        <DataTable
          title="Production Job Costing & Margin Summaries"
          subtitle="Actual material cut costs, SMV labor, and realized margin against commercial invoices"
          columns={jobCostColumns}
          data={jobCosts}
          isLoading={isJobCostsLoading}
          isError={isJobCostsError}
          errorMessage={(jobCostsError as any)?.message}
          onRetry={refetchJobCosts}
          searchKey="productionOrderId"
          searchPlaceholder="Search by production order..."
          emptyTitle="No Job Costs Calculated"
          emptyDescription="Calculate job costs on an in-progress or completed production order to evaluate realized profitability."
          emptyActionLabel={canCostingWrite ? "Calculate Order Profitability" : undefined}
          onEmptyAction={() => {
            setSelectedOrderId(orders.length > 0 ? orders[0].id : "");
            setJobCostModalOpen(true);
          }}
        />
      )}

      {/* Create Costing Sheet Dialog */}
      <Dialog
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Commercial Costing Sheet"
        description="Select a garment style and season code for BOM price calculation."
      >
        <form onSubmit={handleCreateSheet} className="space-y-4">
          <Select
            label="Garment Style Master"
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
            required
          >
            <option value="">Select style SKU...</option>
            {styles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </Select>

          <Input
            label="Season / Collection Code"
            placeholder="e.g. SS-2026 or AW-2026"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              disabled={createSheetMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createSheetMutation.isPending}
            >
              Create Sheet
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Calculate Job Costing Dialog */}
      <Dialog
        isOpen={jobCostModalOpen}
        onClose={() => setJobCostModalOpen(false)}
        title="Calculate Actual Order Job Cost & Margin"
        description="Compute actual fabric, trim, and labor costs for a production order and compare against commercial invoices."
      >
        <form onSubmit={handleCalculateJobCost} className="space-y-4">
          <Select
            label="Target Production Order"
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            required
          >
            <option value="">Select Production Order...</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} — {o.buyerPoLine?.style?.name || "Garment SKU"} (Target: {Number(o.targetQuantity)} pcs) [{o.status}]
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Minute Labor Rate ($/min)"
              type="number"
              step="0.01"
              min="0.01"
              value={minuteLaborRate}
              onChange={(e) => setMinuteLaborRate(e.target.value)}
              required
            />
            <Input
              label="Factory Overhead (%)"
              type="number"
              step="0.1"
              min="0"
              value={overheadPercent}
              onChange={(e) => setOverheadPercent(e.target.value)}
              required
            />
          </div>

          <Input
            label="Calculation Notes (Optional)"
            placeholder="e.g. End of batch job costing calculation"
            value={jobCostNotes}
            onChange={(e) => setJobCostNotes(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setJobCostModalOpen(false)}
              disabled={calculateJobCostMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={calculateJobCostMutation.isPending}
            >
              Compute Job Profitability
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
