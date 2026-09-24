"use client";

import React, { useState } from "react";
import { usePermissions } from "../../../hooks/use-permissions";
import { useAuth } from "../../../lib/auth/auth-context";
import {
  useFabricRolls,
  useCreateFabricRoll,
  useInspectFabricRoll,
  useUpdateRollStatus,
} from "../../../hooks/use-fabric-rolls";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api/client";
import { PageHeader } from "../../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../../components/tables/data-table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { useToast } from "../../../components/ui/toast";
import { ForbiddenState } from "../../../components/feedback/forbidden-state";
import {
  Layers,
  Plus,
  Barcode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Lock,
  Scissors,
  HelpCircle,
} from "lucide-react";
import {
  FabricRoll,
  FabricRollInspection,
  Material,
  RollStatus,
  FabricGradingOption,
  Warehouse,
  Bin,
} from "../../../lib/api/types";

export default function FabricRollsPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [activeRoll, setActiveRoll] = useState<FabricRoll | null>(null);

  // Filter & Query
  const {
    data: rolls = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useFabricRolls(selectedStatus ? { status: selectedStatus } : undefined);

  // Master data for roll creation
  const { data: materials = [] } = useQuery({
    queryKey: ["materials-fabric"],
    queryFn: () => api.get<Material[]>("/materials?category=FABRIC"),
    enabled: isAuthenticated && createModalOpen,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get<Warehouse[]>("/warehouses"),
    enabled: isAuthenticated && createModalOpen,
  });

  // Create roll form state
  const [materialId, setMaterialId] = useState("");
  const [binId, setBinId] = useState("");
  const [dyeLot, setDyeLot] = useState("");
  const [shade, setShade] = useState("");
  const [grossLength, setGrossLength] = useState("100");
  const [cuttableWidth, setCuttableWidth] = useState("58");
  const [gsm, setGsm] = useState("180");
  const [shrinkageLength, setShrinkageLength] = useState("2.5");
  const [shrinkageWidth, setShrinkageWidth] = useState("1.8");

  // ASTM D5430 Inspection Form State
  const [gradingOption, setGradingOption] = useState<FabricGradingOption>(
    FabricGradingOption.OPTION_A_STANDARD
  );
  const [unitSystem, setUnitSystem] = useState<"IMPERIAL" | "METRIC">("IMPERIAL");
  const [inspectedLength, setInspectedLength] = useState("100");
  const [inspectedWidth, setInspectedWidth] = useState("58");
  const [defects1Pt, setDefects1Pt] = useState("2");
  const [defects2Pt, setDefects2Pt] = useState("1");
  const [defects3Pt, setDefects3Pt] = useState("0");
  const [defects4Pt, setDefects4Pt] = useState("0");
  const [thresholdPoints, setThresholdPoints] = useState("20");
  const [inspectionNotes, setInspectionNotes] = useState("");

  const createRollMutation = useCreateFabricRoll();
  const inspectRollMutation = useInspectFabricRoll();
  const updateStatusMutation = useUpdateRollStatus();

  // Real-time ASTM D5430 Client preview
  const previewCalculation = () => {
    const p1 = Number(defects1Pt) || 0;
    const p2 = Number(defects2Pt) || 0;
    const p3 = Number(defects3Pt) || 0;
    const p4 = Number(defects4Pt) || 0;
    const totalPoints = p1 * 1 + p2 * 2 + p3 * 3 + p4 * 4;

    const len = Number(inspectedLength) || 1;
    const wid = Number(inspectedWidth) || 1;
    const thresh = Number(thresholdPoints) || 20;

    let pointsPer100Yd = 0;
    let pointsPer100M = 0;

    if (unitSystem === "IMPERIAL") {
      // canonical formula: (points * 3600) / (length_yds * width_inches)
      pointsPer100Yd = (totalPoints * 3600) / (len * wid);
      // Metric equivalent:
      const lenM = len * 0.9144;
      const widCm = wid * 2.54;
      pointsPer100M = (totalPoints * 10000) / (lenM * widCm);
    } else {
      // Metric inputs: length in meters, width in cm
      pointsPer100M = (totalPoints * 10000) / (len * wid);
      const lenYds = len * 1.093613;
      const widIn = wid / 2.54;
      pointsPer100Yd = (totalPoints * 3600) / (lenYds * widIn);
    }

    const passed = pointsPer100Yd <= thresh;
    return {
      totalPoints,
      pointsPer100Yd: Number(pointsPer100Yd.toFixed(2)),
      pointsPer100M: Number(pointsPer100M.toFixed(2)),
      passed,
    };
  };

  const preview = previewCalculation();

  const handleCreateRoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialId || !grossLength) {
      toast.error("Validation Error", "Material and Gross Length are required.");
      return;
    }

    createRollMutation.mutate(
      {
        rollNumber: `ROL-${Date.now().toString().slice(-6)}`,
        materialId,
        warehouseId: warehouses[0]?.id || "",
        binId: binId || undefined,
        lotNumber: dyeLot || "LOT-DEFAULT",
        dyeLot: dyeLot || undefined,
        shade: shade || undefined,
        grossLength: Number(grossLength),
        netLength: Number(grossLength),
        width: cuttableWidth ? Number(cuttableWidth) : 58,
        cuttableWidth: cuttableWidth ? Number(cuttableWidth) : undefined,
        gsm: gsm ? Number(gsm) : undefined,
        shrinkagePercent: shrinkageLength ? Number(shrinkageLength) : undefined,
      },
      {
        onSuccess: (roll) => {
          toast.success("Fabric Roll Created", `Roll registered with barcode ${roll.barcode || roll.rollNumber}`);
          setCreateModalOpen(false);
          setDyeLot("");
          setShade("");
        },
        onError: (err: any) => {
          toast.error("Creation Failed", err?.message || "Failed to register fabric roll.");
        },
      }
    );
  };

  const handleInspectRoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoll) return;

    const defects: Array<{ defectType: string; lengthOrSize: number; sizeUom: string; penaltyPoints: number }> = [
      ...Array(Number(defects1Pt) || 0).fill({ defectType: "SLUB_OR_FLY", lengthOrSize: 2, sizeUom: unitSystem === "IMPERIAL" ? "INCH" : "CM", penaltyPoints: 1 }),
      ...Array(Number(defects2Pt) || 0).fill({ defectType: "WEFT_BAR", lengthOrSize: 5, sizeUom: unitSystem === "IMPERIAL" ? "INCH" : "CM", penaltyPoints: 2 }),
      ...Array(Number(defects3Pt) || 0).fill({ defectType: "DROP_STITCH", lengthOrSize: 8, sizeUom: unitSystem === "IMPERIAL" ? "INCH" : "CM", penaltyPoints: 3 }),
      ...Array(Number(defects4Pt) || 0).fill({ defectType: "HOLE_OR_TEAR", lengthOrSize: 10, sizeUom: unitSystem === "IMPERIAL" ? "INCH" : "CM", penaltyPoints: 4 }),
    ];

    inspectRollMutation.mutate(
      {
        id: activeRoll.id,
        data: {
          gradingOption,
          inspectedLength: Number(inspectedLength),
          lengthUom: unitSystem === "IMPERIAL" ? "YDS" : "M",
          inspectedWidth: Number(inspectedWidth),
          widthUom: unitSystem === "IMPERIAL" ? "INCH" : "CM",
          acceptanceThreshold: Number(thresholdPoints),
          notes: inspectionNotes || undefined,
          defects,
        },
      },
      {
        onSuccess: (data) => {
          const inspection = data.inspection;
          const resultText = inspection.result;
          const pts = inspection.pointsPer100SqYards ?? inspection.pointsPer100SqYd ?? 0;
          if (resultText === "PASS" || resultText === "PASSED") {
            toast.success(
              "Inspection Passed",
              `Grade: ${resultText} (${pts} pts/100 sq yds)`
            );
          } else {
            toast.error(
              "Inspection Failed",
              `Roll exceeded threshold: ${pts} pts/100 sq yds`
            );
          }
          setInspectModalOpen(false);
          setActiveRoll(null);
        },
        onError: (err: any) => {
          toast.error("Inspection Error", err?.message || "Failed to record roll inspection.");
        },
      }
    );
  };

  const columns: ColumnDef<FabricRoll>[] = [
    {
      header: "Roll Barcode",
      accessorKey: "barcode",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-indigo-50 text-indigo-600">
            <Barcode className="w-4 h-4" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-slate-900 block">
              {row.barcode}
            </span>
            <span className="text-[10px] text-slate-400">
              Lot: {row.dyeLot || "Standard"} | Shade: {row.shade || "Natural"}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Fabric Material",
      cell: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-900 block">
            {row.material?.code}
          </span>
          <span className="text-slate-500 text-[11px] truncate max-w-[160px] block">
            {row.material?.name}
          </span>
        </div>
      ),
    },
    {
      header: "Dimensions & Specs",
      cell: (row) => (
        <div className="text-xs font-mono">
          <span className="font-bold text-slate-800 block">
            {row.netLength} yds ({row.cuttableWidth || 58}&quot;)
          </span>
          <span className="text-[10px] text-slate-500">
            {row.gsm ? `${row.gsm} GSM` : "GSM: -"} | Shrink: {row.shrinkageLength || 0}%
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        let variant = "secondary";
        if (row.status === "AVAILABLE" || (row.status as string) === "INSPECTED_PASSED") variant = "success";
        if (row.status === "ON_HOLD" || (row.status as string) === "INSPECTED_FAILED" || (row.status as string) === "REJECTED") variant = "danger";
        if (row.status === "ALLOCATED" || (row.status as string) === "RESERVED") variant = "warning";
        if (row.status === "ISSUED" || (row.status as string) === "ISSUED_TO_CUTTING") variant = "info";

        return (
          <Badge variant={variant as any} size="sm">
            {row.status.replace(/_/g, " ")}
          </Badge>
        );
      },
    },
    {
      header: "Inspection Score",
      cell: (row) => {
        const latest = row.inspections?.[0];
        if (!latest) {
          return <span className="text-slate-400 text-xs italic">Not Inspected</span>;
        }
        return (
          <div className="text-xs">
            <span
              className={`font-mono font-bold block ${
                latest.result === "PASSED" || latest.result === "PASS" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {latest.pointsPer100SqYards ?? latest.pointsPer100SqYd} pts/100 yd²
            </span>
            <span className="text-[10px] text-slate-400">
              {latest.pointsPer100SqMeters ?? latest.pointsPer100SqM} pts/100 m²
            </span>
          </div>
        );
      },
    },
    {
      header: "Location",
      cell: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.bin?.code || "DEFAULT"}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveRoll(row);
              setDetailsModalOpen(true);
            }}
            className="h-7 text-xs"
          >
            Details
          </Button>
          {can("ROLL:WRITE") && row.status === "RECEIVED" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setActiveRoll(row);
                setInspectedLength(row.netLength.toString());
                setInspectedWidth((row.cuttableWidth || 58).toString());
                setInspectModalOpen(true);
              }}
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1"
            >
              <FileCheck2 className="w-3 h-3" />
              ASTM 4-Point
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!can("ROLL:READ")) {
    return (
      <ForbiddenState
        requiredPermission="ROLL:READ"
        moduleName="Fabric Roll Management & ASTM Inspection"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fabric Roll Inventory & ASTM D5430 Inspection"
        description="Discrete physical roll tracking, barcode genealogy, and visual fabric grading based on ASTM D5430 4-point method."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Materials & Warehouse", href: "/inventory" },
          { label: "Fabric Rolls" },
        ]}
        actions={
          can("ROLL:WRITE") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Register Fabric Roll
            </Button>
          )
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {["", "RECEIVED", "INSPECTED_PASSED", "INSPECTED_FAILED", "RESERVED", "ISSUED_TO_CUTTING"].map(
          (st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                selectedStatus === st
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {st ? st.replace(/_/g, " ") : "All Rolls"}
            </button>
          )
        )}
      </div>

      <DataTable
        title="Fabric Rolls Inventory"
        subtitle="Individual barcode-tracked fabric rolls with length, shade lot, and inspection scores"
        columns={columns}
        data={rolls}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as any)?.message}
        onRetry={refetch}
        searchKey="rollNumber"
        searchPlaceholder="Search by roll barcode..."
        emptyTitle="No Fabric Rolls Registered"
        emptyDescription="Post a GRN containing fabric or register individual rolls manually."
      />

      {/* ASTM D5430 Visual Fabric Inspection Dialog */}
      <Dialog
        isOpen={inspectModalOpen}
        onClose={() => {
          setInspectModalOpen(false);
          setActiveRoll(null);
        }}
        title="ASTM D5430 Visual Fabric Inspection (4-Point System)"
        description={`Roll Barcode: ${activeRoll?.barcode || ""} | Material: ${
          activeRoll?.material?.code || ""
        }`}
      >
        <form onSubmit={handleInspectRoll} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
          {/* Compliance & Standard Basis Banner */}
          <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-slate-800 space-y-1">
            <div className="flex items-center gap-2 font-bold text-blue-900">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Standard Basis: ASTM D5430 (Points per 100 sq yds)</span>
            </div>
            <p className="text-[11px] text-blue-800">
              Formula: (Total Penalty Points × 3,600) / (Inspected Length [yds] × Cuttable Width [in]).
              Metric conversions are calculated explicitly. Acceptance threshold is customer/buyer configured.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Grading Option</label>
              <select
                className="w-full text-xs rounded border border-slate-200 bg-white p-2 text-slate-900"
                value={gradingOption}
                onChange={(e) => setGradingOption(e.target.value as any)}
              >
                <option value={FabricGradingOption.OPTION_A_STANDARD}>
                  Option A Standard (1, 2, 3, 4 pt penalty)
                </option>
                <option value={FabricGradingOption.OPTION_B}>Option B Custom</option>
              </select>
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Measurement System</label>
              <div className="flex rounded border border-slate-200 overflow-hidden h-[34px]">
                <button
                  type="button"
                  onClick={() => setUnitSystem("IMPERIAL")}
                  className={`flex-1 font-semibold ${
                    unitSystem === "IMPERIAL" ? "bg-slate-900 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  Imperial (yds / in)
                </button>
                <button
                  type="button"
                  onClick={() => setUnitSystem("METRIC")}
                  className={`flex-1 font-semibold ${
                    unitSystem === "METRIC" ? "bg-slate-900 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  Metric (m / cm)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label={`Inspected Length (${unitSystem === "IMPERIAL" ? "yds" : "m"}) *`}
              type="number"
              value={inspectedLength}
              onChange={(e) => setInspectedLength(e.target.value)}
              required
            />
            <Input
              label={`Cuttable Width (${unitSystem === "IMPERIAL" ? "in" : "cm"}) *`}
              type="number"
              value={inspectedWidth}
              onChange={(e) => setInspectedWidth(e.target.value)}
              required
            />
            <Input
              label="Acceptance Threshold (pts/100 yd²) *"
              type="number"
              value={thresholdPoints}
              onChange={(e) => setThresholdPoints(e.target.value)}
              required
            />
          </div>

          {/* Defect Counts by Penalty Points */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
            <span className="font-bold text-slate-800 uppercase tracking-wider block text-[11px]">
              Defect Point Tallies (ASTM 4-Point Rules)
            </span>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">
                  1 Point (≤ 3&quot;)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full text-xs rounded border border-slate-300 p-1.5 text-center font-mono font-bold"
                  value={defects1Pt}
                  onChange={(e) => setDefects1Pt(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">
                  2 Points (3&quot; - 6&quot;)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full text-xs rounded border border-slate-300 p-1.5 text-center font-mono font-bold"
                  value={defects2Pt}
                  onChange={(e) => setDefects2Pt(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">
                  3 Points (6&quot; - 9&quot;)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full text-xs rounded border border-slate-300 p-1.5 text-center font-mono font-bold"
                  value={defects3Pt}
                  onChange={(e) => setDefects3Pt(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">
                  4 Points (&gt; 9&quot; / Holes)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full text-xs rounded border border-slate-300 p-1.5 text-center font-mono font-bold"
                  value={defects4Pt}
                  onChange={(e) => setDefects4Pt(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Live ASTM Calculation Preview Box */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between ${
              preview.passed
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div>
              <span className="font-bold text-xs block">
                Calculated Score: {preview.pointsPer100Yd} points / 100 yd²
              </span>
              <span className="text-[11px] opacity-80">
                Metric display: {preview.pointsPer100M} points / 100 m² | Total Penalty: {preview.totalPoints} pts
              </span>
            </div>
            <div className="flex items-center gap-1 font-bold text-xs uppercase">
              {preview.passed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">PASS (Within {thresholdPoints})</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span className="text-rose-700">FAIL (Exceeds {thresholdPoints})</span>
                </>
              )}
            </div>
          </div>

          <Input
            label="Inspection Auditor Remarks"
            placeholder="e.g. Slubs found along selvage, weft tension normal"
            value={inspectionNotes}
            onChange={(e) => setInspectionNotes(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setInspectModalOpen(false);
                setActiveRoll(null);
              }}
              disabled={inspectRollMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={inspectRollMutation.isPending}
              className={preview.passed ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
            >
              Confirm & Save Inspection
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Register Fabric Roll Modal */}
      <Dialog
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Register Fabric Roll"
        description="Add a discrete physical fabric roll with barcode tracking and physical dimensions."
      >
        <form onSubmit={handleCreateRoll} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Fabric Material *</label>
            <select
              className="w-full text-xs rounded border border-slate-200 bg-white p-2 text-slate-900"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              required
            >
              <option value="">Select Fabric Material</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} - {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Dye Lot Number"
              placeholder="e.g. LOT-2026-X1"
              value={dyeLot}
              onChange={(e) => setDyeLot(e.target.value)}
            />
            <Input
              label="Shade / Colorway"
              placeholder="e.g. Charcoal Melange"
              value={shade}
              onChange={(e) => setShade(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Gross Length (yds) *"
              type="number"
              value={grossLength}
              onChange={(e) => setGrossLength(e.target.value)}
              required
            />
            <Input
              label="Cuttable Width (in)"
              type="number"
              value={cuttableWidth}
              onChange={(e) => setCuttableWidth(e.target.value)}
            />
            <Input
              label="GSM (g/m²)"
              type="number"
              value={gsm}
              onChange={(e) => setGsm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Length Shrinkage (%)"
              type="number"
              step="0.1"
              value={shrinkageLength}
              onChange={(e) => setShrinkageLength(e.target.value)}
            />
            <Input
              label="Width Shrinkage (%)"
              type="number"
              step="0.1"
              value={shrinkageWidth}
              onChange={(e) => setShrinkageWidth(e.target.value)}
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Target Storage Bin</label>
            <select
              className="w-full text-xs rounded border border-slate-200 bg-white p-2 text-slate-900"
              value={binId}
              onChange={(e) => setBinId(e.target.value)}
            >
              <option value="">Default Warehouse Bin</option>
              {warehouses.flatMap((wh) =>
                (wh.bins || []).map((b: Bin) => (
                  <option key={b.id} value={b.id}>
                    {wh.code} / {b.code} ({b.name})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              disabled={createRollMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createRollMutation.isPending}
            >
              Generate Roll Barcode
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Roll Details Dialog */}
      <Dialog
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setActiveRoll(null);
        }}
        title={`Roll Inspection & Genealogy: ${activeRoll?.barcode || ""}`}
        description={`Status: ${activeRoll?.status.replace(/_/g, " ") || ""}`}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg">
            <div>
              <span className="text-slate-500 block">Material:</span>
              <span className="font-bold text-slate-900">
                {activeRoll?.material?.code} - {activeRoll?.material?.name}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Lot & Shade:</span>
              <span className="font-medium text-slate-800">
                {activeRoll?.dyeLot || "Standard"} / {activeRoll?.shade || "Standard"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Dimensions:</span>
              <span className="font-mono font-semibold text-slate-800">
                {activeRoll?.netLength} yds usable × {activeRoll?.cuttableWidth}&quot; wide ({activeRoll?.gsm} GSM)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Storage Location:</span>
              <span className="font-mono text-slate-800">{activeRoll?.bin?.code || "Default Bin"}</span>
            </div>
          </div>

          {/* Inspections History */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              ASTM D5430 Inspection History
            </div>
            {activeRoll?.inspections?.length === 0 ? (
              <div className="p-4 text-center text-slate-400">No inspection records for this roll.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeRoll?.inspections?.map((insp: FabricRollInspection) => (
                  <div key={insp.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={insp.result === "PASSED" || insp.result === "PASS" ? "success" : "danger"}
                          size="sm"
                        >
                          {insp.result}
                        </Badge>
                        <span className="font-mono font-bold text-slate-900">
                          {insp.pointsPer100SqYards ?? insp.pointsPer100SqYd} pts/100 yd²
                        </span>
                        <span className="text-[10px] text-slate-400">
                          (Metric: {insp.pointsPer100SqMeters ?? insp.pointsPer100SqM} pts/100 m²)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(insp.createdAt || insp.inspectedAt || "").toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Basis: {insp.gradingOption} | Inspected: {insp.inspectedLength} yds × {insp.cuttableWidth || activeRoll?.cuttableWidth || 58}&quot; | Threshold: {insp.acceptanceThreshold ?? insp.thresholdPointsPer100SqYd} pts
                    </div>
                    {insp.notes && (
                      <p className="text-[11px] text-slate-500 italic">&ldquo;{insp.notes}&rdquo;</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                setActiveRoll(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
