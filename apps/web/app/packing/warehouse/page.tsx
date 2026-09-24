"use client";

import React, { useState } from "react";
import { usePermissions } from "../../../hooks/use-permissions";
import { useAuth } from "../../../lib/auth/auth-context";
import {
  useFgWarehouses,
  useFgInventory,
  useCartonMovements,
  useCartonHistory,
  useFgReconciliation,
  usePutawayCarton,
  useRelocateCarton,
  useStageCarton,
  useUnstageCarton,
  useUpdateWarehouseType,
  useUpdateBinType,
} from "../../../hooks/use-fg-warehouse";
import { useCartons } from "../../../hooks/use-packing";
import { PageHeader } from "../../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../../components/tables/data-table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { useToast } from "../../../components/ui/toast";
import { ForbiddenState } from "../../../components/feedback/forbidden-state";
import {
  Warehouse as WarehouseIcon,
  Boxes,
  ArrowRightLeft,
  Truck,
  History,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  RotateCcw,
  Sliders,
  CheckSquare,
  PackagePlus,
  Compass,
} from "lucide-react";
import {
  Carton,
  CartonMovement,
  Warehouse,
  Bin,
  WarehouseType,
  BinType,
  CartonMovementType,
  CartonStatus,
} from "../../../lib/api/types";

