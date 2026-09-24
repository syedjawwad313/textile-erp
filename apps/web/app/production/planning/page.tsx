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
  useProductionPlans,
  usePlanProductionOrder,
} from "../../../hooks/use-production";
import { useProductionLines } from "../../../hooks/use-master-data";
import { ProductionOrder, ProductionLine } from "../../../lib/api/types";
import {
  Calendar,
  Clock,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  CalendarRange,
  Gauge,
  GitCommit,
} from "lucide-react";
import { OrderPipelineModal } from "../../../components/production/order-pipeline-modal";

export default function ProductionPlanningPage() {
  const toast = useToast();
  const { data: orders = [], isLoading: isOrdersLoading } = useProductionOrders();
  const { data: plans = [], isLoading: isPlansLoading } = useProductionPlans();
  const { data: lines = [] } = useProductionLines();
  const planMutation = usePlanProductionOrder();

  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [pipelineOrderId, setPipelineOrderId] = useState<string | null>(null);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);

  // Form State
  const [lineId, setLineId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [smv, setSmv] = useState<number | string>("");
  const [dailyTarget, setDailyTarget] = useState<number | string>("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleOpenPlanDialog = (order: ProductionOrder) => {
    setSelectedOrder(order);
    setLineId(order.productionLineId || (lines.length > 0 ? lines[0].id : ""));
    setStartDate(
      order.plannedStartDate
        ? new Date(order.plannedStartDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]
    );
    setEndDate(
      order.plannedEndDate
        ? new Date(order.plannedEndDate).toISOString().split("T")[0]
        : new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
    );
    setSmv(order.smv !== undefined && order.smv !== null ? Number(order.smv) : 18.5);
    setDailyTarget(order.productionLine?.capacity ? Number(order.productionLine.capacity) : 1000);
    setFormErrors({});
    setIsPlanDialogOpen(true);
  };

  const handleClosePlanDialog = () => {
    setIsPlanDialogOpen(false);
    setSelectedOrder(null);
  };

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const errs: Record<string, string> = {};
    if (!lineId) errs.lineId = "Please select a production line.";
    if (!startDate) errs.startDate = "Start date is required.";
    if (!endDate) errs.endDate = "End date is required.";
    if (new Date(startDate) > new Date(endDate)) {
      errs.endDate = "End date cannot precede start date.";
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    try {
      await planMutation.mutateAsync({
        id: selectedOrder.id,
        data: {
          productionLineId: lineId,
          plannedStartDate: new Date(startDate).toISOString(),
          plannedEndDate: new Date(endDate).toISOString(),
          smv: smv ? Number(smv) : undefined,
          dailyTarget: dailyTarget ? Number(dailyTarget) : undefined,
        },
        idempotencyKey: `plan-${selectedOrder.id}-${Date.now()}`,
      });

      toast.success(
        "Line Planned Successfully",
        `Order ${selectedOrder.orderNumber} scheduled on selected production line.`
      );
      handleClosePlanDialog();
    } catch (err: any) {
      toast.error("Planning Failed", err?.message || "Could not schedule order.");
    }
  };

  // Aggregated KPIs
  const totalOrders = orders.length;
  const plannedOrders = orders.filter((o) => !!o.productionLineId).length;
  const totalVolume = orders.reduce((sum, o) => sum + Number(o.targetQuantity || 0), 0);
  const avgSmv =
    orders.filter((o) => Number(o.smv) > 0).length > 0
      ? (
          orders
            .filter((o) => Number(o.smv) > 0)
            .reduce((sum, o) => sum + Number(o.smv), 0) /
          orders.filter((o) => Number(o.smv) > 0).length
        ).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Line Planning & Scheduling"
        description="Assign garment production orders to factory assembly lines, schedule date windows, and tune line SMV metrics."
        breadcrumbs={[
          { label: "MES", href: "/dashboard" },
          { label: "Line Planning" },
        ]}
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Orders
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalOrders}</div>
              <div className="text-xs text-slate-500 mt-1">
                {plannedOrders} / {totalOrders} Scheduled
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Gauge className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Scheduled Lines
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {new Set(plans.map((p) => p.productionLineId)).size}
              </div>
              <div className="text-xs text-slate-500 mt-1">{lines.length} Active Plants</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Target Volume
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {totalVolume.toLocaleString()} pcs
              </div>
              <div className="text-xs text-slate-500 mt-1">Total order allocation</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Average Line SMV
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{avgSmv} min</div>
              <div className="text-xs text-slate-500 mt-1">Pitch & throughput metric</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production Orders Planning Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Manufacturing Orders Planning Queue
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Select an order to assign a sewing line, define standard minute values, and lock dates.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isOrdersLoading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading manufacturing orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No production orders available in this tenant workspace.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">Order Number</th>
                    <th className="px-6 py-3.5">Style / Buyer</th>
                    <th className="px-6 py-3.5">Target Qty</th>
                    <th className="px-6 py-3.5">Assigned Line</th>
                    <th className="px-6 py-3.5">Schedule Window</th>
                    <th className="px-6 py-3.5">SMV</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => {
                    const isLocked =
                      order.status === "IN_PROGRESS" ||
                      order.status === "COMPLETED" ||
                      order.status === "CANCELLED";

                    return (
                      <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-slate-900">
                          {order.orderNumber}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-800">
                            {order.buyerPoLine?.style?.name || "Garment SKU"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {order.buyerPoLine?.buyerPo?.buyer?.name || "Buyer Account"}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {Number(order.targetQuantity).toLocaleString()} pcs
                        </td>
                        <td className="px-6 py-4">
                          {order.productionLine ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              {order.productionLine.name} ({order.productionLine.code})
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">
                          {order.plannedStartDate && order.plannedEndDate ? (
                            <div className="flex items-center gap-1 text-slate-700">
                              <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(order.plannedStartDate).toLocaleDateString()} –{" "}
                              {new Date(order.plannedEndDate).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-slate-400">Not scheduled</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono font-medium text-slate-800">
                          {order.smv !== undefined && order.smv !== null
                            ? `${Number(order.smv).toFixed(1)} min`
                            : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              order.status === "COMPLETED"
                                ? "success"
                                : order.status === "IN_PROGRESS"
                                ? "info"
                                : order.status === "RELEASED"
                                ? "warning"
                                : "neutral"
                            }
                          >
                            {order.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPipelineOrderId(order.id);
                                setIsPipelineModalOpen(true);
                              }}
                            >
                              <GitCommit className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                              360° Pipeline
                            </Button>
                            <Button
                              size="sm"
                              variant={order.productionLineId ? "outline" : "primary"}
                              disabled={isLocked}
                              onClick={() => handleOpenPlanDialog(order)}
                            >
                              {order.productionLineId ? "Edit Plan" : "Plan Line"}
                            </Button>
                          </div>
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

      {/* Plan Order Modal Dialog */}
      <Dialog
        isOpen={isPlanDialogOpen}
        onClose={handleClosePlanDialog}
        title={`Plan Production Line: ${selectedOrder?.orderNumber || ""}`}
        description="Allocate this manufacturing order to an assembly line, configure planned dates, and tune order SMV."
      >
        <form onSubmit={handleSubmitPlan} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Target Quantity:</span>
              <span className="font-semibold text-slate-900">
                {Number(selectedOrder?.targetQuantity || 0).toLocaleString()} pcs
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Garment Style:</span>
              <span className="font-medium text-slate-800">
                {selectedOrder?.buyerPoLine?.style?.name || "Garment SKU"}
              </span>
            </div>
          </div>

          <Select
            label="Assigned Production Line"
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            error={formErrors.lineId}
            required
          >
            <option value="">Select a manufacturing line...</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.code}) — Capacity: {Number(l.capacity).toLocaleString()} pcs/day
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Planned Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              error={formErrors.startDate}
              required
            />
            <Input
              label="Planned End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              error={formErrors.endDate}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Standard Minute Value (SMV)"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 18.5"
              value={smv}
              onChange={(e) => setSmv(e.target.value)}
              helperText="Garment assembly work content in minutes"
            />
            <Input
              label="Daily Target (pcs/day)"
              type="number"
              min="1"
              placeholder="e.g. 1000"
              value={dailyTarget}
              onChange={(e) => setDailyTarget(e.target.value)}
              helperText="Target daily throughput"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClosePlanDialog}
              disabled={planMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={planMutation.isPending}
            >
              Confirm Line Plan
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 360° Order Operational Pipeline Modal */}
      <OrderPipelineModal
        isOpen={isPipelineModalOpen}
        onClose={() => setIsPipelineModalOpen(false)}
        orderId={pipelineOrderId}
      />
    </div>
  );
}
