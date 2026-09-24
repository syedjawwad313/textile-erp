"use client";

import React, { useState } from "react";
import { usePermissions } from "../../../hooks/use-permissions";
import { useAuth } from "../../../lib/auth/auth-context";
import {
  useShipments,
  useCreateShipment,
  useCancelShipment,
} from "../../../hooks/use-shipping";
import { usePackingLists, useCartons } from "../../../hooks/use-packing";
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
  Truck,
  Plus,
  Boxes,
  Eye,
  CheckCircle2,
  Anchor,
  Globe,
  Ban,
  PackageCheck,
  Calendar,
  Layers,
} from "lucide-react";
import {
  Shipment,
  ShipmentStatus,
  Buyer,
  BuyerPo,
  Carton,
  PackingList,
} from "../../../lib/api/types";
import { ExportButton } from "../../../components/export/export-button";

export default function ShipmentsPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeShipment, setActiveShipment] = useState<Shipment | null>(null);

  // Form State
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const [selectedBuyerPoId, setSelectedBuyerPoId] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [destinationPort, setDestinationPort] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [shippingMarks, setShippingMarks] = useState("");
  const [plannedShipDate, setPlannedShipDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCartonIds, setSelectedCartonIds] = useState<string[]>([]);
  const [selectedPackingListIds, setSelectedPackingListIds] = useState<string[]>([]);

  // Queries
  const {
    data: shipments = [],
    isLoading,
    refetch,
  } = useShipments({
    status: selectedStatus || undefined,
    search: searchQuery || undefined,
  });

  const { data: buyers = [] } = useQuery({
    queryKey: ["buyers-list"],
    queryFn: () => api.get<Buyer[]>("/master-data/buyers"),
    enabled: isAuthenticated && createModalOpen,
  });

  const { data: buyerPos = [] } = useQuery({
    queryKey: ["buyer-pos-list", selectedBuyerId],
    queryFn: () => api.get<BuyerPo[]>("/procurement/buyer-pos"),
    enabled: isAuthenticated && createModalOpen && Boolean(selectedBuyerId),
  });

  // Available packing lists (FINALIZED)
  const { data: packingLists = [] } = usePackingLists({
    status: "FINALIZED",
  });

  // Available cartons (not shipped, not cancelled, not already on a shipment)
  const { data: availableCartons = [] } = useCartons({
    status: "STAGED",
  });

  const createShipmentMutation = useCreateShipment();
  const cancelShipmentMutation = useCancelShipment();

  const filteredBuyerPos = selectedBuyerId
    ? buyerPos.filter((p) => p.buyerId === selectedBuyerId)
    : buyerPos;

  // Compute KPIs
  const totalShipments = shipments.length;
  const dispatchedShipments = shipments.filter((s) => s.status === "DISPATCHED").length;
  const draftShipments = shipments.filter((s) => s.status === "DRAFT").length;
  const totalUnitsShipped = shipments
    .filter((s) => s.status === "DISPATCHED")
    .reduce((acc, s) => acc + (s.totalUnits || 0), 0);

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuyerId) {
      toast.error("Validation Error", "Please select a Buyer");
      return;
    }

    try {
      await createShipmentMutation.mutateAsync({
        data: {
          buyerId: selectedBuyerId,
          buyerPoId: selectedBuyerPoId || undefined,
          carrier: carrier || undefined,
          trackingNumber: trackingNumber || undefined,
          containerNumber: containerNumber || undefined,
          destinationPort: destinationPort || undefined,
          destinationCountry: destinationCountry || undefined,
          shippingMarks: shippingMarks || undefined,
          plannedShipDate: plannedShipDate || undefined,
          cartonIds: selectedCartonIds.length > 0 ? selectedCartonIds : undefined,
          packingListIds: selectedPackingListIds.length > 0 ? selectedPackingListIds : undefined,
          notes: notes || undefined,
        },
        idempotencyKey: `shp-create-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      });

      toast.success("Shipment Created", "Shipment created successfully");
      setCreateModalOpen(false);
      resetForm();
      refetch();
    } catch (err: any) {
      toast.error("Failed to Create Shipment", err?.message || "Failed to create shipment");
    }
  };

  const handleCancelShipment = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this shipment? All reserved cartons will be released.")) {
      return;
    }
    try {
      await cancelShipmentMutation.mutateAsync({ id, reason: "Cancelled by user" });
      toast.success("Shipment Cancelled", "Shipment cancelled and cartons released");
      refetch();
    } catch (err: any) {
      toast.error("Failed to Cancel Shipment", err?.message || "Failed to cancel shipment");
    }
  };

  const resetForm = () => {
    setSelectedBuyerId("");
    setSelectedBuyerPoId("");
    setCarrier("");
    setTrackingNumber("");
    setContainerNumber("");
    setDestinationPort("");
    setDestinationCountry("");
    setShippingMarks("");
    setPlannedShipDate("");
    setNotes("");
    setSelectedCartonIds([]);
    setSelectedPackingListIds([]);
  };

  if (!can("SHIPPING:READ") && !can("PACKING:READ") && !can("WAREHOUSE:READ")) {
    return <ForbiddenState moduleName="Outbound Shipments" requiredPermission="SHIPPING:READ" />;
  }

  const columns: ColumnDef<Shipment>[] = [
    {
      header: "Shipment #",
      accessorKey: "shipmentNumber",
      cell: (row) => (
        <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
          {row.shipmentNumber}
        </div>
      ),
    },
    {
      header: "Buyer / PO",
      cell: (row) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">{row.buyer?.name || "N/A"}</div>
          <div className="text-xs text-slate-500">{row.buyerPo?.poNumber ? `PO: ${row.buyerPo.poNumber}` : "General PO"}</div>
        </div>
      ),
    },
    {
      header: "Carrier / Tracking",
      cell: (row) => (
        <div className="text-sm">
          <div className="font-medium text-slate-800 dark:text-slate-200">{row.carrier || "Unassigned"}</div>
          <div className="text-xs text-slate-500">{row.trackingNumber || row.containerNumber || "No B/L"}</div>
        </div>
      ),
    },
    {
      header: "Destination",
      cell: (row) => (
        <div className="text-xs text-slate-600 dark:text-slate-300">
          <div>{row.destinationPort || "—"}</div>
          <div className="text-slate-400">{row.destinationCountry || ""}</div>
        </div>
      ),
    },
    {
      header: "Packages",
      cell: (row) => (
        <div className="text-sm">
          <span className="font-semibold text-slate-900 dark:text-white">{row.totalCartons}</span>
          <span className="text-xs text-slate-500 ml-1">ctns</span>
          <div className="text-xs text-slate-500">{row.totalUnits.toLocaleString()} units</div>
        </div>
      ),
    },
    {
      header: "Weight & Volume",
      cell: (row) => (
        <div className="text-xs text-slate-600 dark:text-slate-300">
          <div>GW: {Number(row.totalGrossWeightKg || 0).toFixed(1)} kg</div>
          <div>CBM: {Number(row.totalCbm || 0).toFixed(2)} m³</div>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (row) => {
        let variant: "default" | "success" | "warning" | "danger" = "default";
        if (row.status === "DISPATCHED" || row.status === "DELIVERED") variant = "success";
        else if (row.status === "STAGED" || row.status === "LOADED") variant = "warning";
        else if (row.status === "CANCELLED") variant = "danger";
        return <Badge variant={variant}>{row.status}</Badge>;
      },
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs flex items-center gap-1"
            onClick={() => {
              setActiveShipment(row);
              setDetailModalOpen(true);
            }}
          >
            <Eye className="w-3.5 h-3.5" /> View
          </Button>
          {row.status !== "DISPATCHED" && row.status !== "DELIVERED" && row.status !== "CANCELLED" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => handleCancelShipment(row.id)}
            >
              <Ban className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outbound Shipments"
        description="Consolidate cartons and finalized packing lists into export shipments, manage freight booking, and prepare for gate dispatch."
        actions={
          <div className="flex items-center gap-3">
            <ExportButton entity="SHIPMENT" />
            {can("SHIPPING:WRITE") && (
              <Button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" /> Create Shipment
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Shipments</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{totalShipments}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Dispatched Shipments</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{dispatchedShipments}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Draft / Pending</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{draftShipments}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Dispatched Units</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {totalUnitsShipped.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search shipment, carrier, container..."
            className="w-64"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="h-9 px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="STAGED">Staged</option>
            <option value="LOADED">Loaded</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Shipments Table */}
      <DataTable
        columns={columns}
        data={shipments}
        isLoading={isLoading}
        emptyTitle="No Shipments"
        emptyDescription="No shipments found. Create your first export shipment to begin."
      />

      {/* Create Shipment Dialog */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Outbound Shipment">
        <form onSubmit={handleCreateShipment} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Buyer *
              </label>
              <select
                required
                value={selectedBuyerId}
                onChange={(e) => {
                  setSelectedBuyerId(e.target.value);
                  setSelectedBuyerPoId("");
                }}
                className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
              >
                <option value="">Select Buyer...</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Buyer PO (Optional)
              </label>
              <select
                value={selectedBuyerPoId}
                onChange={(e) => setSelectedBuyerPoId(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
              >
                <option value="">Select PO (Consolidated if blank)...</option>
                {filteredBuyerPos.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Carrier / Liner
              </label>
              <Input
                placeholder="e.g. Maersk, DHL"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tracking / B/L No
              </label>
              <Input
                placeholder="e.g. MSKU123456"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Container No
              </label>
              <Input
                placeholder="e.g. TGHU908234"
                value={containerNumber}
                onChange={(e) => setContainerNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Destination Port
              </label>
              <Input
                placeholder="e.g. Port of Rotterdam"
                value={destinationPort}
                onChange={(e) => setDestinationPort(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Destination Country
              </label>
              <Input
                placeholder="e.g. Germany"
                value={destinationCountry}
                onChange={(e) => setDestinationCountry(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Finalized Packing Lists to Assign
            </label>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 max-h-36 overflow-y-auto space-y-1 text-xs">
              {packingLists.length === 0 ? (
                <div className="text-slate-400 p-2 text-center">No finalized packing lists available.</div>
              ) : (
                packingLists.map((pl) => (
                  <label key={pl.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPackingListIds.includes(pl.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPackingListIds([...selectedPackingListIds, pl.id]);
                        } else {
                          setSelectedPackingListIds(selectedPackingListIds.filter((id) => id !== pl.id));
                        }
                      }}
                    />
                    <span className="font-mono font-medium">{pl.packingListNumber}</span>
                    <span className="text-slate-500">({pl.totalCartons} ctns, {pl.totalUnits} pcs)</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes / Instructions
            </label>
            <Input
              placeholder="e.g. Temperature controlled, handle with care"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createShipmentMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createShipmentMutation.isPending ? "Creating..." : "Create Shipment"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Detail Modal */}
      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={activeShipment ? `Shipment: ${activeShipment.shipmentNumber}` : "Shipment Details"}
      >
        {activeShipment && (
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-500">Buyer:</span>{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {activeShipment.buyer?.name}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Status:</span>{" "}
                <Badge variant={activeShipment.status === "DISPATCHED" ? "success" : "default"}>
                  {activeShipment.status}
                </Badge>
              </div>
              <div>
                <span className="text-slate-500">Carrier:</span>{" "}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {activeShipment.carrier || "Unassigned"}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Tracking/BL:</span>{" "}
                <span className="font-mono">{activeShipment.trackingNumber || "—"}</span>
              </div>
              <div>
                <span className="text-slate-500">Destination:</span>{" "}
                <span>
                  {activeShipment.destinationPort || "—"}, {activeShipment.destinationCountry || ""}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Total Packages:</span>{" "}
                <span className="font-bold">{activeShipment.totalCartons} cartons ({activeShipment.totalUnits} pcs)</span>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Itemized Style Summary
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="p-2">Style</th>
                      <th className="p-2 text-right">Cartons</th>
                      <th className="p-2 text-right">Units</th>
                      <th className="p-2 text-right">Est. GW</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeShipment.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2 font-medium">{item.style?.name || item.styleId}</td>
                        <td className="p-2 text-right">{item.cartonCount}</td>
                        <td className="p-2 text-right font-semibold">{item.totalUnits}</td>
                        <td className="p-2 text-right">{Number(item.grossWeightKg || 0).toFixed(1)} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-700">
              <Button onClick={() => setDetailModalOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
