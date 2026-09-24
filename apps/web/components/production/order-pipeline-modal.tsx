"use client";

import React from "react";
import { Dialog } from "../ui/dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useOrderPipeline } from "../../hooks/use-production";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Scissors,
  Layers,
  ShieldCheck,
  Package,
  DollarSign,
  FileText,
} from "lucide-react";

interface OrderPipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
}

export function OrderPipelineModal({
  isOpen,
  onClose,
  orderId,
}: OrderPipelineModalProps) {
  const { data: pipeline, isLoading } = useOrderPipeline(orderId || undefined);

  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="360° Order Operational Pipeline">
      <div className="w-[850px] max-w-full space-y-6 max-h-[80vh] overflow-y-auto pr-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <p className="text-sm text-gray-500">Loading end-to-end order telemetry...</p>
          </div>
        ) : !pipeline ? (
          <div className="p-8 text-center text-gray-500">
            No pipeline data available for this production order.
          </div>
        ) : (
          <>
            {/* Header Progress Banner */}
            <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-slate-900/40 border border-indigo-500/20 rounded-xl p-5">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-bold text-white tracking-wide">
                      Order #{pipeline.orderNumber}
                    </h3>
                    <Badge variant={pipeline.commercial.orderStatus === "COMPLETED" ? "success" : "info"}>
                      {pipeline.commercial.orderStatus}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Buyer: <span className="text-gray-200 font-medium">{pipeline.commercial.buyer?.name || "Direct Customer"}</span>
                    {" | "}Style: <span className="text-gray-200 font-medium">{pipeline.commercial.style?.code || "STYLE"}</span>
                    {" | "}PO #{pipeline.commercial.buyerPo?.poNumber || "N/A"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-indigo-400">
                    {pipeline.progressPercentage}%
                  </div>
                  <div className="text-xs text-gray-400">Lifecycle Progress</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-800/80 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${pipeline.progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Lifecycle Milestones Roadmap */}
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Operational Milestones Chain
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pipeline.milestones.map((m: any, idx: number) => {
                  const isDone = m.status === "COMPLETED";
                  const isProgress = m.status === "IN_PROGRESS";
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-lg border text-xs transition-all ${
                        isDone
                          ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                          : isProgress
                          ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
                          : "bg-gray-900/40 border-gray-800 text-gray-400"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2">
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          ) : isProgress ? (
                            <Clock className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border border-gray-600 shrink-0" />
                          )}
                          <span className="font-semibold text-gray-100">{m.name}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isDone
                              ? "bg-emerald-500/20 text-emerald-300"
                              : isProgress
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-gray-800 text-gray-500"
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <p className="text-gray-400 pl-6 leading-relaxed">{m.details}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Telemetry Detail Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* Card 1: Cutting & Material Reconciliation */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-400 mb-2">
                  <Scissors className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                    Cutting & Materials
                  </span>
                </div>
                <div className="text-xs space-y-1.5 text-gray-400">
                  <div className="flex justify-between">
                    <span>Fabric Cut:</span>
                    <span className="text-gray-200 font-medium">{pipeline.cutting.totalFabricCutMeters} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cut Panels:</span>
                    <span className="text-gray-200 font-medium">{pipeline.cutting.totalCutUnits} pcs</span>
                  </div>
                  {pipeline.cutting.reconciliation && (
                    <>
                      <div className="flex justify-between">
                        <span>Cutting Yield:</span>
                        <span className="text-emerald-400 font-bold">
                          {pipeline.cutting.reconciliation.cuttingYieldPercentage}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Reconciliation:</span>
                        <Badge variant="success" className="text-[10px]">
                          {pipeline.cutting.reconciliation.status}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Card 2: Quality & Floor Execution */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center space-x-2 text-purple-400 mb-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                    MES & Quality
                  </span>
                </div>
                <div className="text-xs space-y-1.5 text-gray-400">
                  <div className="flex justify-between">
                    <span>Bundles Tracked:</span>
                    <span className="text-gray-200 font-medium">{pipeline.mes.totalBundles}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AQL Audits:</span>
                    <span className="text-gray-200 font-medium">{pipeline.quality.aqlAudits.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Final Quality Gate:</span>
                    <span
                      className={`font-semibold ${
                        pipeline.quality.passedAql ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {pipeline.quality.passedAql ? "PASSED (Released)" : "Pending Audit"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Holds / NCRs:</span>
                    <span className="text-gray-200">
                      {pipeline.quality.activeHoldsCount} holds / {pipeline.quality.ncrsCount} NCRs
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Logistics & Commercial Costing */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 mb-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                    Dispatch & Costing
                  </span>
                </div>
                <div className="text-xs space-y-1.5 text-gray-400">
                  <div className="flex justify-between">
                    <span>Cartons Staged:</span>
                    <span className="text-gray-200 font-medium">{pipeline.packing.cartonsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipment Status:</span>
                    <span className="text-gray-200 font-medium">
                      {pipeline.logistics.isDispatched ? "DISPATCHED" : "Pending Dispatch"}
                    </span>
                  </div>
                  {pipeline.costing.jobCostSummary && (
                    <>
                      <div className="flex justify-between">
                        <span>Actual Total Cost:</span>
                        <span className="text-gray-200 font-medium">
                          ${pipeline.costing.jobCostSummary.totalActualCost}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Realized Margin:</span>
                        <span className="text-emerald-400 font-bold">
                          {pipeline.costing.jobCostSummary.realizedMarginPercent}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
