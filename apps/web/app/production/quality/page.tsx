"use client";

import React, { useState, useRef, useEffect } from "react";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Dialog } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useToast } from "../../../components/ui/toast";
import {
  useQualityInspections,
  useCreateQualityInspection,
  useApplyQualityHold,
  useReleaseQualityHold,
  useQualityDefectStats,
} from "../../../hooks/use-quality";
import { useBundles } from "../../../hooks/use-bundles";
import { useProductionOrders } from "../../../hooks/use-production";
import { useEmployees, useMachines } from "../../../hooks/use-master-data";
import {
  QualityInspection,
  Bundle,
  InspectionResult,
  DefectSeverity,
  RecordDefectItemInput,
} from "../../../lib/api/types";
import {
  ClipboardCheck,
  AlertOctagon,
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Layers,
  BarChart3,
  History,
  QrCode,
  Tag,
  Boxes,
} from "lucide-react";

const DEFECT_CODES = [
  { code: "STITCH_DROP", label: "Drop Stitch / Skipped Stitch" },
  { code: "SEAM_PUCKERING", label: "Seam Puckering" },
  { code: "FABRIC_HOLE", label: "Fabric Hole / Tear" },
  { code: "SHADE_VARIATION", label: "Color Shade Variation" },
  { code: "OIL_STAIN", label: "Oil / Dirt Stain" },
  { code: "MEASUREMENT_TOLERANCE", label: "Out of Tolerance" },
  { code: "BROKEN_STITCH", label: "Broken Stitch / Needle Cut" },
  { code: "BUTTON_MISALIGN", label: "Button / Snap Misalignment" },
  { code: "RAW_EDGE", label: "Raw Edge / Open Seam" },
  { code: "OTHER", label: "Other Defect" },
];

