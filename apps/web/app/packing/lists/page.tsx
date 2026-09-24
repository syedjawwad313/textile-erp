"use client";

import React, { useState } from "react";
import { usePermissions } from "../../../hooks/use-permissions";
import { useAuth } from "../../../lib/auth/auth-context";
import {
  usePackingLists,
  useCreatePackingList,
  useFinalizePackingList,
  useCartons,
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
  ClipboardCheck,
  Plus,
  Boxes,
  Barcode,
  Eye,
  CheckCircle2,
  FileSpreadsheet,
  Building2,
  MapPin,
  Anchor,
  Calendar,
  Lock,
} from "lucide-react";
import {
  PackingList,
  PackingListStatus,
  CreatePackingListDto,
  Buyer,
  BuyerPo,
  ProductionOrder,
  Carton,
} from "../../../lib/api/types";

export default function PackingListsPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [activeList, setActiveList] = useState<PackingList | null>(null);

  // Queries
  const {
    data: lists = [],
    isLoading,
    refetch,
  } = usePackingLists({
    status: selectedStatus || undefined,
  });

  const { data: buyers = [] } = useQuery({
    queryKey: ["buyers"],
    queryFn: () => api.get<Buyer[]>("/buyers"),
    enabled: isAuthenticated && createModalOpen,
  });

  const { data: buyerPos = [] } = useQuery({
    queryKey: ["buyer-pos"],
    queryFn: () => api.get<BuyerPo[]>("/buyer-pos"),
    enabled: isAuthenticated && createModalOpen,
  });

  const { data: productionOrders = [] } = useQuery({
    queryKey: ["production-orders"],
    queryFn: () => api.get<ProductionOrder[]>("/production/orders"),
    enabled: isAuthenticated && createModalOpen,
  });

  // Query unassigned cartons to attach to a new list
  const { data: availableCartons = [] } = useCartons({
    status: "PACKED",
  });
  const unassignedCartons = availableCartons.filter((c) => !c.packingListId);

  // Create Form State
  const [listNumber, setListNumber] = useState("");
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [selectedBuyerPoId, setSelectedBuyerPoId] = useState("");
  const [selectedPoId, setSelectedPoId] = useState("");
  const [destination, setDestination] = useState("ROTTERDAM PORT, NETHERLANDS");
  const [shippingMark, setShippingMark] = useState("FRAGILE / DRY CARGO / APPAREL");
  const [notes, setNotes] = useState("");
  const [selectedCartonIds, setSelectedCartonIds] = useState<string[]>([]);

  // Mutations
  const createListMutation = useCreatePackingList();
  const finalizeListMutation = useFinalizePackingList();

  if (!can("PACKING:READ")) {
    return (
      <ForbiddenState
        requiredPermission="PACKING:READ"
        moduleName="Commercial Packing Lists"
      />
    );
  }

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: CreatePackingListDto = {
      listNumber: listNumber.trim() || undefined,
      buyerId: selectedBuyerId || undefined,
      buyerPoId: selectedBuyerPoId || undefined,
      productionOrderId: selectedPoId || undefined,
      destination: destination.trim() || undefined,
      shippingMark: shippingMark.trim() || undefined,
      notes: notes.trim() || undefined,
      cartonIds: selectedCartonIds.length > 0 ? selectedCartonIds : undefined,
    };

    try {
      const idempotencyKey = `plist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      await createListMutation.mutateAsync({ data: payload, idempotencyKey });
      toast.success("Success", "Master Packing List created successfully!");
      setCreateModalOpen(false);
      resetCreateForm();
      refetch();
    } catch (err: any) {
      toast.error("Creation Failed", err.message || "Failed to create packing list");
    }
  };

  const resetCreateForm = () => {
    setListNumber("");
    setSelectedBuyerId("");
    setSelectedBuyerPoId("");
    setSelectedPoId("");
    setSelectedCartonIds([]);
    setNotes("");
  };

  const handleToggleCarton = (id: string) => {
    setSelectedCartonIds((prev) =>
      prev.includes(id) ? prev.filter((cId) => cId !== id) : [...prev, id]
    );
  };

  // Finalize List
  const handleFinalizeList = async (list: PackingList) => {
    if (!confirm(`Finalize packing list ${list.listNumber}? Once finalized, carton contents are frozen.`)) {
      return;
    }
    try {
      const idempotencyKey = `finalize-${list.id}-${Date.now()}`;
      await finalizeListMutation.mutateAsync({ id: list.id, idempotencyKey });
      toast.success("Manifest Finalized", `Packing list ${list.listNumber} finalized!`);
      setManifestModalOpen(false);
      refetch();
    } catch (err: any) {
      toast.error("Finalization Failed", err.message || "Failed to finalize packing list");
    }
  };

  // Metrics
  const totalLists = lists.length;
  const draftLists = lists.filter((l) => l.status === "DRAFT").length;
  const finalizedLists = lists.filter((l) => l.status === "FINALIZED").length;
  const totalManifestUnits = lists.reduce((sum, l) => sum + (l.status !== "CANCELLED" ? l.totalUnits : 0), 0);

  // Table Columns
  const columns: ColumnDef<PackingList>[] = [
    {
      header: "List Number",
      accessorKey: "listNumber",
      cell: (list) => (
        <div>
          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 text-blue-400" />
            {list.listNumber}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {list.buyer?.name || "Global Buyer"}
          </div>
        </div>
      ),
    },
    {
      header: "Cartons & Units",
      accessorKey: "totalCartons",
      cell: (list) => (
        <div>
          <div className="font-bold text-slate-200">
            {list.totalCartons} <span className="text-xs font-normal text-slate-400">cartons</span>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            {list.totalUnits} pcs total
          </div>
        </div>
      ),
    },
    {
      header: "Destination",
      accessorKey: "destination",
      cell: (list) => (
        <div className="text-xs text-slate-300 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate max-w-[200px]">{list.destination || "Port of Discharge"}</span>
        </div>
      ),
    },
    {
      header: "Weight (Gross/Net)",
      accessorKey: "totalGrossWeightKg",
      cell: (list) => (
        <div className="text-xs text-slate-400">
          <div>{list.totalGrossWeightKg ? `${list.totalGrossWeightKg.toFixed(1)} kg GWT` : "—"}</div>
          <div>{list.totalNetWeightKg ? `${list.totalNetWeightKg.toFixed(1)} kg NWT` : "—"}</div>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (list) => {
        const styles: Record<PackingListStatus, string> = {
          DRAFT: "bg-amber-950 text-amber-300 border-amber-800",
          FINALIZED: "bg-blue-950 text-blue-300 border-blue-800",
          DISPATCHED: "bg-emerald-950 text-emerald-300 border-emerald-800",
          CANCELLED: "bg-rose-950 text-rose-300 border-rose-800",
        };
        return <Badge className={styles[list.status] || ""}>{list.status}</Badge>;
      },
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (list) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setActiveList(list);
              setManifestModalOpen(true);
            }}
          >
            <Eye className="w-3.5 h-3.5 text-blue-400 mr-1" /> Manifest
          </Button>
          {can("PACKING:WRITE") && list.status === "DRAFT" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30"
              onClick={() => handleFinalizeList(list)}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Finalize
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Master Packing Lists & Shipping Manifests"
        description="Aggregate discrete cartons into first-class commercial packing manifests with weight conservation and SSCC traceability"
        actions={
          can("PACKING:WRITE") && (
            <Button
              onClick={() => {
                resetCreateForm();
                setCreateModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Packing List
            </Button>
          )
        }
      />

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-950/60 text-blue-400 rounded-lg border border-blue-800/40">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-medium tracking-wider text-slate-400">
              Total Packing Lists
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{totalLists}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-950/60 text-amber-400 rounded-lg border border-amber-800/40">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-medium tracking-wider text-slate-400">
              Draft Manifests
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{draftLists}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-950/60 text-emerald-400 rounded-lg border border-emerald-800/40">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-medium tracking-wider text-slate-400">
              Finalized Manifests
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">{finalizedLists}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-950/60 text-purple-400 rounded-lg border border-purple-800/40">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs uppercase font-medium tracking-wider text-slate-400">
              Manifested Units
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">
              {totalManifestUnits} <span className="text-sm font-normal text-slate-400">pcs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search Manifest Number..."
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
            <option value="DRAFT">DRAFT</option>
            <option value="FINALIZED">FINALIZED</option>
            <option value="DISPATCHED">DISPATCHED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing {lists.length} packing lists
        </div>
      </div>

      {/* Packing Lists Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <DataTable
          columns={columns}
          data={lists}
          isLoading={isLoading}
          searchKey="listNumber"
        />
      </div>

      {/* Create Packing List Modal */}
      <Dialog
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Master Commercial Packing List"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                List Number (Auto if blank)
              </label>
              <Input
                placeholder="PL-YYYYMMDD-XXXX"
                value={listNumber}
                onChange={(e) => setListNumber(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Buyer (Optional)</label>
              <select
                value={selectedBuyerId}
                onChange={(e) => setSelectedBuyerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Buyer...</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
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
              <label className="block text-xs text-slate-400 mb-1">Destination Port</label>
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Shipping Marks</label>
            <Input
              value={shippingMark}
              onChange={(e) => setShippingMark(e.target.value)}
              className="bg-slate-950 border-slate-800 text-slate-200 text-sm"
            />
          </div>

          {/* Cartons Selection */}
          <div className="border-t border-slate-800 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Attach Unassigned Packed Cartons ({unassignedCartons.length} available)
              </label>
              <span className="text-xs text-blue-400 font-medium">
                {selectedCartonIds.length} cartons selected
              </span>
            </div>

            {unassignedCartons.length === 0 ? (
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-center text-xs text-slate-500">
                No unassigned packed cartons found. Pack new cartons from the Carton Packaging terminal.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-800 rounded-lg p-2 bg-slate-950">
                {unassignedCartons.map((carton) => {
                  const isChecked = selectedCartonIds.includes(carton.id);
                  return (
                    <label
                      key={carton.id}
                      className={`flex items-center justify-between p-2.5 rounded border cursor-pointer transition-all ${
                        isChecked
                          ? "bg-blue-950/40 border-blue-800 text-slate-200"
                          : "bg-slate-900 border-slate-800/80 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCarton(carton.id)}
                          className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-200">
                            {carton.cartonNumber}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            SSCC: {carton.ssccBarcode}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <span className="font-bold text-slate-200">{carton.totalUnits} pcs</span>
                        <div className="text-[10px] text-slate-500">{carton.packingMode}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createListMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {createListMutation.isPending ? "Creating Manifest..." : "Create Packing List"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Manifest Viewer Modal */}
      <Dialog
        isOpen={manifestModalOpen}
        onClose={() => setManifestModalOpen(false)}
        title={activeList ? `Packing Manifest — ${activeList.listNumber}` : "Packing Manifest"}
        maxWidth="lg"
      >
        {activeList && (
          <div className="space-y-5">
            {/* Header info card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Status</div>
                <div className="mt-0.5">
                  <Badge
                    className={
                      activeList.status === "FINALIZED"
                        ? "bg-blue-950 text-blue-300 border-blue-800"
                        : "bg-amber-950 text-amber-300 border-amber-800"
                    }
                  >
                    {activeList.status}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Total Cartons</div>
                <div className="text-base font-bold text-slate-200 mt-0.5">
                  {activeList.totalCartons}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Total Units</div>
                <div className="text-base font-bold text-slate-200 mt-0.5">
                  {activeList.totalUnits} pcs
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase text-slate-500 font-semibold">Total Weight</div>
                <div className="text-xs text-slate-300 mt-0.5 font-medium">
                  {activeList.totalGrossWeightKg ? `${activeList.totalGrossWeightKg.toFixed(1)} kg GWT` : "N/A"}
                </div>
              </div>
            </div>

            {/* Destination & Marks */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500 font-medium">Destination: </span>
                <span className="text-slate-300 font-semibold">{activeList.destination || "N/A"}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Shipping Mark: </span>
                <span className="text-slate-300 font-semibold">{activeList.shippingMark || "N/A"}</span>
              </div>
            </div>

            {/* Cartons Table */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Cartons in this Manifest
              </div>
              <div className="border border-slate-800 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Carton #</th>
                      <th className="py-2.5 px-3">SSCC-18 Barcode</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3 text-right">Units</th>
                      <th className="py-2.5 px-3 text-right">Gross Wt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {activeList.cartons && activeList.cartons.length > 0 ? (
                      activeList.cartons.map((carton) => (
                        <tr key={carton.id} className="hover:bg-slate-950/60">
                          <td className="py-2 px-3 font-semibold text-slate-100">
                            {carton.cartonNumber}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-emerald-400">
                            {carton.ssccBarcode}
                          </td>
                          <td className="py-2 px-3">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                              {carton.packingMode}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-bold">{carton.totalUnits} pcs</td>
                          <td className="py-2 px-3 text-right text-slate-400">
                            {carton.grossWeightKg ? `${carton.grossWeightKg} kg` : "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500">
                          No cartons attached to this manifest yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              {can("PACKING:WRITE") && activeList.status === "DRAFT" ? (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                  onClick={() => handleFinalizeList(activeList)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Finalize Manifest
                </Button>
              ) : (
                <div />
              )}
              <Button
                variant="outline"
                className="text-xs border-slate-800 text-slate-300"
                onClick={() => setManifestModalOpen(false)}
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
