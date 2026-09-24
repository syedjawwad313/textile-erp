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
import { useProductionDefects, useCreateProductionDefect } from "../../../hooks/use-defects";
import { useProductionOrders } from "../../../hooks/use-production";
import { useBundles } from "../../../hooks/use-bundles";
import { DefectStatus } from "../../../lib/api/types";
import {
  AlertOctagon,
  Plus,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Ban,
  Package,
  Layers,
  FileText,
} from "lucide-react";

const DEFECT_CODES = [
  { code: "STITCH_DEFECT", label: "Stitching / Seam Defect" },
  { code: "FABRIC_DEFECT", label: "Fabric Hole / Pull / Snag" },
  { code: "STAIN_OIL", label: "Oil / Dirt Stain" },
  { code: "SHADE_MISMATCH", label: "Color / Shade Variation" },
  { code: "MEASUREMENT_OUT", label: "Measurement Out of Tolerance" },
  { code: "TRIM_DEFECT", label: "Broken / Missing Button or Zipper" },
  { code: "OTHER", label: "Other Execution Defect" },
];

export default function DefectRegisterPage() {
  const toast = useToast();

  // Filters state
  const [filterOrderId, setFilterOrderId] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Data queries
  const { data: defects = [], isLoading: isDefectsLoading } = useProductionDefects({
    productionOrderId: filterOrderId || undefined,
    status: (filterStatus as DefectStatus) || undefined,
    limit: 100,
  });
  const { data: productionOrders = [] } = useProductionOrders();
  const { data: bundles = [] } = useBundles();

  // Mutation
  const createDefectMutation = useCreateProductionDefect();

  // New Defect Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newOrderId, setNewOrderId] = useState("");
  const [newBundleId, setNewBundleId] = useState("");
  const [newOperationId, setNewOperationId] = useState("");
  const [newDefectCode, setNewDefectCode] = useState("STITCH_DEFECT");
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [newStatus, setNewStatus] = useState<DefectStatus>("OPEN");
  const [newRemarks, setNewRemarks] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  const selectedOrderForNew = productionOrders.find((o) => o.id === newOrderId);
  const orderBundles = bundles.filter((b) => b.productionOrderId === newOrderId);

  // Status badge styling
  const getStatusBadge = (status: DefectStatus) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="danger" className="font-mono text-xs">OPEN</Badge>;
      case "REWORK":
        return <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 font-mono text-xs">REWORK</Badge>;
      case "RESOLVED":
        return <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 font-mono text-xs">RESOLVED</Badge>;
      case "REJECTED":
        return <Badge variant="outline" className="border-rose-600/40 text-rose-400 bg-rose-950/20 font-mono text-xs">SCRAP/REJECT</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Handle register defect submit
  const handleRegisterDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    setDialogError(null);

    if (!newOrderId) {
      setDialogError("Please select a Production Order.");
      return;
    }
    if (!newOperationId) {
      setDialogError("Please select the Operation where the defect occurred.");
      return;
    }
    if (newQuantity <= 0) {
      setDialogError("Quantity must be at least 1 unit.");
      return;
    }

    try {
      const idempotencyKey = `defect-reg-${newOrderId}-${Date.now()}`;
      await createDefectMutation.mutateAsync({
        data: {
          productionOrderId: newOrderId,
          bundleId: newBundleId || undefined,
          operationId: newOperationId,
          defectCode: newDefectCode,
          quantity: Number(newQuantity),
          status: newStatus,
          remarks: newRemarks || undefined,
        },
        idempotencyKey,
      });

      toast.success("Defect Registered", `Recorded defect ${newDefectCode} (${newQuantity} pcs).`);
      setIsDialogOpen(false);
      setNewRemarks("");
      setNewQuantity(1);
    } catch (err: any) {
      setDialogError(err.message || "Failed to register defect");
    }
  };

  // Filtered defects by search
  const filteredDefects = defects.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.defectCode.toLowerCase().includes(q) ||
      d.bundle?.barcode.toLowerCase().includes(q) ||
      d.productionOrder?.orderNumber.toLowerCase().includes(q) ||
      (d.remarks && d.remarks.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Defect Register & Disposition"
        description="Comprehensive log of shop-floor defects, quality rejections, and rework tracking"
        actions={
          <Button
            onClick={() => {
              setDialogError(null);
              setIsDialogOpen(true);
            }}
            className="gap-2 bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30"
          >
            <Plus className="w-4 h-4" />
            Register Defect
          </Button>
        }
      />

      {/* Filter Bar */}
      <Card className="border-slate-800 bg-slate-900/80 backdrop-blur">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search defect code, bundle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-950/80 border-slate-700 text-white h-10"
              />
            </div>

            <div>
              <Select
                value={filterOrderId}
                onChange={(e) => setFilterOrderId(e.target.value)}
                className="bg-slate-950/80 border-slate-700 text-white h-10"
              >
                <option value="">All Production Orders</option>
                {productionOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950/80 border-slate-700 text-white h-10"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="REWORK">REWORK</option>
                <option value="REJECTED">REJECTED / SCRAP</option>
                <option value="RESOLVED">RESOLVED</option>
              </Select>
            </div>

            <div className="flex items-center justify-end text-xs text-slate-400">
              Showing <span className="text-white font-bold mx-1">{filteredDefects.length}</span> defect records
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Defect Table */}
      <Card className="border-slate-800 bg-slate-900/90 shadow-xl">
        <CardHeader className="border-b border-slate-800/80 pb-4">
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-400" />
            Defect Log & Traceability Ledger
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isDefectsLoading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading defect records...</div>
          ) : filteredDefects.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 text-emerald-400/50 mx-auto mb-3" />
              <h4 className="text-base font-semibold text-white">No Defects Found</h4>
              <p className="text-xs text-slate-500 mt-1">No defect events match the selected criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Defect Code</th>
                    <th className="p-3.5">Order</th>
                    <th className="p-3.5">Bundle Barcode</th>
                    <th className="p-3.5">Operation</th>
                    <th className="p-3.5">Quantity</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Remarks</th>
                    <th className="p-3.5">Recorded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredDefects.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-rose-300">
                        {d.defectCode}
                      </td>
                      <td className="p-3.5 text-white font-medium">
                        {d.productionOrder?.orderNumber || "PO"}
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {d.bundle?.barcode || <span className="text-slate-600">Line-level</span>}
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {d.operation?.operationName || "Operation"}
                      </td>
                      <td className="p-3.5 font-bold font-mono text-white">
                        {d.quantity} pcs
                      </td>
                      <td className="p-3.5">
                        {getStatusBadge(d.status)}
                      </td>
                      <td className="p-3.5 text-slate-400 max-w-xs truncate">
                        {d.remarks || "-"}
                      </td>
                      <td className="p-3.5 text-slate-500">
                        {new Date(d.createdAt).toLocaleDateString()} {new Date(d.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Register Defect Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Register Shop-Floor Defect"
      >
        <form onSubmit={handleRegisterDefect} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Production Order *
            </label>
            <Select
              value={newOrderId}
              onChange={(e) => {
                setNewOrderId(e.target.value);
                setNewBundleId("");
                setNewOperationId("");
              }}
              className="bg-slate-950 border-slate-700 text-white w-full"
            >
              <option value="">Select Order...</option>
              {productionOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Operation *
              </label>
              <Select
                value={newOperationId}
                onChange={(e) => setNewOperationId(e.target.value)}
                className="bg-slate-950 border-slate-700 text-white w-full"
              >
                <option value="">Select Operation...</option>
                {selectedOrderForNew?.operations?.map((op) => (
                  <option key={op.id} value={op.id}>
                    Seq {op.sequence}: {op.operationName}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Bundle (Optional)
              </label>
              <Select
                value={newBundleId}
                onChange={(e) => setNewBundleId(e.target.value)}
                className="bg-slate-950 border-slate-700 text-white w-full"
              >
                <option value="">Line-level / No bundle</option>
                {orderBundles.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.barcode} ({b.quantity} pcs)
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Defect Reason Code *
              </label>
              <Select
                value={newDefectCode}
                onChange={(e) => setNewDefectCode(e.target.value)}
                className="bg-slate-950 border-slate-700 text-white w-full"
              >
                {DEFECT_CODES.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} - {d.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Quantity (pcs) *
              </label>
              <Input
                type="number"
                min="1"
                value={newQuantity}
                onChange={(e) => setNewQuantity(Number(e.target.value))}
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Initial Disposition Status
            </label>
            <Select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as DefectStatus)}
              className="bg-slate-950 border-slate-700 text-white w-full"
            >
              <option value="OPEN">OPEN (Pending Review)</option>
              <option value="REWORK">REWORK (Sent for Correction)</option>
              <option value="REJECTED">REJECTED / SCRAP</option>
              <option value="RESOLVED">RESOLVED</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Remarks & Observations
            </label>
            <Input
              type="text"
              placeholder="Detailed description of defect..."
              value={newRemarks}
              onChange={(e) => setNewRemarks(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white"
            />
          </div>

          {dialogError && (
            <div className="p-3 rounded bg-rose-950/30 border border-rose-500/50 text-xs text-rose-200">
              {dialogError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createDefectMutation.isPending}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {createDefectMutation.isPending ? "Registering..." : "Confirm Defect"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
