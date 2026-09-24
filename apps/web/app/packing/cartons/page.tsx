"use client";

import React, { useState } from "react";
import { usePermissions } from "../../../hooks/use-permissions";
import { useAuth } from "../../../lib/auth/auth-context";
import {
  useCartons,
  usePackCarton,
  useCancelCarton,
  useSsccPreview,
} from "../../../hooks/use-packing";
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
  Boxes,
  Plus,
  Barcode,
  PackageCheck,
  AlertTriangle,
  FileCheck2,
  XCircle,
  Eye,
  Layers,
  Scale,
  Hash,
  ShieldAlert,
} from "lucide-react";
import {
  Carton,
  CartonStatus,
  CartonPackingMode,
  PackCartonDto,
  PackCartonItemInput,
  ProductionOrder,
  BuyerPo,
  Style,
} from "../../../lib/api/types";

export default function CartonsPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [packModalOpen, setPackModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [activeCarton, setActiveCarton] = useState<Carton | null>(null);

  // Queries
  const {
    data: cartons = [],
    isLoading,
    refetch,
  } = useCartons({
    status: selectedStatus || undefined,
    packingMode: selectedMode || undefined,
    search: searchQuery || undefined,
  });

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-orders-active"],
    queryFn: () => api.get<ProductionOrder[]>("/production/orders"),
    enabled: isAuthenticated && packModalOpen,
  });

  const { data: styles = [] } = useQuery({
    queryKey: ["styles"],
    queryFn: () => api.get<Style[]>("/styles"),
    enabled: isAuthenticated && packModalOpen,
  });

  const { data: buyerPos = [] } = useQuery({
    queryKey: ["buyer-pos"],
    queryFn: () => api.get<BuyerPo[]>("/buyer-pos"),
    enabled: isAuthenticated && packModalOpen,
  });

  // Pack Carton Form State
  const [packingMode, setPackingMode] = useState<CartonPackingMode>("SOLID");
  const [cartonNumber, setCartonNumber] = useState("");
  const [customSscc, setCustomSscc] = useState("");
  const [companyPrefix, setCompanyPrefix] = useState("0614141");
  const [selectedPoId, setSelectedPoId] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState("");
  const [selectedBuyerPoId, setSelectedBuyerPoId] = useState("");
  const [grossWeightKg, setGrossWeightKg] = useState("12.5");
  const [netWeightKg, setNetWeightKg] = useState("11.0");
  const [dimensionsCm, setDimensionsCm] = useState("60x40x30");
  const [notes, setNotes] = useState("");

  // Items State (supports multiple color/sizes)
  const [items, setItems] = useState<PackCartonItemInput[]>([
    { productionOrderId: "", color: "NAVY", size: "M", quantity: 24 },
  ]);

  // Ratio Definition for RATIO mode (e.g., S:1, M:2, L:2, XL:1)
  const [ratioSizes, setRatioSizes] = useState<Array<{ size: string; ratio: number }>>([
    { size: "S", ratio: 1 },
    { size: "M", ratio: 2 },
    { size: "L", ratio: 2 },
    { size: "XL", ratio: 1 },
  ]);
  const [ratioPacksCount, setRatioPacksCount] = useState<number>(4);
  const [ratioColor, setRatioColor] = useState("BLACK");

  // SSCC Preview
  const { data: ssccPreview } = useSsccPreview(
    packModalOpen ? { companyPrefix } : undefined
  );

  // Mutations
  const packCartonMutation = usePackCarton();
  const cancelCartonMutation = useCancelCarton();

  if (!can("PACKING:READ")) {
    return (
      <ForbiddenState
        requiredPermission="PACKING:READ"
        moduleName="Finished Goods Cartonization Terminal"
      />
    );
  }

  // Handle Item row updates
  const handleItemChange = (index: number, field: keyof PackCartonItemInput, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { productionOrderId: selectedPoId, color: "NAVY", size: "L", quantity: 12 },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Pack Submit
  const handlePackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let submissionItems: PackCartonItemInput[] = [];
    let ratioDef: Record<string, number> | undefined = undefined;

    if (packingMode === "SOLID") {
      submissionItems = items.map((itm) => ({
        ...itm,
        productionOrderId: itm.productionOrderId || selectedPoId,
        quantity: Number(itm.quantity),
      }));
    } else {
      // RATIO PACK: Generate items based on ratio and packs count
      ratioDef = {};
      ratioSizes.forEach((r) => {
        ratioDef![r.size] = Number(r.ratio);
      });

      submissionItems = ratioSizes.map((r) => ({
        productionOrderId: selectedPoId,
        color: ratioColor,
        size: r.size,
        quantity: Number(r.ratio) * Number(ratioPacksCount),
      }));
    }

    if (!selectedPoId && submissionItems.some((i) => !i.productionOrderId)) {
      toast.error("Please select a Production Order");
      return;
    }

    const payload: PackCartonDto = {
      cartonNumber: cartonNumber.trim() || undefined,
      ssccBarcode: customSscc.trim() || undefined,
      companyPrefix: companyPrefix.trim() || undefined,
      productionOrderId: selectedPoId || undefined,
      styleId: selectedStyleId || undefined,
      buyerPoId: selectedBuyerPoId || undefined,
      packingMode,
      grossWeightKg: grossWeightKg ? parseFloat(grossWeightKg) : undefined,
      netWeightKg: netWeightKg ? parseFloat(netWeightKg) : undefined,
      dimensionsCm: dimensionsCm.trim() || undefined,
      notes: notes.trim() || undefined,
      items: submissionItems,
      ratioDefinition: ratioDef,
    };

    try {
      const idempotencyKey = `pack-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await packCartonMutation.mutateAsync({ data: payload, idempotencyKey });
      toast.success("Success", "Carton packed and serialized successfully!");
      setPackModalOpen(false);
      resetPackForm();
      refetch();
    } catch (err: any) {
      toast.error("Packing Failed", err.message || "Failed to pack carton");
    }
  };

  const resetPackForm = () => {
    setCartonNumber("");
    setCustomSscc("");
    setSelectedPoId("");
    setSelectedStyleId("");
    setSelectedBuyerPoId("");
    setNotes("");
    setItems([{ productionOrderId: "", color: "NAVY", size: "M", quantity: 24 }]);
  };

  const handleCancelCarton = async (carton: Carton) => {
    if (!confirm(`Are you sure you want to cancel carton ${carton.cartonNumber}?`)) {
      return;
    }
    try {
      await cancelCartonMutation.mutateAsync({ id: carton.id, reason: "Operator manual cancellation" });
      toast.info("Carton Cancelled", `Carton ${carton.cartonNumber} cancelled`);
      setDetailsModalOpen(false);
      refetch();
    } catch (err: any) {
      toast.error("Cancellation Failed", err.message || "Failed to cancel carton");
    }
  };

  // Metrics calculation
  const totalCartons = cartons.length;
  const totalUnits = cartons.reduce((sum, c) => sum + (c.status !== "CANCELLED" ? c.totalUnits : 0), 0);
  const solidCartons = cartons.filter((c) => c.packingMode === "SOLID" && c.status !== "CANCELLED").length;
  const ratioCartons = cartons.filter((c) => c.packingMode === "RATIO" && c.status !== "CANCELLED").length;

  // Table Columns
  const columns: ColumnDef<Carton>[] = [
    {
      header: "Carton & SSCC-18",
      accessorKey: "cartonNumber",
      cell: (carton) => (
        <div>
          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
            <Boxes className="w-3.5 h-3.5 text-blue-400" />
            {carton.cartonNumber}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-0.5 flex items-center gap-1">
            <Barcode className="w-3 h-3 text-emerald-400" />
            {carton.ssccBarcode}
          </div>
        </div>
      ),
    },
    {
      header: "Mode",
      accessorKey: "packingMode",
      cell: (carton) => (
        <Badge
          className={
            carton.packingMode === "SOLID"
              ? "bg-blue-950 text-blue-300 border-blue-800"
              : "bg-purple-950 text-purple-300 border-purple-800"
          }
        >
          {carton.packingMode}
        </Badge>
      ),
    },
    {
      header: "Units",
      accessorKey: "totalUnits",
      cell: (carton) => (
        <div className="font-bold text-slate-200">
          {carton.totalUnits} <span className="text-xs font-normal text-slate-400">pcs</span>
        </div>
      ),
    },
    {
      header: "Production Order",
      accessorKey: "productionOrder",
      cell: (carton) => (
        <div className="text-xs">
          <div className="text-slate-200 font-medium">
            {carton.productionOrder?.orderNumber || "Multi-Order"}
          </div>
          {carton.style && (
            <div className="text-slate-400 mt-0.5">{carton.style.styleCode}</div>
          )}
        </div>
      ),
    },
    {
      header: "Weight & Spec",
      accessorKey: "grossWeightKg",
      cell: (carton) => (
        <div className="text-xs text-slate-400">
          <div>{carton.grossWeightKg ? `${carton.grossWeightKg} kg gross` : "—"}</div>
          <div>{carton.dimensionsCm || "—"}</div>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (carton) => {
        const styles: Record<CartonStatus, string> = {
          PACKED: "bg-emerald-950 text-emerald-300 border-emerald-800",
          STAGED: "bg-amber-950 text-amber-300 border-amber-800",
          SHIPPED: "bg-sky-950 text-sky-300 border-sky-800",
          CANCELLED: "bg-rose-950 text-rose-300 border-rose-800",
        };
        return <Badge className={styles[carton.status] || ""}>{carton.status}</Badge>;
      },
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (carton) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setActiveCarton(carton);
              setDetailsModalOpen(true);
            }}
          >
            <Eye className="w-3.5 h-3.5 text-blue-400 mr-1" /> View
          </Button>
          {can("PACKING:WRITE") && carton.status === "PACKED" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
              onClick={() => handleCancelCarton(carton)}
            >
              <XCircle className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Finished Goods Cartonization & Packaging Terminal"
        description="Pack, serialize with GS1-128 / SSCC-18, and enforce pre-pack quality holds for apparel production"
        actions={
          can("PACKING:WRITE") && (
            <Button
              onClick={() => {
                resetPackForm();
                setPackModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Pack New Carton
            </Button>
          )
        }
      />

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-950/60 text-blue-400 rounded-lg border border-blue-800/40">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-medium tracking-wider text-slate-400">
              Total Cartons
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{totalCartons}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-950/60 text-emerald-400 rounded-lg border border-emerald-800/40">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-medium tracking-wider text-slate-400">
              Finished Units Packed
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">
              {totalUnits} <span className="text-sm font-normal text-slate-400">pcs</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-950/60 text-indigo-400 rounded-lg border border-indigo-800/40">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-medium tracking-wider text-slate-400">
              Solid Cartons
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{solidCartons}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-950/60 text-purple-400 rounded-lg border border-purple-800/40">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-medium tracking-wider text-slate-400">
              Ratio Assortments
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{ratioCartons}</div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search Carton or SSCC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 bg-slate-950 border-slate-800 text-slate-200 text-sm"
          />

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="PACKED">PACKED</option>
            <option value="STAGED">STAGED</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Packing Modes</option>
            <option value="SOLID">SOLID (Single SKU/Color/Size)</option>
            <option value="RATIO">RATIO (Pre-pack Assortment)</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing {cartons.length} cartons
        </div>
      </div>

      {/* Cartons Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <DataTable
          columns={columns}
          data={cartons}
          isLoading={isLoading}
          searchKey="cartonNumber"
        />
      </div>

      {/* Pack New Carton Modal */}
      <Dialog
        isOpen={packModalOpen}
        onClose={() => setPackModalOpen(false)}
        title="Pack & Serialize Carton"
        maxWidth="lg"
      >
        <form onSubmit={handlePackSubmit} className="space-y-5">
          {/* Quality Warning Gate Notification */}
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200 leading-relaxed">
              <span className="font-semibold text-amber-300">Strict Quality Release Gate: </span>
              Production orders or bundles under an active QualityHold will be automatically rejected
              by the server. Ensure final quality inspections are passed before packing.
            </div>
          </div>

          {/* Packing Mode Toggle */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Carton Packing Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPackingMode("SOLID")}
                className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                  packingMode === "SOLID"
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Solid Pack (Single SKU / Ratio)
              </button>
              <button
                type="button"
                onClick={() => setPackingMode("RATIO")}
                className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                  packingMode === "RATIO"
                    ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Pre-Pack Ratio Assortment
              </button>
            </div>
          </div>

          {/* Identification & Order Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Production Order *</label>
              <select
                value={selectedPoId}
                onChange={(e) => {
                  setSelectedPoId(e.target.value);
                  const po = productionOrders.find((p) => p.id === e.target.value);
                  if (po?.styleId) setSelectedStyleId(po.styleId);
                }}
                required
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Production Order...</option>
                {productionOrders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.orderNumber} {po.style ? `— ${po.style.code || (po.style as any).styleCode}` : ""} ({po.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Buyer PO (Optional)</label>
              <select
                value={selectedBuyerPoId}
                onChange={(e) => setSelectedBuyerPoId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Buyer PO...</option>
                {buyerPos.map((bpo) => (
                  <option key={bpo.id} value={bpo.id}>
                    {bpo.poNumber} {bpo.buyer ? `— ${bpo.buyer.name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Carton Number (Auto if blank)
              </label>
              <Input
                placeholder="CTN-YYYYMMDD-XXXX"
                value={cartonNumber}
                onChange={(e) => setCartonNumber(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                GS1 Company Prefix (SSCC-18)
              </label>
              <Input
                placeholder="0614141"
                value={companyPrefix}
                onChange={(e) => setCompanyPrefix(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200 text-sm font-mono"
              />
              {ssccPreview && (
                <div className="text-[11px] font-mono text-emerald-400 mt-1 flex items-center gap-1">
                  <Barcode className="w-3 h-3" /> Next SSCC: {ssccPreview.sscc}
                </div>
              )}
            </div>
          </div>

          {/* Mode-Specific Item Entry */}
          {packingMode === "SOLID" ? (
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Carton Contents (Color & Size Breakdown)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItemRow}
                  className="text-xs text-blue-400 border-slate-800 hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Line
                </Button>
              </div>

              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800/80"
                >
                  <div className="col-span-4">
                    <Input
                      placeholder="Color (e.g. NAVY)"
                      value={item.color}
                      onChange={(e) => handleItemChange(idx, "color", e.target.value.toUpperCase())}
                      className="bg-slate-900 border-slate-800 text-xs"
                      required
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      placeholder="Size (e.g. M)"
                      value={item.size}
                      onChange={(e) => handleItemChange(idx, "size", e.target.value.toUpperCase())}
                      className="bg-slate-900 border-slate-800 text-xs"
                      required
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="number"
                      placeholder="Qty"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value) || 0)}
                      className="bg-slate-900 border-slate-800 text-xs font-bold"
                      required
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="text-right text-xs text-slate-400 font-medium">
                Total Carton Units:{" "}
                <span className="text-slate-200 font-bold">
                  {items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} pcs
                </span>
              </div>
            </div>
          ) : (
            /* RATIO PACK ASSORTMENT */
            <div className="space-y-4 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Pre-Pack Ratio Configuration
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Assortment ratio defines how many units per size compose 1 pack.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Packs in Carton:</span>
                  <Input
                    type="number"
                    min={1}
                    value={ratioPacksCount}
                    onChange={(e) => setRatioPacksCount(parseInt(e.target.value) || 1)}
                    className="w-20 bg-slate-950 border-slate-800 text-xs font-bold text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Color</label>
                  <Input
                    value={ratioColor}
                    onChange={(e) => setRatioColor(e.target.value.toUpperCase())}
                    className="bg-slate-950 border-slate-800 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Ratio Sum: {ratioSizes.reduce((s, r) => s + Number(r.ratio), 0)} pcs/pack
                  </label>
                  <div className="text-xs font-mono text-purple-400 pt-2">
                    Total Carton = {ratioSizes.reduce((s, r) => s + Number(r.ratio), 0) * ratioPacksCount} pcs
                  </div>
                </div>
              </div>

              {/* Ratio Sizes Inputs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ratioSizes.map((r, idx) => (
                  <div key={idx} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <div className="text-xs font-bold text-slate-300 text-center mb-1">{r.size}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">Ratio:</span>
                      <Input
                        type="number"
                        min={1}
                        value={r.ratio}
                        onChange={(e) => {
                          const updated = [...ratioSizes];
                          updated[idx].ratio = parseInt(e.target.value) || 0;
                          setRatioSizes(updated);
                        }}
                        className="bg-slate-900 border-slate-800 text-xs text-center font-semibold"
                      />
                    </div>
                    <div className="text-[10px] text-center text-slate-400 mt-1">
                      {Number(r.ratio) * ratioPacksCount} pcs total
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Physical Specs & Notes */}
          <div className="grid grid-cols-3 gap-3 border-t border-slate-800 pt-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Gross Wt (kg)</label>
              <Input
                type="number"
                step="0.1"
                value={grossWeightKg}
                onChange={(e) => setGrossWeightKg(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Net Wt (kg)</label>
              <Input
                type="number"
                step="0.1"
                value={netWeightKg}
                onChange={(e) => setNetWeightKg(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Dimensions (cm)</label>
              <Input
                placeholder="60x40x30"
                value={dimensionsCm}
                onChange={(e) => setDimensionsCm(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPackModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={packCartonMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {packCartonMutation.isPending ? "Validating & Packing..." : "Confirm & Pack Carton"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Carton Details & Barcode Label Modal */}
      <Dialog
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={activeCarton ? `Carton ${activeCarton.cartonNumber}` : "Carton Details"}
        maxWidth="lg"
      >
        {activeCarton && (
          <div className="space-y-5">
            {/* GS1-128 / SSCC-18 Barcode Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-center">
              <div className="text-xs uppercase font-mono tracking-widest text-slate-400 mb-1">
                GS1-128 LOGISTIC UNIT IDENTIFIER (SSCC-18)
              </div>
              <div className="text-xl font-mono font-black text-emerald-400 tracking-wider">
                (00) {activeCarton.ssccBarcode}
              </div>
              <div className="mt-3 py-2 bg-white text-black font-mono text-xs rounded border border-slate-300 inline-block px-4">
                ||| | |||| | ||| ||||| ||| || |||| ||| |||| ||||
              </div>
              <div className="text-[10px] text-slate-500 mt-2">
                Deterministic Modulo-10 Checksum Verified • Application Identifier (00)
              </div>
            </div>

            {/* Spec grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Mode</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  {activeCarton.packingMode}
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Total Units</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  {activeCarton.totalUnits} pcs
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Gross Weight</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  {activeCarton.grossWeightKg ? `${activeCarton.grossWeightKg} kg` : "N/A"}
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Dimensions</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  {activeCarton.dimensionsCm || "N/A"}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Packaged SKU Breakdown
              </div>
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Production Order</th>
                      <th className="py-2.5 px-3">Color</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {activeCarton.items && activeCarton.items.length > 0 ? (
                      activeCarton.items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-950/60">
                          <td className="py-2.5 px-3 font-medium">
                            {item.productionOrder?.orderNumber || "—"}
                          </td>
                          <td className="py-2.5 px-3">{item.color}</td>
                          <td className="py-2.5 px-3 font-semibold text-blue-400">{item.size}</td>
                          <td className="py-2.5 px-3 text-right font-bold">{item.quantity} pcs</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-3 text-center text-slate-500">
                          No carton line items recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              {can("PACKING:WRITE") && activeCarton.status === "PACKED" ? (
                <Button
                  variant="ghost"
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs"
                  onClick={() => handleCancelCarton(activeCarton)}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel Carton
                </Button>
              ) : (
                <div />
              )}
              <Button
                variant="outline"
                className="text-xs border-slate-800 text-slate-300"
                onClick={() => setDetailsModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
