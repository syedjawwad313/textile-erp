"use client";

import React, { useState } from "react";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Dialog } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useToast } from "../../../components/ui/toast";
import {
  useProductionOrders,
  useCuttingRecords,
  useCreateCuttingRecord,
} from "../../../hooks/use-production";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api/client";
import {
  Scissors,
  Layers,
  ArrowRight,
  TrendingUp,
  Percent,
  CheckCircle2,
  FileSpreadsheet,
  Receipt,
  Plus,
} from "lucide-react";

export default function CuttingRoomPage() {
  const toast = useToast();
  const { data: orders = [], isLoading: isOrdersLoading } = useProductionOrders();
  const { data: cuttingRecords = [], isLoading: isRecordsLoading } = useCuttingRecords();
  const createCuttingMutation = useCreateCuttingRecord();

  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);

  // Form State
  const [productionOrderId, setProductionOrderId] = useState("");
  const [fabricMaterialId, setFabricMaterialId] = useState("");
  const [fabricQuantity, setFabricQuantity] = useState<number | string>("");
  const [cutQuantity, setCutQuantity] = useState<number | string>("");
  const [markerLength, setMarkerLength] = useState<number | string>("");
  const [markerEfficiency, setMarkerEfficiency] = useState<number | string>("");
  const [wastagePercent, setWastagePercent] = useState<number | string>("");
  const [layCount, setLayCount] = useState<number | string>(1);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const selectedOrder = orders.find((o) => o.id === productionOrderId);
  const availableBOMFabrics =
    selectedOrder?.buyerPoLine?.style?.id
      ? [] // fallback if populated
      : [];

  const handleOpenRecordDialog = () => {
    // Select first active order (RELEASED or IN_PROGRESS)
    const activeOrder = orders.find(
      (o) => o.status === "RELEASED" || o.status === "IN_PROGRESS"
    );
    setProductionOrderId(activeOrder ? activeOrder.id : "");
    setFabricMaterialId("");
    setFabricQuantity("");
    setCutQuantity("");
    setMarkerLength("");
    setMarkerEfficiency(86.5);
    setWastagePercent(2.0);
    setLayCount(1);
    setFormErrors({});
    setIsRecordDialogOpen(true);
  };

  const handleCloseRecordDialog = () => {
    setIsRecordDialogOpen(false);
  };

  const handleSubmitCuttingRecord = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs: Record<string, string> = {};
    if (!productionOrderId) errs.productionOrderId = "Please select a production order.";
    if (!fabricMaterialId.trim()) errs.fabricMaterialId = "Fabric Material ID is required.";
    if (!fabricQuantity || Number(fabricQuantity) <= 0) {
      errs.fabricQuantity = "Fabric consumption quantity must be positive.";
    }
    if (!cutQuantity || Number(cutQuantity) <= 0) {
      errs.cutQuantity = "Cut piece quantity must be greater than zero.";
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    try {
      await createCuttingMutation.mutateAsync({
        data: {
          productionOrderId,
          fabricMaterialId: fabricMaterialId.trim(),
          fabricQuantity: Number(fabricQuantity),
          cutQuantity: Number(cutQuantity),
          markerLength: markerLength ? Number(markerLength) : undefined,
          markerEfficiency: markerEfficiency ? Number(markerEfficiency) : undefined,
          wastagePercent: wastagePercent ? Number(wastagePercent) : undefined,
          layCount: layCount ? Number(layCount) : 1,
        },
        idempotencyKey: `cut-${productionOrderId}-${Date.now()}`,
      });

      toast.success(
        "Cutting Batch Logged",
        `Successfully logged ${cutQuantity} cut panels. Fabric stock debited in inventory ledger.`
      );
      handleCloseRecordDialog();
    } catch (err: any) {
      toast.error("Cutting Batch Failed", err?.message || "Could not record cutting batch.");
    }
  };

  // KPIs
  const totalBatches = cuttingRecords.length;
  const totalCutPieces = cuttingRecords.reduce(
    (sum, r) => sum + Number(r.cutQuantity || 0),
    0
  );
  const totalFabricConsumed = cuttingRecords.reduce(
    (sum, r) => sum + Number(r.fabricQuantity || 0),
    0
  );
  const avgEfficiency =
    cuttingRecords.filter((r) => Number(r.markerEfficiency) > 0).length > 0
      ? (
          cuttingRecords
            .filter((r) => Number(r.markerEfficiency) > 0)
            .reduce((sum, r) => sum + Number(r.markerEfficiency), 0) /
          cuttingRecords.filter((r) => Number(r.markerEfficiency) > 0).length
        ).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cutting Room & Raw Material Conversion"
        description="Record fabric roll spreading, marker yield metrics, and cut piece panel output with automatic double-entry inventory ledger debits."
        breadcrumbs={[
          { label: "MES", href: "/dashboard" },
          { label: "Cutting Room" },
        ]}
        actions={
          <Button variant="primary" size="sm" onClick={handleOpenRecordDialog}>
            <Plus className="w-4 h-4" />
            Record Cutting Batch
          </Button>
        }
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cutting Batches
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalBatches}</div>
              <div className="text-xs text-slate-500 mt-1">Logged work sessions</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cut Panels Produced
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {totalCutPieces.toLocaleString()} pcs
              </div>
              <div className="text-xs text-slate-500 mt-1">Ready for sewing assembly</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Fabric Consumed
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {totalFabricConsumed.toLocaleString()} MTR
              </div>
              <div className="text-xs text-slate-500 mt-1">Issued from inventory</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Percent className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Avg Marker Efficiency
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{avgEfficiency}%</div>
              <div className="text-xs text-slate-500 mt-1">Fabric utilization yield</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cutting Records Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Cutting Room Production Records
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of fabric roll transformations into cut garment components, verified against the double-entry inventory ledger.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isRecordsLoading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading cutting records...
            </div>
          ) : cuttingRecords.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No cutting records logged yet in this workspace. Click &quot;Record Cutting Batch&quot; to begin.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">Logged Time</th>
                    <th className="px-6 py-3.5">Order Number</th>
                    <th className="px-6 py-3.5">Fabric Material</th>
                    <th className="px-6 py-3.5">Fabric Issued</th>
                    <th className="px-6 py-3.5">Cut Panels</th>
                    <th className="px-6 py-3.5">Marker Yield</th>
                    <th className="px-6 py-3.5">Lay Count</th>
                    <th className="px-6 py-3.5 text-right">Ledger Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cuttingRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono text-slate-500">
                        {new Date(record.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono font-medium text-slate-900">
                          {record.productionOrder?.orderNumber || "PRD-ORDER"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {record.productionOrder?.buyerPoLine?.style?.name || "Garment Style"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">
                          {record.fabricMaterial?.name || record.fabricMaterialId}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          {record.fabricMaterial?.code || "MAT-FAB"}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-purple-700 font-mono">
                        {Number(record.fabricQuantity).toLocaleString()} MTR
                      </td>
                      <td className="px-6 py-4 font-semibold text-emerald-700 font-mono">
                        {Number(record.cutQuantity).toLocaleString()} pcs
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {record.markerEfficiency ? (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                            <span className="font-semibold text-slate-900">
                              {Number(record.markerEfficiency).toFixed(1)}%
                            </span>
                            {record.markerLength && (
                              <span className="text-slate-400">({Number(record.markerLength)}m)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-700">
                        {record.layCount || 1} plies
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <Receipt className="w-3 h-3" />
                          Tx: {record.inventoryTransactionId.slice(0, 8)}...
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Material Consumption & Yield Reconciliation Section */}
      <MaterialReconciliationSection orders={orders} />

      {/* Record Cutting Batch Dialog */}
      <Dialog
        isOpen={isRecordDialogOpen}
        onClose={handleCloseRecordDialog}
        title="Record Cutting Room Batch"
        description="Issue raw material fabric rolls and record cut panel pieces for an active production order."
      >
        <form onSubmit={handleSubmitCuttingRecord} className="space-y-4">
          <Select
            label="Target Production Order"
            value={productionOrderId}
            onChange={(e) => setProductionOrderId(e.target.value)}
            error={formErrors.productionOrderId}
            required
          >
            <option value="">Select an order in RELEASED or IN_PROGRESS state...</option>
            {orders
              .filter((o) => o.status === "RELEASED" || o.status === "IN_PROGRESS")
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} — {o.buyerPoLine?.style?.name || "Garment SKU"} (Target:{" "}
                  {Number(o.targetQuantity).toLocaleString()} pcs) [{o.status}]
                </option>
              ))}
          </Select>

          {selectedOrder && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Order Target:</span>
                <span className="font-semibold text-slate-900">
                  {Number(selectedOrder.targetQuantity).toLocaleString()} pcs
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <Badge variant="info" size="sm">
                  {selectedOrder.status}
                </Badge>
              </div>
            </div>
          )}

          <Input
            label="Fabric Material ID / Reference"
            placeholder="e.g. mat-uuid or enter material id"
            value={fabricMaterialId}
            onChange={(e) => setFabricMaterialId(e.target.value)}
            error={formErrors.fabricMaterialId}
            required
            helperText="Material ID from inventory ledger to be debited"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Fabric Issued (MTR)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 300"
              value={fabricQuantity}
              onChange={(e) => setFabricQuantity(e.target.value)}
              error={formErrors.fabricQuantity}
              required
            />
            <Input
              label="Cut Pieces Output (pcs)"
              type="number"
              min="1"
              placeholder="e.g. 200"
              value={cutQuantity}
              onChange={(e) => setCutQuantity(e.target.value)}
              error={formErrors.cutQuantity}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Marker Length (m)"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 12.5"
              value={markerLength}
              onChange={(e) => setMarkerLength(e.target.value)}
            />
            <Input
              label="Marker Efficiency (%)"
              type="number"
              step="0.1"
              min="0"
              max="100"
              placeholder="e.g. 86.4"
              value={markerEfficiency}
              onChange={(e) => setMarkerEfficiency(e.target.value)}
            />
            <Input
              label="Lay Plies Count"
              type="number"
              min="1"
              placeholder="e.g. 50"
              value={layCount}
              onChange={(e) => setLayCount(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCloseRecordDialog}
              disabled={createCuttingMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createCuttingMutation.isPending}
            >
              Issue Fabric & Save Batch
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function MaterialReconciliationSection({ orders }: { orders: any[] }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: reconciliations = [], isLoading } = useQuery({
    queryKey: ["material-reconciliations"],
    queryFn: () => api.get<any[]>("/material-reconciliations"),
  });

  const reconcileMutation = useMutation({
    mutationFn: ({ orderId, notes }: { orderId: string; notes?: string }) =>
      api.post(`/material-reconciliations/orders/${orderId}/reconcile`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-reconciliations"] });
      toast.success("Material Reconciled", "Planned vs cut fabric and trims balanced successfully.");
      setSelectedOrderId("");
      setNotes("");
    },
    onError: (err: any) => {
      toast.error("Reconciliation Failed", err?.message || "Could not reconcile order materials.");
    },
  });

  const handleReconcile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      toast.error("Validation Error", "Please select a production order.");
      return;
    }
    reconcileMutation.mutate({ orderId: selectedOrderId, notes });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Material Consumption & Cutting Yield Reconciliation
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Compare engineered BOM yardage requirements against actual physical cutting room consumption and trim issuances.
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Quick Reconcile Action Form */}
        <form onSubmit={handleReconcile} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Reconcile Production Order Material Variance
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              label="Select Production Order"
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
            >
              <option value="">Select Order...</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} ({o.status})
                </option>
              ))}
            </Select>
            <Input
              label="Audit / Yield Notes (Optional)"
              placeholder="e.g. Marker efficiency improved after CAD re-nesting"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex items-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="w-full"
                isLoading={reconcileMutation.isPending}
                disabled={!selectedOrderId}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Calculate & Balance Consumption
              </Button>
            </div>
          </div>
        </form>

        {/* Reconciled Table */}
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading reconciliations...</div>
        ) : reconciliations.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No material reconciliations calculated yet. Select an order above to compute consumption variance.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Order Number</th>
                  <th className="px-4 py-3">Planned Fabric</th>
                  <th className="px-4 py-3">Actual Cut Fabric</th>
                  <th className="px-4 py-3">Meters Variance</th>
                  <th className="px-4 py-3">Cutting Yield %</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reconciled At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliations.map((rec: any) => {
                  let badgeVariant: "success" | "warning" | "danger" = "success";
                  if (rec.status === "BALANCED") badgeVariant = "warning";
                  else if (rec.status === "OVER_CONSUMPTION") badgeVariant = "danger";

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                        {rec.productionOrder?.orderNumber || rec.productionOrderId}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {Number(rec.totalPlannedMeters).toLocaleString()} MTR
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-purple-700">
                        {Number(rec.totalActualCutMeters).toLocaleString()} MTR
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span
                          className={
                            Number(rec.metersVariance) > 0
                              ? "text-rose-600 font-semibold"
                              : "text-emerald-600 font-semibold"
                          }
                        >
                          {Number(rec.metersVariance) > 0 ? "+" : ""}
                          {Number(rec.metersVariance).toLocaleString()} MTR
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {Number(rec.cuttingYieldPercentage).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badgeVariant} size="sm">
                          {rec.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                        {new Date(rec.reconciledAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