export default function FgWarehousePage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"inventory" | "warehouses" | "movements" | "reconciliation">("inventory");

  // Filters
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [selectedBinId, setSelectedBinId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("");

  // Modals state
  const [putawayModalOpen, setPutawayModalOpen] = useState(false);
  const [relocateModalOpen, setRelocateModalOpen] = useState(false);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [unstageModalOpen, setUnstageModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [activeCarton, setActiveCarton] = useState<Carton | null>(null);

  // Form State
  const [formWarehouseId, setFormWarehouseId] = useState("");
  const [formBinId, setFormBinId] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Queries
  const { data: warehouses = [], isLoading: loadingWarehouses } = useFgWarehouses();
  const { data: fgInventory, isLoading: loadingInventory } = useFgInventory({
    warehouseId: selectedWarehouseId || undefined,
    binId: selectedBinId || undefined,
    status: selectedStatus || undefined,
  });
  const { data: movements = [], isLoading: loadingMovements } = useCartonMovements({
    movementType: movementTypeFilter || undefined,
    limit: 50,
  });
  const { data: cartonHistory } = useCartonHistory(activeCarton?.id || "");
  const { data: reconciliation, isLoading: loadingReconciliation } = useFgReconciliation();
  const { data: packedCartons = [] } = useCartons({ status: "PACKED" });

  // Mutations
  const putawayMutation = usePutawayCarton();
  const relocateMutation = useRelocateCarton();
  const stageMutation = useStageCarton();
  const unstageMutation = useUnstageCarton();
  const updateWarehouseTypeMutation = useUpdateWarehouseType();
  const updateBinTypeMutation = useUpdateBinType();

  if (!isAuthenticated) return null;
  if (!can("WAREHOUSE:READ") && !can("PACKING:READ")) {
    return (
      <ForbiddenState
        requiredPermission="WAREHOUSE:READ"
        moduleName="FG Warehouse & Stock Staging"
      />
    );
  }

  // Active warehouse's bins
  const activeWarehouseBins = warehouses.find((w) => w.id === formWarehouseId)?.bins || [];

  // Handlers
  const handleOpenPutaway = (carton?: Carton) => {
    setActiveCarton(carton || null);
    const defaultWh = warehouses.find((w) => w.warehouseType !== "RAW_MATERIAL");
    setFormWarehouseId(defaultWh?.id || "");
    const defaultBin = defaultWh?.bins?.find((b) => b.binType !== "STAGING");
    setFormBinId(defaultBin?.id || "");
    setFormNotes("");
    setPutawayModalOpen(true);
  };

  const handleExecutePutaway = async () => {
    if (!activeCarton || !formWarehouseId || !formBinId) {
      toast.error("Please select a target warehouse and bin");
      return;
    }
    try {
      const idempotencyKey = `putaway-${activeCarton.id}-${Date.now()}`;
      await putawayMutation.mutateAsync({
        data: {
          cartonId: activeCarton.id,
          warehouseId: formWarehouseId,
          binId: formBinId,
          notes: formNotes || undefined,
        },
        idempotencyKey,
      });
      toast.success(`Carton ${activeCarton.cartonNumber} putaway successfully`);
      setPutawayModalOpen(false);
      setActiveCarton(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Putaway failed");
    }
  };

  const handleOpenRelocate = (carton: Carton) => {
    setActiveCarton(carton);
    setFormWarehouseId(carton.warehouseId || warehouses[0]?.id || "");
    const targetWh = warehouses.find((w) => w.id === (carton.warehouseId || warehouses[0]?.id));
    const firstOtherBin = targetWh?.bins?.find((b) => b.id !== carton.binId && b.binType !== "STAGING");
    setFormBinId(firstOtherBin?.id || "");
    setFormNotes("");
    setRelocateModalOpen(true);
  };

  const handleExecuteRelocate = async () => {
    if (!activeCarton || !formBinId) {
      toast.error("Please select a valid destination bin");
      return;
    }
    try {
      const idempotencyKey = `reloc-${activeCarton.id}-${Date.now()}`;
      await relocateMutation.mutateAsync({
        data: {
          cartonId: activeCarton.id,
          toWarehouseId: formWarehouseId || undefined,
          toBinId: formBinId,
          notes: formNotes || undefined,
        },
        idempotencyKey,
      });
      toast.success(`Carton ${activeCarton.cartonNumber} relocated successfully`);
      setRelocateModalOpen(false);
      setActiveCarton(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Relocation failed");
    }
  };

  const handleOpenStage = (carton: Carton) => {
    setActiveCarton(carton);
    const wh = warehouses.find((w) => w.id === carton.warehouseId) || warehouses[0];
    const stagingBin = wh?.bins?.find((b) => b.binType === "STAGING");
    setFormWarehouseId(wh?.id || "");
    setFormBinId(stagingBin?.id || "");
    setFormNotes("");
    setStageModalOpen(true);
  };

  const handleExecuteStage = async () => {
    if (!activeCarton || !formBinId) {
      toast.error("Please select a valid STAGING bin");
      return;
    }
    try {
      const idempotencyKey = `stage-${activeCarton.id}-${Date.now()}`;
      await stageMutation.mutateAsync({
        data: {
          cartonId: activeCarton.id,
          stagingBinId: formBinId,
          notes: formNotes || undefined,
        },
        idempotencyKey,
      });
      toast.success(`Carton ${activeCarton.cartonNumber} staged for outbound successfully`);
      setStageModalOpen(false);
      setActiveCarton(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Staging failed");
    }
  };

  const handleOpenUnstage = (carton: Carton) => {
    setActiveCarton(carton);
    const wh = warehouses.find((w) => w.id === carton.warehouseId) || warehouses[0];
    const storageBin = wh?.bins?.find((b) => b.binType === "STORAGE");
    setFormWarehouseId(wh?.id || "");
    setFormBinId(storageBin?.id || "");
    setFormNotes("");
    setUnstageModalOpen(true);
  };

  const handleExecuteUnstage = async () => {
    if (!activeCarton || !formBinId) {
      toast.error("Please select a target STORAGE bin to un-stage");
      return;
    }
    try {
      const idempotencyKey = `unstage-${activeCarton.id}-${Date.now()}`;
      await unstageMutation.mutateAsync({
        data: {
          cartonId: activeCarton.id,
          storageBinId: formBinId,
          notes: formNotes || undefined,
        },
        idempotencyKey,
      });
      toast.success(`Carton ${activeCarton.cartonNumber} un-staged back to storage`);
      setUnstageModalOpen(false);
      setActiveCarton(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Un-stage failed");
    }
  };

  const handleOpenHistory = (carton: Carton) => {
    setActiveCarton(carton);
    setHistoryModalOpen(true);
  };

  // Columns for Inventory Table
  const inventoryColumns: ColumnDef<Carton>[] = [
    {
      header: "Carton & SSCC",
      accessorKey: "cartonNumber",
      cell: (carton) => (
        <div className="space-y-1">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Boxes className="h-4 w-4 text-blue-500" />
            {carton.cartonNumber}
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            {carton.barcode || carton.ssccBarcode}
          </div>
        </div>
      ),
    },
    {
      header: "Order & Style",
      accessorKey: "productionOrder",
      cell: (carton) => (
        <div className="space-y-0.5">
          <div className="text-xs font-medium text-foreground">
            {carton.productionOrder?.orderNumber || "Direct Pack"}
          </div>
          <div className="text-xs text-muted-foreground">
            {carton.items?.[0]?.style?.code || carton.items?.[0]?.style?.styleCode || "Multiple / Mixed"}
          </div>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (carton) => {
        const variants: Record<CartonStatus, "default" | "outline" | "success" | "warning" | "danger" | "info" | "neutral"> = {
          PACKED: "info",
          STAGED: "success",
          SHIPPED: "neutral",
          CANCELLED: "danger",
        };
        return (
          <Badge variant={variants[carton.status] || "neutral"} className="text-xs font-medium">
            {carton.status}
          </Badge>
        );
      },
    },
    {
      header: "Physical Location",
      accessorKey: "warehouse",
      cell: (carton) => {
        if (!carton.warehouseId || !carton.binId) {
          return (
            <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10">
              Unassigned (Floor)
            </Badge>
          );
        }
        return (
          <div className="space-y-0.5">
            <div className="text-xs font-semibold flex items-center gap-1 text-foreground">
              <MapPin className="h-3 w-3 text-emerald-500" />
              {carton.warehouse?.code || carton.warehouseId.substring(0, 8)}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              Bin: <span className="font-mono">{carton.bin?.code || carton.binId.substring(0, 8)}</span>
              {carton.bin?.binType && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {carton.bin.binType}
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Quantity",
      accessorKey: "totalUnits",
      cell: (carton) => (
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground">{carton.totalUnits} PCS</span>
          {carton.grossWeightKg && (
            <div className="text-[11px] text-muted-foreground">{Number(carton.grossWeightKg)} kg</div>
          )}
        </div>
      ),
    },
    {
      header: "Actions",
      cell: (carton) => (
        <div className="flex items-center gap-1.5">
          {carton.status === "PACKED" && (!carton.warehouseId || !carton.binId) && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-blue-500/30 hover:bg-blue-500/10 text-blue-400"
              onClick={() => handleOpenPutaway(carton)}
            >
              <PackagePlus className="h-3.5 w-3.5" /> Putaway
            </Button>
          )}

          {carton.status === "PACKED" && carton.warehouseId && carton.binId && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => handleOpenRelocate(carton)}
              >
                <ArrowRightLeft className="h-3 w-3" /> Relocate
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                onClick={() => handleOpenStage(carton)}
              >
                <Truck className="h-3 w-3" /> Stage
              </Button>
            </>
          )}

          {carton.status === "STAGED" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => handleOpenUnstage(carton)}
            >
              <RotateCcw className="h-3 w-3" /> Unstage
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Custody History"
            onClick={() => handleOpenHistory(carton)}
          >
            <History className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      ),
    },
  ];

  // Columns for Movement History Table
  const movementColumns: ColumnDef<CartonMovement>[] = [
    {
      header: "Timestamp",
      accessorKey: "timestamp",
      cell: (m) => (
        <div className="text-xs text-muted-foreground">
          {new Date(m.timestamp).toLocaleString()}
        </div>
      ),
    },
    {
      header: "Carton Number",
      accessorKey: "carton",
      cell: (m) => (
        <div className="font-semibold text-xs text-foreground">
          {m.carton?.cartonNumber || m.cartonId}
        </div>
      ),
    },
    {
      header: "Action",
      accessorKey: "movementType",
      cell: (m) => {
        const badgeColors: Record<CartonMovementType, string> = {
          PUTAWAY: "bg-blue-500/10 text-blue-400 border-blue-500/30",
          RELOCATION: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          STAGE: "bg-purple-500/10 text-purple-400 border-purple-500/30",
          UNSTAGE: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        };
        return (
          <Badge variant="outline" className={`text-[11px] ${badgeColors[m.movementType]}`}>
            {m.movementType}
          </Badge>
        );
      },
    },
    {
      header: "Source -> Destination",
      cell: (m) => (
        <div className="text-xs flex items-center gap-1.5 font-mono">
          <span className="text-muted-foreground">
            {m.fromWarehouse?.code ? `${m.fromWarehouse.code}:${m.fromBin?.code || "ANY"}` : "PROD_FLOOR"}
          </span>
          <span className="text-foreground font-bold">{"->"}</span>
          <span className="text-emerald-400">
            {m.toWarehouse?.code ? `${m.toWarehouse.code}:${m.toBin?.code || "ANY"}` : "-"}
          </span>
        </div>
      ),
    },
    {
      header: "Operator",
      accessorKey: "actorId",
      cell: (m) => <span className="text-xs font-mono text-muted-foreground">{m.actorId}</span>,
    },
    {
      header: "Notes",
      accessorKey: "notes",
      cell: (m) => <span className="text-xs text-muted-foreground">{m.notes || "-"}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Finished Goods Warehouse & Stock Staging"
        description="Sub-Phase 8.2: Physical container custody, multi-bin staging, and authoritative ledger stock reconciliation."
        actions={
          <Button
            onClick={() => handleOpenPutaway()}
            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg"
          >
            <PackagePlus className="h-4 w-4" />
            Putaway Carton
          </Button>
        }
      />

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">FG Stored Cartons</span>
            <Boxes className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {fgInventory?.summary?.totalCartons || 0}
          </div>
          <div className="text-xs text-muted-foreground">
            {fgInventory?.summary?.totalUnits || 0} finished units in racks
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Outbound Staged</span>
            <Truck className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {fgInventory?.summary?.stagedCartons || 0}
          </div>
          <div className="text-xs text-muted-foreground">
            {fgInventory?.summary?.stagedUnits || 0} units staged for dispatch
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Active Warehouses</span>
            <WarehouseIcon className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{warehouses.length}</div>
          <div className="text-xs text-muted-foreground">
            {warehouses.reduce((acc, w) => acc + (w.bins?.length || 0), 0)} configured bins
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur shadow-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Ledger Reconciliation</span>
            {reconciliation?.summary?.isReconciled ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            )}
          </div>
          <div className="text-2xl font-bold text-foreground">
            {reconciliation?.summary?.isReconciled ? "100% Match" : "Variance Alert"}
          </div>
          <div className="text-xs text-emerald-400 font-medium">
            Zero duplicate stock recognition
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === "inventory"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Boxes className="h-4 w-4" />
          Physical Inventory & Custody
        </button>

        <button
          onClick={() => setActiveTab("warehouses")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === "warehouses"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <WarehouseIcon className="h-4 w-4" />
          Warehouse & Bin Designation
        </button>

        <button
          onClick={() => setActiveTab("movements")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === "movements"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <History className="h-4 w-4" />
          Chain of Custody History
        </button>

        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === "reconciliation"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Sliders className="h-4 w-4" />
          Stock Reconciliation (Ledger Invariant)
        </button>
      </div>

      {/* TAB 1: Physical Inventory & Custody */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 bg-card/40 p-3 rounded-xl border border-border">
            <div className="flex items-center gap-2">
              <WarehouseIcon className="h-4 w-4 text-muted-foreground" />
              <select
                className="text-xs bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
              >
                <option value="">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Status:</span>
              <select
                className="text-xs bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="PACKED">PACKED (In Storage)</option>
                <option value="STAGED">STAGED (Outbound Ready)</option>
              </select>
            </div>

            {(selectedWarehouseId || selectedStatus) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSelectedWarehouseId("");
                  setSelectedStatus("");
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>

          <DataTable
            columns={inventoryColumns}
            data={fgInventory?.items || []}
            isLoading={loadingInventory}
            emptyTitle="No Finished Goods Cartons"
            emptyDescription="No finished goods cartons found in the warehouse."
          />
        </div>
      )}

      {/* TAB 2: Warehouse & Bin Designation */}
      {activeTab === "warehouses" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-blue-300 flex items-start gap-3">
            <Compass className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-blue-200">Architectural Rule 8.2: </span>
              Finished goods cartons may only be placed in warehouses classified as <code className="bg-blue-900/40 px-1 py-0.5 rounded">FINISHED_GOODS</code> or <code className="bg-blue-900/40 px-1 py-0.5 rounded">GENERAL</code>.
              Placement into <code className="bg-blue-900/40 px-1 py-0.5 rounded">RAW_MATERIAL</code> is blocked at the server API level.
              Staging cartons requires dedicated <code className="bg-blue-900/40 px-1 py-0.5 rounded">STAGING</code> bins.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {warehouses.map((wh) => (
              <div
                key={wh.id}
                className="p-5 rounded-xl border border-border bg-card/60 backdrop-blur space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-base text-foreground flex items-center gap-2">
                      <WarehouseIcon className="h-4 w-4 text-emerald-400" />
                      {wh.name}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">Code: {wh.code}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Type:</span>
                    <select
                      className="text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground"
                      value={wh.warehouseType || "GENERAL"}
                      onChange={async (e) => {
                        try {
                          await updateWarehouseTypeMutation.mutateAsync({
                            id: wh.id,
                            data: { warehouseType: e.target.value as WarehouseType },
                          });
                          toast.success(`Warehouse type updated to ${e.target.value}`);
                        } catch (err: any) {
                          toast.error(err.response?.data?.message || err.message || "Failed to update warehouse type");
                        }
                      }}
                    >
                      <option value="FINISHED_GOODS">FINISHED_GOODS</option>
                      <option value="GENERAL">GENERAL</option>
                      <option value="RAW_MATERIAL">RAW_MATERIAL</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Configured Bins ({wh.bins?.length || 0})</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {wh.bins?.map((bin) => (
                      <div
                        key={bin.id}
                        className="p-2.5 rounded-lg border border-border/70 bg-background/50 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-medium text-foreground">{bin.name}</div>
                          <div className="text-[10px] font-mono text-muted-foreground">{bin.code}</div>
                        </div>

                        <select
                          className="text-[11px] bg-background border border-border rounded px-1.5 py-0.5 text-foreground"
                          value={bin.binType || "STORAGE"}
                          onChange={async (e) => {
                            try {
                              await updateBinTypeMutation.mutateAsync({
                                id: bin.id,
                                data: { binType: e.target.value as BinType },
                              });
                              toast.success(`Bin ${bin.code} type set to ${e.target.value}`);
                            } catch (err: any) {
                              toast.error(err.response?.data?.message || err.message || "Failed to update bin type");
                            }
                          }}
                        >
                          <option value="STORAGE">STORAGE</option>
                          <option value="STAGING">STAGING</option>
                          <option value="QUARANTINE">QUARANTINE</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Chain of Custody History */}
      {activeTab === "movements" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-card/40 p-3 rounded-xl border border-border">
            <span className="text-xs text-muted-foreground font-medium">Filter Movement:</span>
            <select
              className="text-xs bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground"
              value={movementTypeFilter}
              onChange={(e) => setMovementTypeFilter(e.target.value)}
            >
              <option value="">All Movement Types</option>
              <option value="PUTAWAY">PUTAWAY (Receiving into FG)</option>
              <option value="RELOCATION">RELOCATION (Bin-to-Bin / WH-to-WH)</option>
              <option value="STAGE">STAGE (Outbound Staging)</option>
              <option value="UNSTAGE">UNSTAGE (Return to Storage)</option>
            </select>
          </div>

          <DataTable
            columns={movementColumns}
            data={movements}
            isLoading={loadingMovements}
            emptyTitle="No Movements Recorded"
            emptyDescription="No carton movements recorded yet."
          />
        </div>
      )}

      {/* TAB 4: Stock Reconciliation */}
      {activeTab === "reconciliation" && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-emerald-300 flex items-start gap-3">
            <CheckSquare className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-200">Sole Inventory Authority Guarantee: </span>
              Inventory balances are created exclusively via MES <code className="bg-emerald-900/40 px-1 py-0.5 rounded">PRODUCTION_OUTPUT</code> in <code className="bg-emerald-900/40 px-1 py-0.5 rounded">LedgerService</code>.
              Carton putaway and staging represent <strong>physical container custody</strong> and do not duplicate stock recognition.
              Total loose units + cartonized units match the ledger with 0 variance.
            </div>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card/60 backdrop-blur shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="font-bold text-base text-foreground">Finished Goods Reconciliation Ledger</div>
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                Audited: {reconciliation?.summary?.totalStyles || 0} Style(s)
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground font-semibold uppercase">
                    <th className="py-2.5 px-3">Style Code & Name</th>
                    <th className="py-2.5 px-3 text-right">Ledger Balance (Authoritative)</th>
                    <th className="py-2.5 px-3 text-right">Cartonized Units</th>
                    <th className="py-2.5 px-3 text-right">Cartons Count</th>
                    <th className="py-2.5 px-3 text-right">Staged Units</th>
                    <th className="py-2.5 px-3 text-right">Loose Unpacked</th>
                    <th className="py-2.5 px-3 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {reconciliation?.lines?.map((line) => (
                    <tr key={line.styleId} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-foreground">{line.styleCode}</div>
                        <div className="text-[11px] text-muted-foreground">{line.styleName}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-400">
                        {line.ledgerBalance} PCS
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                        {line.cartonizedUnits} PCS
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {line.cartonCount} cartons
                      </td>
                      <td className="py-2.5 px-3 text-right text-purple-400">
                        {line.stagedUnits} PCS
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {line.unpackedLooseUnits} PCS
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        {line.variance === 0 ? (
                          <span className="text-emerald-400">0.0 (Balanced)</span>
                        ) : (
                          <span className="text-rose-400">+{line.variance} (Over-cartonized)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!reconciliation?.lines || reconciliation.lines.length === 0) && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-muted-foreground">
                        No finished goods inventory records found to reconcile.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Putaway Carton */}
      <Dialog
        isOpen={putawayModalOpen}
        onClose={() => setPutawayModalOpen(false)}
        title="Finished Goods Putaway"
      >
        <div className="space-y-4 py-2">
          {!activeCarton ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Select Packed Carton to Putaway</label>
              <select
                className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 text-foreground"
                onChange={(e) => {
                  const c = packedCartons.find((item) => item.id === e.target.value);
                  setActiveCarton(c || null);
                }}
              >
                <option value="">-- Choose Packed Carton --</option>
                {packedCartons.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.cartonNumber} - {c.totalUnits} PCS ({c.barcode || c.ssccBarcode})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-border bg-card/60 space-y-1">
              <div className="text-xs font-bold text-foreground">Carton: {activeCarton.cartonNumber}</div>
              <div className="text-xs text-muted-foreground font-mono">{activeCarton.barcode || activeCarton.ssccBarcode}</div>
              <div className="text-xs text-emerald-400">{activeCarton.totalUnits} PCS</div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Target Warehouse (FG / General)</label>
            <select
              className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 text-foreground"
              value={formWarehouseId}
              onChange={(e) => {
                setFormWarehouseId(e.target.value);
                const wh = warehouses.find((w) => w.id === e.target.value);
                const firstStorageBin = wh?.bins?.find((b) => b.binType !== "STAGING");
                setFormBinId(firstStorageBin?.id || "");
              }}
            >
              <option value="">-- Select Destination Warehouse --</option>
              {warehouses
                .filter((w) => w.warehouseType !== "RAW_MATERIAL")
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code}) [{w.warehouseType}]
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Destination Storage Bin</label>
            <select
              className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 text-foreground"
              value={formBinId}
              onChange={(e) => setFormBinId(e.target.value)}
            >
              <option value="">-- Select Destination Bin --</option>
              {activeWarehouseBins
                .filter((b) => b.binType !== "STAGING")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} ({b.name}) [{b.binType}]
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Putaway Notes (Optional)</label>
            <Input
              placeholder="e.g. Aisle 3 Level 2 pallet"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setPutawayModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecutePutaway}
              disabled={putawayMutation.isPending || !activeCarton || !formWarehouseId || !formBinId}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {putawayMutation.isPending ? "Executing..." : "Confirm Putaway"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL: Relocate Carton */}
      <Dialog
        isOpen={relocateModalOpen}
        onClose={() => setRelocateModalOpen(false)}
        title="Relocate Carton"
      >
        <div className="space-y-4 py-2">
          {activeCarton && (
            <div className="p-3 rounded-lg border border-border bg-card/60 space-y-1 text-xs">
              <div className="font-bold text-foreground">Carton: {activeCarton.cartonNumber}</div>
              <div className="text-muted-foreground">
                Current Location: <span className="font-semibold text-foreground">{activeCarton.warehouse?.code} / {activeCarton.bin?.code}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Destination Warehouse</label>
            <select
              className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 text-foreground"
              value={formWarehouseId}
              onChange={(e) => {
                setFormWarehouseId(e.target.value);
                const wh = warehouses.find((w) => w.id === e.target.value);
                const firstOtherBin = wh?.bins?.find((b) => b.id !== activeCarton?.binId && b.binType !== "STAGING");
                setFormBinId(firstOtherBin?.id || "");
              }}
            >
              {warehouses
                .filter((w) => w.warehouseType !== "RAW_MATERIAL")
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Target Bin</label>
            <select
              className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 text-foreground"
              value={formBinId}
              onChange={(e) => setFormBinId(e.target.value)}
            >
              <option value="">-- Choose New Bin --</option>
              {activeWarehouseBins
                .filter((b) => b.id !== activeCarton?.binId && b.binType !== "STAGING")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} ({b.name}) [{b.binType}]
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Relocation Notes</label>
            <Input
              placeholder="e.g. Stock reorganization"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setRelocateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecuteRelocate}
              disabled={relocateMutation.isPending || !formBinId}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {relocateMutation.isPending ? "Relocating..." : "Confirm Relocation"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL: Stage Carton */}
      <Dialog
        isOpen={stageModalOpen}
        onClose={() => setStageModalOpen(false)}
        title="Stage Carton for Outbound"
      >
        <div className="space-y-4 py-2">
          {activeCarton && (
            <div className="p-3 rounded-lg border border-purple-500/30 bg-purple-500/10 space-y-1 text-xs">
              <div className="font-bold text-purple-200">Carton: {activeCarton.cartonNumber}</div>
              <div className="text-muted-foreground">{activeCarton.totalUnits} PCS ready for outbound staging</div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Designated STAGING Bin</label>
            <select
              className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 text-foreground"
              value={formBinId}
              onChange={(e) => setFormBinId(e.target.value)}
            >
              <option value="">-- Choose STAGING Bin --</option>
              {activeWarehouseBins
                .filter((b) => b.binType === "STAGING")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} - {b.name}
                  </option>
                ))}
            </select>
            {activeWarehouseBins.filter((b) => b.binType === "STAGING").length === 0 && (
              <p className="text-[11px] text-amber-400">
                Warning: No bins in this warehouse are designated as STAGING. Update a bin type in the Designation tab.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Staging Notes</label>
            <Input
              placeholder="e.g. Staged for Container Load #102"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setStageModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecuteStage}
              disabled={stageMutation.isPending || !formBinId}
              className="bg-purple-600 hover:bg-purple-500 text-white"
            >
              {stageMutation.isPending ? "Staging..." : "Confirm Staging"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL: Unstage Carton */}
      <Dialog
        isOpen={unstageModalOpen}
        onClose={() => setUnstageModalOpen(false)}
        title="Unstage Carton (Return to Storage)"
      >
        <div className="space-y-4 py-2">
          {activeCarton && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-1 text-xs">
              <div className="font-bold text-amber-200">Carton: {activeCarton.cartonNumber}</div>
              <div className="text-muted-foreground">Currently STAGED. Returning to operational storage.</div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Return Destination STORAGE Bin</label>
            <select
              className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 text-foreground"
              value={formBinId}
              onChange={(e) => setFormBinId(e.target.value)}
            >
              <option value="">-- Choose Storage Bin --</option>
              {activeWarehouseBins
                .filter((b) => b.binType !== "STAGING")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} ({b.name}) [{b.binType}]
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setUnstageModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExecuteUnstage}
              disabled={unstageMutation.isPending || !formBinId}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {unstageMutation.isPending ? "Unstaging..." : "Confirm Return to Storage"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* MODAL: Carton Custody History */}
      <Dialog
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Chain of Custody — Carton ${activeCarton?.cartonNumber}`}
      >
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
          {activeCarton && (
            <div className="p-3 rounded-lg border border-border bg-card/60 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">SSCC-18 Barcode:</span>
                <span className="font-mono text-blue-400 font-semibold">{activeCarton.barcode || activeCarton.ssccBarcode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Status:</span>
                <Badge variant="neutral">{activeCarton.status}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Units:</span>
                <span className="font-semibold text-foreground">{activeCarton.totalUnits} PCS</span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Immutable Custody Timeline ({cartonHistory?.totalMovements || 0} Events)
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {cartonHistory?.movements?.map((m) => (
                <div key={m.id} className="relative space-y-1">
                  <div className="absolute -left-6 top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-background" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] py-0 h-4">
                        {m.movementType}
                      </Badge>
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {new Date(m.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    {m.fromWarehouse?.code ? `${m.fromWarehouse.code}:${m.fromBin?.code}` : "PRODUCTION_FLOOR"} {"-> "}
                    <span className="text-emerald-400 font-semibold">
                      {m.toWarehouse?.code}:{m.toBin?.code}
                    </span>
                  </div>
                  {m.notes && <div className="text-[11px] italic text-muted-foreground">&quot;{m.notes}&quot;</div>}
                  <div className="text-[10px] text-muted-foreground/80 font-mono">
                    Key: {m.idempotencyKey}
                  </div>
                </div>
              ))}

              {(!cartonHistory?.movements || cartonHistory.movements.length === 0) && (
                <div className="text-xs text-muted-foreground py-2">
                  No custody transfers recorded for this carton yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