export default function QualityInspectionPage() {
  const toast = useToast();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Active Tab: 'terminal' | 'holds' | 'history' | 'pareto'
  const [activeTab, setActiveTab] = useState<"terminal" | "holds" | "history" | "pareto">("terminal");

  // Data queries
  const { data: inspections = [], isLoading: isInspectionsLoading } = useQualityInspections({ limit: 50 });
  const { data: bundles = [], isLoading: isBundlesLoading } = useBundles();
  const { data: productionOrders = [] } = useProductionOrders();
  const { data: employees = [] } = useEmployees();
  const { data: machines = [] } = useMachines();
  const { data: stats } = useQualityDefectStats();

  // Mutations
  const createInspectionMutation = useCreateQualityInspection();
  const applyHoldMutation = useApplyQualityHold();
  const releaseHoldMutation = useReleaseQualityHold();

  // Terminal Form State
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [selectedInspectorId, setSelectedInspectorId] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [inspectionResult, setInspectionResult] = useState<InspectionResult>("PASS");
  const [inspectedQty, setInspectedQty] = useState<number>(0);
  const [passedQty, setPassedQty] = useState<number>(0);
  const [rejectedQty, setRejectedQty] = useState<number>(0);
  const [defects, setDefects] = useState<RecordDefectItemInput[]>([]);
  const [notes, setNotes] = useState("");
  const [autoHoldOnFail, setAutoHoldOnFail] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Manual Hold Dialog State
  const [isManualHoldDialogOpen, setIsManualHoldDialogOpen] = useState(false);
  const [manualHoldBundleId, setManualHoldBundleId] = useState("");
  const [manualHoldReason, setManualHoldReason] = useState("");

  // Release Hold Dialog State
  const [isReleaseDialogOpen, setIsReleaseDialogOpen] = useState(false);
  const [releaseBundle, setReleaseBundle] = useState<Bundle | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");

  // Auto-select first QC inspector if available
  useEffect(() => {
    if (employees.length > 0 && !selectedInspectorId) {
      const qcEmployee = employees.find((e) => e.type === "QC") || employees[0];
      setSelectedInspectorId(qcEmployee.id);
    }
  }, [employees, selectedInspectorId]);

  // Lookup bundle when barcode changes
  const handleBarcodeSearch = (barcodeToFind?: string) => {
    const code = (barcodeToFind || scannedBarcode).trim();
    if (!code) return;

    const found = bundles.find((b) => b.barcode.toLowerCase() === code.toLowerCase());
    if (found) {
      setSelectedBundle(found);
      setSelectedOperationId(found.currentOperationId || "");
      const bundleQty = Number(found.quantity);
      setInspectedQty(bundleQty);
      setPassedQty(bundleQty);
      setRejectedQty(0);
      setInspectionResult("PASS");
      setDefects([]);
      setFormError(null);
    } else {
      setSelectedBundle(null);
      setFormError(`Bundle with barcode "${code}" was not found.`);
    }
  };

  // When result switches, rebalance defaults
  const handleResultChange = (res: InspectionResult) => {
    setInspectionResult(res);
    if (res === "PASS") {
      setPassedQty(inspectedQty);
      setRejectedQty(0);
      setDefects([]);
    } else {
      setPassedQty(0);
      setRejectedQty(inspectedQty);
      if (defects.length === 0) {
        setDefects([
          {
            defectCode: "STITCH_DROP",
            severity: "MAJOR",
            quantity: inspectedQty,
            notes: "",
          },
        ]);
      }
    }
  };

  // Add a defect row
  const handleAddDefect = () => {
    setDefects([
      ...defects,
      {
        defectCode: "STITCH_DROP",
        severity: "MAJOR",
        quantity: 1,
        notes: "",
      },
    ]);
  };

  // Remove a defect row
  const handleRemoveDefect = (index: number) => {
    setDefects(defects.filter((_, i) => i !== index));
  };

  // Update defect field
  const handleUpdateDefect = (
    index: number,
    field: keyof RecordDefectItemInput,
    value: any
  ) => {
    const updated = [...defects];
    updated[index] = { ...updated[index], [field]: value };
    setDefects(updated);
  };

  // Handle Inspection Submit
  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedBundle) {
      setFormError("Please enter or scan a valid bundle barcode ticket.");
      return;
    }

    if (!selectedOperationId) {
      setFormError("Please select the manufacturing operation being inspected.");
      return;
    }

    if (!selectedInspectorId) {
      setFormError("Please select an authorized QC inspector.");
      return;
    }

    if (inspectedQty <= 0) {
      setFormError("Inspected quantity must be greater than 0.");
      return;
    }

    if (inspectedQty > Number(selectedBundle.quantity)) {
      setFormError(`Inspected quantity cannot exceed bundle quantity (${selectedBundle.quantity} pcs).`);
      return;
    }

    if (passedQty + rejectedQty !== inspectedQty) {
      setFormError(
        `Quantity balance error: Passed (${passedQty}) + Rejected (${rejectedQty}) does not equal Inspected (${inspectedQty}).`
      );
      return;
    }

    if (inspectionResult === "FAIL") {
      if (rejectedQty <= 0) {
        setFormError("Failed inspection must record at least 1 rejected item.");
        return;
      }
      const totalDefectItems = defects.reduce((sum, d) => sum + Number(d.quantity), 0);
      if (totalDefectItems > rejectedQty) {
        setFormError(`Sum of defect item quantities (${totalDefectItems}) exceeds rejected quantity (${rejectedQty}).`);
        return;
      }
    }

    const idempotencyKey = `insp-${selectedBundle.id}-${Date.now()}`;

    try {
      await createInspectionMutation.mutateAsync({
        data: {
          bundleId: selectedBundle.id,
          operationId: selectedOperationId,
          inspectorId: selectedInspectorId,
          machineId: selectedMachineId || undefined,
          result: inspectionResult,
          inspectedQty,
          passedQty,
          rejectedQty,
          notes: notes.trim() || undefined,
          autoHoldOnFail,
          defects: inspectionResult === "FAIL" ? defects : undefined,
        },
        idempotencyKey,
      });

      toast.success(
        inspectionResult === "PASS"
          ? `Inspection PASSED: Bundle ${selectedBundle.barcode} approved (${passedQty} pcs).`
          : `Inspection FAILED: Bundle ${selectedBundle.barcode} marked with defects (${rejectedQty} rejected).`
      );

      // Reset form
      setScannedBarcode("");
      setSelectedBundle(null);
      setNotes("");
      setDefects([]);
      barcodeInputRef.current?.focus();
    } catch (err: any) {
      setFormError(err.message || "Failed to record inspection");
      toast.error(err.message || "Failed to record inspection");
    }
  };

  // Handle Manual Quality Hold
  const handleOpenManualHold = (bundleId?: string) => {
    setManualHoldBundleId(bundleId || "");
    setManualHoldReason("");
    setIsManualHoldDialogOpen(true);
  };

  const handleSubmitManualHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualHoldBundleId || !manualHoldReason.trim()) {
      toast.error("Please specify both bundle and hold reason.");
      return;
    }

    try {
      const idempotencyKey = `hold-${manualHoldBundleId}-${Date.now()}`;
      await applyHoldMutation.mutateAsync({
        bundleId: manualHoldBundleId,
        data: { reason: manualHoldReason.trim() },
        idempotencyKey,
      });

      toast.success("Bundle placed on Quality Hold. Workstation scanning blocked.");
      setIsManualHoldDialogOpen(false);
      setManualHoldReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to apply Quality Hold");
    }
  };

  // Handle Release Hold
  const handleOpenReleaseDialog = (bundle: Bundle) => {
    setReleaseBundle(bundle);
    setReleaseNotes("");
    setIsReleaseDialogOpen(true);
  };

  const handleSubmitReleaseHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseBundle || !releaseNotes.trim()) {
      toast.error("Please enter resolution notes explaining why this hold is released.");
      return;
    }

    try {
      const idempotencyKey = `rel-${releaseBundle.id}-${Date.now()}`;
      await releaseHoldMutation.mutateAsync({
        bundleId: releaseBundle.id,
        data: { resolutionNotes: releaseNotes.trim() },
        idempotencyKey,
      });

      toast.success(`Quality Hold released for bundle ${releaseBundle.barcode}. Normal flow restored.`);
      setIsReleaseDialogOpen(false);
      setReleaseBundle(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to release Quality Hold");
    }
  };

  // Filter bundles on hold
  const bundlesOnHold = bundles.filter((b) => b.isQualityHold);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Inline Quality Inspection & MES Audits"
        description="Shop-floor bundle audits, inline defect logging, first-pass yield analytics, and server-enforced bundle quality holds."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenManualHold()}
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1.5"
            >
              <Lock className="w-4 h-4" />
              Apply Quality Hold
            </Button>
            <Button
              variant={activeTab === "terminal" ? "primary" : "outline"}
              size="sm"
              onClick={() => setActiveTab("terminal")}
              className="gap-1.5"
            >
              <ClipboardCheck className="w-4 h-4" />
              Inspection Terminal
            </Button>
          </div>
        }
      />

      {/* KPI Command Center */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Total Inspections</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {stats?.totalInspections ?? inspections.length}
              </h3>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Total Inspected Pcs</p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {stats?.totalInspected ?? 0}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Boxes className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Accepted Pieces</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-2xl font-bold text-emerald-400">
                  {stats?.totalPassed ?? 0}
                </h3>
                <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  {stats?.passRate ?? 100}%
                </span>
              </div>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Defects / Rejects</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-2xl font-bold text-rose-400">
                  {stats?.totalRejected ?? 0}
                </h3>
                <span className="text-xs font-semibold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">
                  {stats?.rejectionRate ?? 0}%
                </span>
              </div>
            </div>
            <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Active Quality Holds</p>
              <div className="flex items-center gap-2 mt-1">
                <h3 className="text-2xl font-bold text-amber-400">
                  {bundlesOnHold.length}
                </h3>
                {bundlesOnHold.length > 0 && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                )}
              </div>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab("terminal")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "terminal"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Inspection Terminal
        </button>
        <button
          onClick={() => setActiveTab("holds")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "holds"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Lock className="w-4 h-4" />
          Active Holds ({bundlesOnHold.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "history"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <History className="w-4 h-4" />
          Inspection History ({inspections.length})
        </button>
        <button
          onClick={() => setActiveTab("pareto")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "pareto"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Defect Pareto Analytics
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: INLINE INSPECTION TERMINAL */}
      {/* ========================================================================= */}
      {activeTab === "terminal" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Inspection Form (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-white">
                  <ClipboardCheck className="w-5 h-5 text-blue-400" />
                  Inline Bundle Quality Audit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitInspection} className="space-y-6">
                  {/* Barcode Search Bar */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Scan or Enter Bundle Barcode
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <QrCode className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                        <Input
                          ref={barcodeInputRef}
                          placeholder="e.g. BNDL-..."
                          value={scannedBarcode}
                          onChange={(e) => setScannedBarcode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleBarcodeSearch();
                            }
                          }}
                          className="pl-9 font-mono uppercase bg-slate-950/70 border-slate-700"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleBarcodeSearch()}
                        className="gap-1.5"
                      >
                        <Search className="w-4 h-4" />
                        Lookup
                      </Button>
                    </div>
                  </div>

                  {/* Bundle Context Card */}
                  {selectedBundle && (
                    <div
                      className={`p-4 rounded-xl border ${
                        selectedBundle.isQualityHold
                          ? "bg-amber-950/20 border-amber-500/40"
                          : "bg-slate-950/60 border-slate-800"
                      } space-y-3`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-blue-400" />
                          <span className="font-mono font-bold text-white text-base">
                            {selectedBundle.barcode}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedBundle.isQualityHold && (
                            <Badge variant="warning" className="gap-1 bg-amber-500/20 text-amber-400 border-amber-500/40">
                              <Lock className="w-3 h-3" />
                              QUALITY HOLD
                            </Badge>
                          )}
                          <Badge variant="outline">{selectedBundle.status}</Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs">
                        <div>
                          <span className="text-slate-500 block">Production Order:</span>
                          <span className="font-medium text-slate-200">
                            {selectedBundle.productionOrder?.orderNumber || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Current Op:</span>
                          <span className="font-medium text-slate-200">
                            {selectedBundle.currentOperation?.operationName || "None"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Bundle Qty:</span>
                          <span className="font-bold text-emerald-400 text-sm">
                            {selectedBundle.quantity} pcs
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Bundle Seq:</span>
                          <span className="font-medium text-slate-200">
                            #{selectedBundle.bundleSequence ?? 1}
                          </span>
                        </div>
                      </div>

                      {selectedBundle.isQualityHold && (
                        <div className="p-2.5 bg-amber-500/10 rounded-lg border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Quality Hold Notice: </span>
                            {selectedBundle.qualityHoldReason || "No hold remarks specified"}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Station & Inspector Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        QC Inspector / Auditor *
                      </label>
                      <Select
                        value={selectedInspectorId}
                        onChange={(e) => setSelectedInspectorId(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-white"
                      >
                        <option value="">Select Inspector...</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.code} - {emp.name} ({emp.type})
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                        Operation Context *
                      </label>
                      <Select
                        value={selectedOperationId}
                        onChange={(e) => setSelectedOperationId(e.target.value)}
                        className="bg-slate-950 border-slate-700 text-white"
                      >
                        <option value="">Select Operation...</option>
                        {selectedBundle?.productionOrder?.operations?.map((op) => (
                          <option key={op.id} value={op.id}>
                            Seq {op.sequence}: {op.operationName}
                          </option>
                        )) ||
                          productionOrders
                            .flatMap((o) => o.operations || [])
                            .map((op) => (
                              <option key={op.id} value={op.id}>
                                {op.operationName}
                              </option>
                            ))}
                      </Select>
                    </div>
                  </div>

                  {/* Result Toggle Cards */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Inspection Outcome *
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => handleResultChange("PASS")}
                        className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                          inspectionResult === "PASS"
                            ? "bg-emerald-950/40 border-emerald-500/80 text-emerald-300 shadow-lg shadow-emerald-950/50"
                            : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2
                            className={`w-6 h-6 ${
                              inspectionResult === "PASS" ? "text-emerald-400" : "text-slate-500"
                            }`}
                          />
                          <div>
                            <div className="font-bold text-sm">PASS</div>
                            <div className="text-xs text-slate-500">100% Acceptable Quality</div>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResultChange("FAIL")}
                        className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                          inspectionResult === "FAIL"
                            ? "bg-rose-950/40 border-rose-500/80 text-rose-300 shadow-lg shadow-rose-950/50"
                            : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <XCircle
                            className={`w-6 h-6 ${
                              inspectionResult === "FAIL" ? "text-rose-400" : "text-slate-500"
                            }`}
                          />
                          <div>
                            <div className="font-bold text-sm">FAIL / REJECT</div>
                            <div className="text-xs text-slate-500">Defects Logged</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Quantity Counting Inputs */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Piece Quantities
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Inspected Qty</label>
                        <Input
                          type="number"
                          min={1}
                          value={inspectedQty || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setInspectedQty(val);
                            if (inspectionResult === "PASS") {
                              setPassedQty(val);
                              setRejectedQty(0);
                            }
                          }}
                          className="bg-slate-900 border-slate-700 text-white font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Accepted Qty</label>
                        <Input
                          type="number"
                          min={0}
                          value={passedQty}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPassedQty(val);
                            setRejectedQty(Math.max(0, inspectedQty - val));
                          }}
                          className="bg-slate-900 border-slate-700 text-emerald-400 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Rejected Qty</label>
                        <Input
                          type="number"
                          min={0}
                          value={rejectedQty}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setRejectedQty(val);
                            setPassedQty(Math.max(0, inspectedQty - val));
                          }}
                          className="bg-slate-900 border-slate-700 text-rose-400 font-bold"
                        />
                      </div>
                    </div>

                    {/* Balance Check */}
                    <div className="text-xs flex items-center justify-between pt-1">
                      <span className="text-slate-500">
                        Balance: {passedQty} passed + {rejectedQty} rejected ={" "}
                        <span
                          className={
                            passedQty + rejectedQty === inspectedQty
                              ? "text-emerald-400 font-semibold"
                              : "text-rose-400 font-bold"
                          }
                        >
                          {passedQty + rejectedQty}
                        </span>{" "}
                        / {inspectedQty}
                      </span>
                      {passedQty + rejectedQty !== inspectedQty && (
                        <span className="text-rose-400 font-medium">Sum mismatch!</span>
                      )}
                    </div>
                  </div>

                  {/* Defect Item Logger (Active when FAIL) */}
                  {inspectionResult === "FAIL" && (
                    <div className="space-y-3 p-4 bg-rose-950/20 rounded-xl border border-rose-500/30">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          Defect Classification & Severity
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddDefect}
                          className="text-xs h-7 border-rose-500/40 text-rose-300 hover:bg-rose-500/10 gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Defect
                        </Button>
                      </div>

                      {defects.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          No defect items logged. Please add at least one defect reason.
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {defects.map((def, idx) => (
                            <div
                              key={idx}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 items-center text-xs"
                            >
                              <div className="sm:col-span-5">
                                <Select
                                  value={def.defectCode}
                                  onChange={(e) =>
                                    handleUpdateDefect(idx, "defectCode", e.target.value)
                                  }
                                  className="bg-slate-900 border-slate-700 text-white text-xs h-8"
                                >
                                  {DEFECT_CODES.map((dc) => (
                                    <option key={dc.code} value={dc.code}>
                                      {dc.label}
                                    </option>
                                  ))}
                                </Select>
                              </div>

                              <div className="sm:col-span-3">
                                <Select
                                  value={def.severity}
                                  onChange={(e) =>
                                    handleUpdateDefect(idx, "severity", e.target.value)
                                  }
                                  className="bg-slate-900 border-slate-700 text-white text-xs h-8"
                                >
                                  <option value="MINOR">MINOR</option>
                                  <option value="MAJOR">MAJOR</option>
                                  <option value="CRITICAL">CRITICAL</option>
                                </Select>
                              </div>

                              <div className="sm:col-span-3">
                                <Input
                                  type="number"
                                  min={1}
                                  value={def.quantity}
                                  onChange={(e) =>
                                    handleUpdateDefect(idx, "quantity", Number(e.target.value))
                                  }
                                  placeholder="Qty"
                                  className="bg-slate-900 border-slate-700 text-white text-xs h-8"
                                />
                              </div>

                              <div className="sm:col-span-1 flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveDefect(idx)}
                                  className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="autoHold"
                          checked={autoHoldOnFail}
                          onChange={(e) => setAutoHoldOnFail(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="autoHold" className="text-xs text-slate-300 select-none cursor-pointer">
                          Automatically apply server-side Quality Hold to this bundle
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Notes / Remarks */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Auditor Remarks / Notes
                    </label>
                    <Input
                      placeholder="e.g. Visual check passed, needle tension adjusted at sewing station 4"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="bg-slate-950 border-slate-700 text-white text-sm"
                    />
                  </div>

                  {/* Form Error Message */}
                  {formError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    variant={inspectionResult === "PASS" ? "primary" : "danger"}
                    disabled={createInspectionMutation.isPending}
                    className="w-full font-semibold py-2.5 text-base gap-2"
                  >
                    {createInspectionMutation.isPending ? (
                      "Recording Inspection..."
                    ) : (
                      <>
                        <ClipboardCheck className="w-5 h-5" />
                        Submit Quality Inspection ({inspectionResult})
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar: Quick Lookups & Recent Station Feed */}
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-400" />
                  Recent Station Audits
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {inspections.slice(0, 5).map((insp) => (
                  <div
                    key={insp.id}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white">
                        {insp.bundle?.barcode || insp.bundleId.slice(0, 8)}
                      </span>
                      <Badge
                        variant={insp.result === "PASS" ? "success" : "danger"}
                        className="text-[10px] px-1.5 py-0.5"
                      >
                        {insp.result}
                      </Badge>
                    </div>
                    <div className="text-slate-400 flex items-center justify-between text-[11px]">
                      <span>{insp.operation?.operationName || "Operation"}</span>
                      <span>{insp.inspectedQty} pcs</span>
                    </div>
                    {insp.defects && insp.defects.length > 0 && (
                      <div className="text-rose-400 text-[10px] pt-1 border-t border-slate-800">
                        {insp.defects.length} defect(s) logged:{" "}
                        {insp.defects.map((d) => d.defectCode).join(", ")}
                      </div>
                    )}
                  </div>
                ))}

                {inspections.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No inspections recorded yet today.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Quality Safeguard Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-2.5">
                <p>
                  • <strong className="text-slate-200">Server Enforcement:</strong> Bundles on Quality Hold cannot be scanned down the line until formally resolved.
                </p>
                <p>
                  • <strong className="text-slate-200">Traceability:</strong> Every audit is recorded immutably with timestamp, QC inspector, workstation, and piece counts.
                </p>
                <p>
                  • <strong className="text-slate-200">Defect Rejection:</strong> Rejected pieces automatically increment operation defective scrap and adjust bundle capacity.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ACTIVE QUALITY HOLDS */}
      {/* ========================================================================= */}
      {activeTab === "holds" && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Active Bundle Quality Holds
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenManualHold()}
              className="text-xs gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
            >
              <Plus className="w-3.5 h-3.5" />
              Apply Manual Hold
            </Button>
          </CardHeader>
          <CardContent>
            {bundlesOnHold.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-400/60 mx-auto mb-3" />
                <h4 className="text-base font-semibold text-white">No Bundles on Quality Hold</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  All active bundles are cleared and moving through production operations without stoppage.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Bundle Barcode</th>
                      <th className="p-3">Order</th>
                      <th className="p-3">Current Operation</th>
                      <th className="p-3">Quantity</th>
                      <th className="p-3">Hold Reason</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {bundlesOnHold.map((bundle) => (
                      <tr key={bundle.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-bold text-amber-400">
                          {bundle.barcode}
                        </td>
                        <td className="p-3 text-slate-300">
                          {bundle.productionOrder?.orderNumber || "Order"}
                        </td>
                        <td className="p-3 text-slate-300">
                          {bundle.currentOperation?.operationName || "Not assigned"}
                        </td>
                        <td className="p-3 font-semibold text-white">
                          {bundle.quantity} pcs
                        </td>
                        <td className="p-3 text-amber-300 max-w-xs truncate">
                          {bundle.qualityHoldReason || "Quality Inspection Hold"}
                        </td>
                        <td className="p-3">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenReleaseDialog(bundle)}
                            className="h-7 text-xs gap-1 bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            Release Hold
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INSPECTION HISTORY TABLE */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-base text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              Complete Inspection Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inspections.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No quality inspection logs found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Date / Time</th>
                      <th className="p-3">Barcode</th>
                      <th className="p-3">Operation</th>
                      <th className="p-3">Inspector</th>
                      <th className="p-3">Result</th>
                      <th className="p-3">Inspected</th>
                      <th className="p-3">Passed</th>
                      <th className="p-3">Rejected</th>
                      <th className="p-3">Defects</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {inspections.map((insp) => (
                      <tr key={insp.id} className="hover:bg-slate-800/30">
                        <td className="p-3 text-slate-400">
                          {new Date(insp.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 font-mono font-bold text-white">
                          {insp.bundle?.barcode || insp.bundleId.slice(0, 8)}
                        </td>
                        <td className="p-3 text-slate-300">
                          {insp.operation?.operationName || "Operation"}
                        </td>
                        <td className="p-3 text-slate-300">
                          {insp.inspector?.name || insp.inspector?.code || "QC"}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={insp.result === "PASS" ? "success" : "danger"}
                            className="text-[11px] font-semibold"
                          >
                            {insp.result}
                          </Badge>
                        </td>
                        <td className="p-3 font-bold text-white">{insp.inspectedQty}</td>
                        <td className="p-3 font-bold text-emerald-400">{insp.passedQty}</td>
                        <td className="p-3 font-bold text-rose-400">{insp.rejectedQty}</td>
                        <td className="p-3">
                          {insp.defects && insp.defects.length > 0 ? (
                            <span className="text-rose-400 font-medium">
                              {insp.defects.map((d) => d.defectCode).join(", ")}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DEFECT PARETO ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === "pareto" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                Defect Breakdown by Reason
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!stats?.defectBreakdown || stats.defectBreakdown.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No defect items logged yet. Record inspections with defects to populate Pareto distribution.
                </div>
              ) : (
                <div className="space-y-4">
                  {stats.defectBreakdown.map((item, idx) => {
                    const pct =
                      stats.totalRejected > 0
                        ? Math.round((item.totalQty / stats.totalRejected) * 100)
                        : 0;
                    return (
                      <div key={idx} className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="font-semibold">{item.code}</span>
                          <span className="text-slate-400 font-mono">
                            {item.totalQty} pcs ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader>
              <CardTitle className="text-base text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Quality Performance Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400">First-Pass Yield (Pass Rate)</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {stats?.passRate ?? 100}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400">Total Defect Scrap Quantity</span>
                <span className="text-rose-400 font-bold text-sm">
                  {stats?.totalRejected ?? 0} pcs
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400">Total Approved Production</span>
                <span className="text-white font-bold text-sm">
                  {stats?.totalPassed ?? 0} pcs
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="text-slate-400">Total Audited Batches</span>
                <span className="text-indigo-400 font-bold text-sm">
                  {stats?.totalInspections ?? 0} inspections
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIALOG 1: APPLY MANUAL QUALITY HOLD */}
      {/* ========================================================================= */}
      <Dialog
        isOpen={isManualHoldDialogOpen}
        onClose={() => setIsManualHoldDialogOpen(false)}
        title="Apply Bundle Quality Hold"
        description="Applying a quality hold blocks shop-floor terminal operators from scanning or advancing this bundle."
      >
        <form onSubmit={handleSubmitManualHold} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Target Bundle *
            </label>
            <Select
              value={manualHoldBundleId}
              onChange={(e) => setManualHoldBundleId(e.target.value)}
              className="border-slate-300 text-slate-900"
            >
              <option value="">Select a bundle to hold...</option>
              {bundles
                .filter((b) => !b.isQualityHold)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.barcode} - {b.productionOrder?.orderNumber || "Order"} ({b.quantity} pcs)
                  </option>
                ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Hold Reason / Root Cause *
            </label>
            <Input
              placeholder="e.g. Critical fabric defect detected; awaiting QA manager disposition"
              value={manualHoldReason}
              onChange={(e) => setManualHoldReason(e.target.value)}
              className="border-slate-300 text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsManualHoldDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={applyHoldMutation.isPending}
              className="gap-1.5"
            >
              <Lock className="w-4 h-4" />
              {applyHoldMutation.isPending ? "Applying Hold..." : "Apply Quality Hold"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 2: RELEASE QUALITY HOLD */}
      {/* ========================================================================= */}
      <Dialog
        isOpen={isReleaseDialogOpen}
        onClose={() => setIsReleaseDialogOpen(false)}
        title="Release Bundle Quality Hold"
        description={`Releasing this hold restores normal shop-floor scanning for bundle ${releaseBundle?.barcode || ""}.`}
      >
        <form onSubmit={handleSubmitReleaseHold} className="space-y-4">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <span className="font-semibold block mb-1">Current Hold Reason:</span>
            {releaseBundle?.qualityHoldReason || "No hold remarks specified"}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
              Resolution Notes / Sign-Off *
            </label>
            <Input
              placeholder="e.g. Workstation operator re-stitched seam; passed second inspection"
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              className="border-slate-300 text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsReleaseDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={releaseHoldMutation.isPending}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Unlock className="w-4 h-4" />
              {releaseHoldMutation.isPending ? "Releasing..." : "Release Quality Hold"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
