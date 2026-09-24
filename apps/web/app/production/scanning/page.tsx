"use client";

import React, { useState, useRef, useEffect } from "react";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { useToast } from "../../../components/ui/toast";
import { useScanBundle, useBundleScans } from "../../../hooks/use-bundles";
import { useProductionOrders } from "../../../hooks/use-production";
import { useEmployees, useMachines } from "../../../hooks/use-master-data";
import { BundleScan } from "../../../lib/api/types";
import {
  ScanLine,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Layers,
  ShieldCheck,
  History,
  Tag,
} from "lucide-react";

export default function ShopFloorScanningPage() {
  const toast = useToast();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const { data: productionOrders = [] } = useProductionOrders();
  const { data: employees = [] } = useEmployees();
  const { data: machines = [] } = useMachines();
  const { data: recentScans = [], isLoading: isScansLoading } = useBundleScans({ limit: 15 });

  const scanMutation = useScanBundle();

  // Workstation Setup State
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState("");

  // Scan input & feedback state
  const [barcodeInput, setBarcodeInput] = useState("");
  const [lastScanResult, setLastScanResult] = useState<BundleScan | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [sessionScanCount, setSessionScanCount] = useState(0);
  const [sessionPieceCount, setSessionPieceCount] = useState(0);

  const selectedOrder = productionOrders.find((o) => o.id === selectedOrderId);
  const activeOperations = selectedOrder?.operations || [];
  const selectedOperation = activeOperations.find((op) => op.id === selectedOperationId);

  // Auto-select first order, operation, and employee if available
  useEffect(() => {
    if (productionOrders.length > 0 && !selectedOrderId) {
      const activeOrder =
        productionOrders.find((o) => o.status === "RELEASED" || o.status === "IN_PROGRESS") ||
        productionOrders[0];
      setSelectedOrderId(activeOrder.id);
      if (activeOrder.operations && activeOrder.operations.length > 0) {
        setSelectedOperationId(activeOrder.operations[0].id);
      }
    }
  }, [productionOrders, selectedOrderId]);

  useEffect(() => {
    if (employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  useEffect(() => {
    if (selectedOperation?.machineTypeId && machines.length > 0 && !selectedMachineId) {
      setSelectedMachineId(machines[0].id);
    }
  }, [selectedOperation, machines, selectedMachineId]);

  // Keep focus on barcode input for fast scanner gun entry
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, [lastScanResult, scanError]);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBarcode = barcodeInput.trim();

    if (!cleanBarcode) {
      setScanError("Please enter or scan a bundle barcode ticket.");
      barcodeInputRef.current?.focus();
      return;
    }

    if (!selectedOperationId) {
      setScanError("Please select a workstation manufacturing operation.");
      return;
    }

    if (!selectedEmployeeId) {
      setScanError("Please select an active station operator.");
      return;
    }

    if (selectedOperation?.machineTypeId && !selectedMachineId) {
      setScanError(`Operation ${selectedOperation.operationName} requires machine selection.`);
      return;
    }

    setScanError(null);

    try {
      const result = await scanMutation.mutateAsync({
        data: {
          barcode: cleanBarcode,
          operationId: selectedOperationId,
          employeeId: selectedEmployeeId,
          machineId: selectedMachineId || undefined,
        },
        idempotencyKey: `scan-${cleanBarcode}-${selectedOperationId}-${Date.now()}`,
      });

      setLastScanResult(result);
      setSessionScanCount((prev) => prev + 1);
      const qty = Number(result.bundle?.quantity || 0);
      setSessionPieceCount((prev) => prev + qty);
      setBarcodeInput("");
      toast.success(
        "Bundle Scanned & Moved Successfully",
        `Ticket ${cleanBarcode} advanced to next stage.`
      );
    } catch (err: any) {
      const msg = err?.message || "Scan rejected by validation rules.";
      setScanError(msg);
      toast.error("Scan Failed", msg);
    } finally {
      barcodeInputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="MES Shop-Floor Execution & Barcode Scanner"
        description="High-frequency shop-floor terminal for scanning serialized garment bundles, recording operator telemetry, and synchronizing real-time WIP progression."
        breadcrumbs={[
          { label: "MES", href: "/dashboard" },
          { label: "Shop-Floor Scanning" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Terminal Online & Ready
            </span>
          </div>
        }
      />

      {/* Workstation Station Setup Context */}
      <Card className="border-slate-200 bg-slate-900 text-white shadow-md">
        <CardContent className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            Workstation Station Configuration
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                Production Order
              </label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedOrderId}
                onChange={(e) => {
                  setSelectedOrderId(e.target.value);
                  const ord = productionOrders.find((o) => o.id === e.target.value);
                  if (ord?.operations && ord.operations.length > 0) {
                    setSelectedOperationId(ord.operations[0].id);
                  }
                }}
              >
                {productionOrders.map((ord) => (
                  <option key={ord.id} value={ord.id}>
                    {ord.orderNumber} ({ord.buyerPoLine?.style?.name || "Style"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                Current Workstation Operation
              </label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedOperationId}
                onChange={(e) => setSelectedOperationId(e.target.value)}
              >
                {activeOperations.map((op) => (
                  <option key={op.id} value={op.id}>
                    Seq {op.sequence}: {op.operationName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                Operator Identity
              </label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                Machine Station {selectedOperation?.machineTypeId && <span className="text-amber-400">*</span>}
              </label>
              <select
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
              >
                <option value="">No Machine / Manual</option>
                {machines.map((mch) => (
                  <option key={mch.id} value={mch.id}>
                    {mch.name} ({mch.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tablet Scanner & Feedback Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Scanner Terminal & Pipeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-2 border-blue-500/30 bg-gradient-to-b from-white to-blue-50/20 shadow-md">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ScanLine className="w-5 h-5 text-blue-600" />
                  Workstation Barcode Scanner Console
                </CardTitle>
                <span className="text-xs font-mono text-slate-400">
                  Ready for Scanner Gun (Auto-Enter)
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleScanSubmit} className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <QrCode className="w-6 h-6 text-blue-600" />
                  </div>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Scan or type bundle barcode (e.g. BND-PRD-001-XXXX-001)..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 text-lg font-mono font-semibold bg-white border-2 border-blue-400 rounded-xl shadow-inner focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400 text-slate-900"
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full py-4 text-base font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                    isLoading={scanMutation.isPending}
                  >
                    <ScanLine className="w-5 h-5" />
                    SCAN & ADVANCE BUNDLE
                  </Button>
                </div>
              </form>

              {/* Instant Success Feedback Banner */}
              {lastScanResult && !scanError && (
                <div className="mt-5 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-base text-emerald-900">
                        Scan Verified & Advanced!
                      </div>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900 font-bold">
                        {new Date(lastScanResult.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-emerald-800 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono font-bold">
                        Ticket: {lastScanResult.bundle?.barcode || "BUNDLE"}
                      </span>
                      <span>•</span>
                      <span className="font-bold">
                        Qty: {Number(lastScanResult.bundle?.quantity || 0)} pcs
                      </span>
                      <span>•</span>
                      <span>
                        Completed: {lastScanResult.operation?.operationName || "Operation"}
                      </span>
                    </div>
                    <div className="mt-2 text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                      <span>Next Station:</span>
                      {lastScanResult.bundle?.currentOperation ? (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                          Seq {lastScanResult.bundle.currentOperation.sequence}: {lastScanResult.bundle.currentOperation.operationName}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
                          FINISHED (Order Complete)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Instant Error Feedback Banner */}
              {scanError && (
                <div className="mt-5 p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-950 flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-rose-900">
                      Scan Rejected by MES Validation
                    </div>
                    <div className="mt-1 text-xs text-rose-800 leading-relaxed font-medium">
                      {scanError}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Operation Route Visualizer */}
          {selectedOrder && (
            <Card className="border-slate-200">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Manufacturing Operation Pipeline ({selectedOrder.orderNumber})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {activeOperations.map((op) => {
                    const isCurrentStation = op.id === selectedOperationId;
                    return (
                      <div
                        key={op.id}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between transition-all ${
                          isCurrentStation
                            ? "bg-blue-50 border-blue-300 text-blue-900 font-semibold ring-2 ring-blue-400/20"
                            : "bg-slate-50 border-slate-200 text-slate-600"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                              isCurrentStation
                                ? "bg-blue-600 text-white"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {op.sequence}
                          </span>
                          <div>
                            <div className="font-medium text-slate-900">{op.operationName}</div>
                            <div className="text-[10px] text-slate-500">
                              SMV: {Number(op.smv || 0)} min {op.machineTypeId ? `• ${op.machineTypeId}` : ""}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono text-[11px]">
                          <span className="text-slate-500">In:</span> {Number(op.inputQty || 0)}{" "}
                          <span className="text-slate-500 ml-1">Out:</span> {Number(op.outputQty || 0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Col: Live Session Telemetry & Feed */}
        <div className="space-y-6">
          {/* Session Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="text-[11px] font-semibold uppercase text-slate-400">
                  Session Scans
                </div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {sessionScanCount}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Tickets advanced</div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="text-[11px] font-semibold uppercase text-slate-400">
                  WIP Pieces Moved
                </div>
                <div className="text-2xl font-bold text-blue-600 mt-1">
                  {sessionPieceCount}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Garment components</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Scans Feed */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                Live Workstation Scan History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isScansLoading ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Loading scan history...
                </div>
              ) : recentScans.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No scans recorded yet for this tenant.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {recentScans.map((scan) => (
                    <div key={scan.id} className="p-3 hover:bg-slate-50 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900 inline-flex items-center gap-1">
                          <Tag className="w-3 h-3 text-blue-500" />
                          {scan.bundle?.barcode || "TICKET"}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(scan.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-slate-500 text-[11px]">
                        <span>{scan.operation?.operationName || "Operation"}</span>
                        <span className="font-semibold text-emerald-700">
                          {Number(scan.bundle?.quantity || 0)} pcs
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400 flex items-center gap-2">
                        <span>Op: {scan.employee?.name || "Operator"}</span>
                        {scan.machine && <span>• Mch: {scan.machine.code}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
