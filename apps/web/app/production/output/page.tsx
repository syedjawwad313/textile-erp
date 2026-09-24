"use client";

import React, { useState, useRef, useEffect } from "react";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useToast } from "../../../components/ui/toast";
import { useProductionOutputs, useRecordProductionOutput } from "../../../hooks/use-production-output";
import { useBundles } from "../../../hooks/use-bundles";
import { useProductionOrders } from "../../../hooks/use-production";
import { useEmployees } from "../../../hooks/use-master-data";
import { Bundle, ProductionOrder, ProductionOperation } from "../../../lib/api/types";
import {
  CheckCircle2,
  AlertTriangle,
  QrCode,
  CheckCheck,
  Search,
  Package,
  Boxes,
  Users,
  Layers,
  Sparkles,
  ShieldAlert,
  Clock,
  ArrowRight,
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

export default function ProductionOutputPage() {
  const toast = useToast();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Data queries
  const { data: recentOutputs = [], isLoading: isOutputsLoading } = useProductionOutputs({ limit: 30 });
  const { data: bundles = [], isLoading: isBundlesLoading } = useBundles();
  const { data: productionOrders = [] } = useProductionOrders();
  const { data: employees = [] } = useEmployees();

  // Mutations
  const recordOutputMutation = useRecordProductionOutput();

  // Shop-Floor Terminal Form State
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [goodQty, setGoodQty] = useState<number>(0);
  const [defectiveQty, setDefectiveQty] = useState<number>(0);
  const [defectCode, setDefectCode] = useState("STITCH_DEFECT");
  const [defectRemarks, setDefectRemarks] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto-focus barcode input for scanner-gun usability
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Auto-select first operator if available
  useEffect(() => {
    if (employees.length > 0 && !selectedOperatorId) {
      const op = employees.find((e) => e.type === "OPERATOR") || employees[0];
      setSelectedOperatorId(op.id);
    }
  }, [employees, selectedOperatorId]);

  // Handle bundle lookup by barcode
  const handleBarcodeLookup = (codeToSearch?: string) => {
    const code = (codeToSearch || scannedBarcode).trim();
    setValidationError(null);
    if (!code) return;

    const found = bundles.find((b) => b.barcode.toLowerCase() === code.toLowerCase());
    if (found) {
      if (found.isQualityHold) {
        setValidationError(`BLOCKED: Bundle ${found.barcode} is on Quality Hold (${found.qualityHoldReason || "Inspection hold"}). Resolve hold before reporting output.`);
        setSelectedBundle(found);
        return;
      }
      setSelectedBundle(found);
      const order = productionOrders.find((o) => o.id === found.productionOrderId);
      setSelectedOrder(order || null);
      setSelectedOperationId(found.currentOperationId || "");
      const bQty = Number(found.quantity);
      setGoodQty(bQty);
      setDefectiveQty(0);
      setValidationError(null);
    } else {
      setSelectedBundle(null);
      setSelectedOrder(null);
      setValidationError(`Bundle with barcode "${code}" was not found.`);
    }
  };

  // Immediate quantity conservation validation
  const validateQuantities = (good: number, defective: number, maxQty: number): boolean => {
    if (good < 0 || defective < 0) {
      setValidationError("Quantities cannot be negative.");
      return false;
    }
    if (good + defective <= 0) {
      setValidationError("Total production quantity (good + defective) must be greater than 0.");
      return false;
    }
    if (good + defective > maxQty) {
      setValidationError(
        `Quantity conservation violation: Total reported (${good + defective}) exceeds available bundle quantity (${maxQty}).`
      );
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleGoodQtyChange = (val: number) => {
    setGoodQty(val);
    if (selectedBundle) {
      validateQuantities(val, defectiveQty, Number(selectedBundle.quantity));
    }
  };

  const handleDefectiveQtyChange = (val: number) => {
    setDefectiveQty(val);
    if (selectedBundle) {
      validateQuantities(goodQty, val, Number(selectedBundle.quantity));
    }
  };

  // Submit Production Output
  const handleSubmitOutput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBundle) {
      setValidationError("Scan or select a bundle ticket first.");
      return;
    }

    if (selectedBundle.isQualityHold) {
      setValidationError("Cannot report output: Bundle is locked by an ACTIVE Quality Hold.");
      return;
    }

    if (!selectedOperationId) {
      setValidationError("Target operation must be designated.");
      return;
    }

    const maxQty = Number(selectedBundle.quantity);
    if (!validateQuantities(goodQty, defectiveQty, maxQty)) {
      return;
    }

    const idempotencyKey = `output-${selectedBundle.id}-${selectedOperationId}-${Date.now()}`;

    try {
      await recordOutputMutation.mutateAsync({
        data: {
          productionOrderId: selectedBundle.productionOrderId,
          bundleId: selectedBundle.id,
          operationId: selectedOperationId,
          goodQuantity: Number(goodQty),
          defectiveQuantity: Number(defectiveQty),
          operatorId: selectedOperatorId || undefined,
          defectCode: defectiveQty > 0 ? defectCode : undefined,
          defectRemarks: defectiveQty > 0 ? defectRemarks : undefined,
          notes: notes || undefined,
        },
        idempotencyKey,
      });

      toast.success(
        "Production Output Recorded",
        `Logged ${goodQty} good pcs ${defectiveQty > 0 ? `& ${defectiveQty} defective pcs` : ""} for bundle ${selectedBundle.barcode}.`
      );

      // Reset form for next bundle scan
      setSelectedBundle(null);
      setSelectedOrder(null);
      setScannedBarcode("");
      setGoodQty(0);
      setDefectiveQty(0);
      setDefectRemarks("");
      setNotes("");
      setValidationError(null);
      barcodeInputRef.current?.focus();
    } catch (err: any) {
      const msg = err.message || "Failed to record production output";
      setValidationError(msg);
      toast.error("Output Recording Failed", msg);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Production Output & Completion"
        description="Tablet-ready MES terminal for good output verification, defect isolation, and line completion"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: SHOP-FLOOR EXECUTION TERMINAL (7 COLS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur">
            <CardHeader className="border-b border-slate-800/80 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCheck className="w-5 h-5 text-emerald-400" />
                  Shop-Floor Output Station
                </CardTitle>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10 font-mono text-xs">
                  Realtime MES
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmitOutput} className="space-y-5">
                {/* Barcode Scanner Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Scan Bundle Barcode / Ticket
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        ref={barcodeInputRef}
                        type="text"
                        placeholder="Scan or type barcode (e.g. BND-2026-0001)..."
                        value={scannedBarcode}
                        onChange={(e) => {
                          setScannedBarcode(e.target.value);
                          if (e.target.value.trim().length >= 8) {
                            handleBarcodeLookup(e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleBarcodeLookup();
                          }
                        }}
                        className="pl-10 h-12 text-base font-mono bg-slate-950/80 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleBarcodeLookup()}
                      className="h-12 px-5 bg-slate-800 hover:bg-slate-700 text-white font-medium"
                    >
                      <Search className="w-4 h-4 mr-1.5" />
                      Lookup
                    </Button>
                  </div>
                </div>

                {/* Bundle Information Panel */}
                {selectedBundle && (
                  <div className={`p-4 rounded-lg border ${selectedBundle.isQualityHold ? "bg-red-950/20 border-red-500/40" : "bg-slate-950/60 border-slate-800"}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">
                            {selectedBundle.barcode}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono border-blue-500/30 text-blue-300">
                            Tag #{selectedBundle.bundleSequence}
                          </Badge>
                          {selectedBundle.isQualityHold && (
                            <Badge variant="danger" className="text-[10px] flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              QUALITY HOLD
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Order: <span className="text-slate-200 font-semibold">{selectedOrder?.orderNumber || "PO"}</span> • Cut Ref: <span className="text-slate-300 font-mono">{selectedBundle.cuttingRecordId.slice(-8)}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Bundle Units</span>
                        <span className="text-2xl font-bold font-mono text-white">
                          {selectedBundle.quantity} <span className="text-xs text-slate-400 font-normal">pcs</span>
                        </span>
                      </div>
                    </div>

                    {selectedBundle.isQualityHold && (
                      <div className="mt-3 p-2.5 rounded bg-red-900/30 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Reason: {selectedBundle.qualityHoldReason || "Quality Inspection Hold"}. Scans and completions are blocked until released.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Operation & Operator Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Production Operation
                    </label>
                    <Select
                      value={selectedOperationId}
                      onChange={(e) => setSelectedOperationId(e.target.value)}
                      className="bg-slate-950/80 border-slate-700 text-white h-10"
                    >
                      <option value="">Select Operation...</option>
                      {selectedOrder?.operations?.map((op) => (
                        <option key={op.id} value={op.id}>
                          Seq {op.sequence}: {op.operationName}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Operator / Station Context
                    </label>
                    <Select
                      value={selectedOperatorId}
                      onChange={(e) => setSelectedOperatorId(e.target.value)}
                      className="bg-slate-950/80 border-slate-700 text-white h-10"
                    >
                      <option value="">Select Operator...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.code})
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Quantity Reporting Split */}
                <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Good Production (pcs)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={goodQty}
                        onChange={(e) => handleGoodQtyChange(Number(e.target.value))}
                        className="h-12 text-xl font-bold font-mono bg-emerald-950/20 border-emerald-500/40 text-emerald-300 focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-rose-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        Defective Quantity (pcs)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={defectiveQty}
                        onChange={(e) => handleDefectiveQtyChange(Number(e.target.value))}
                        className="h-12 text-xl font-bold font-mono bg-rose-950/20 border-rose-500/40 text-rose-300 focus:border-rose-400"
                      />
                    </div>
                  </div>

                  {/* Defect Details (Conditional if defectiveQty > 0) */}
                  {defectiveQty > 0 && (
                    <div className="p-3.5 rounded bg-rose-950/20 border border-rose-500/30 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-rose-300 mb-1">
                          Defect Reason Code
                        </label>
                        <Select
                          value={defectCode}
                          onChange={(e) => setDefectCode(e.target.value)}
                          className="bg-slate-900 border-rose-500/40 text-white h-9 text-xs"
                        >
                          {DEFECT_CODES.map((d) => (
                            <option key={d.code} value={d.code}>
                              {d.code} - {d.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-rose-300 mb-1">
                          Defect Remarks / Rework Instructions
                        </label>
                        <Input
                          type="text"
                          placeholder="e.g. Broken seam on left sleeve, marked for repair..."
                          value={defectRemarks}
                          onChange={(e) => setDefectRemarks(e.target.value)}
                          className="bg-slate-900 border-rose-500/40 text-white text-xs h-9"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Validation Error Message */}
                {validationError && (
                  <div className="p-3 rounded-lg bg-rose-900/30 border border-rose-500/50 text-xs font-medium text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                {/* Tablet-Sized Action Buttons */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={
                      !selectedBundle ||
                      selectedBundle.isQualityHold ||
                      !selectedOperationId ||
                      recordOutputMutation.isPending
                    }
                    className="w-full h-14 text-base font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/30 transition-all gap-2"
                  >
                    <CheckCheck className="w-5 h-5" />
                    {recordOutputMutation.isPending ? "Committing Output..." : "Record & Confirm Production Output"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: RECENT PRODUCTION EVENTS AUDIT (5 COLS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-slate-800 bg-slate-900/90 shadow-xl backdrop-blur">
            <CardHeader className="border-b border-slate-800/80 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Live Output Stream
              </CardTitle>
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                {recentOutputs.length} events logged
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {isOutputsLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading output stream...</div>
              ) : recentOutputs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No production output events recorded yet. Complete your first bundle above.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 max-h-[580px] overflow-y-auto">
                  {recentOutputs.map((item) => (
                    <div key={item.id} className="p-3.5 hover:bg-slate-800/40 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-white">
                          {item.bundle?.barcode || `Order ${item.productionOrder?.orderNumber}`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 truncate max-w-[180px]">
                          Op: {item.operation?.operationName || "Operation"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-400">+{item.goodQuantity} good</span>
                          {item.defectiveQuantity > 0 && (
                            <span className="font-bold text-rose-400">({item.defectiveQuantity} def)</span>
                          )}
                        </div>
                      </div>
                      {item.operator && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          By: {item.operator.name}
                        </div>
                      )}
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
