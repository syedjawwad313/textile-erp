"use client";

import React, { useState } from "react";
import { usePermissions } from "../../../hooks/use-permissions";
import { useAuth } from "../../../lib/auth/auth-context";
import {
  useMaterialReservations,
  useCreateReservation,
  useReleaseReservation,
} from "../../../hooks/use-reservations";
import { useFabricRolls } from "../../../hooks/use-fabric-rolls";
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
  Lock,
  Unlock,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  FileText,
} from "lucide-react";
import {
  MaterialReservation,
  MaterialReservationLine,
  ProductionOrder,
  Material,
  FabricRoll,
} from "../../../lib/api/types";

export default function MaterialReservationsPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<MaterialReservation | null>(null);

  // Form state
  const [productionOrderId, setProductionOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [resLines, setResLines] = useState<
    Array<{
      materialId: string;
      quantity: number;
      selectedRollIds: string[];
    }>
  >([{ materialId: "", quantity: 0, selectedRollIds: [] }]);

  const {
    data: reservations = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useMaterialReservations();

  // Reference queries
  const { data: orders = [] } = useQuery({
    queryKey: ["production-orders-active"],
    queryFn: () => api.get<ProductionOrder[]>("/production/orders"),
    enabled: isAuthenticated && createModalOpen,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: () => api.get<Material[]>("/materials"),
    enabled: isAuthenticated && createModalOpen,
  });

  const { data: availableRolls = [] } = useFabricRolls({
    status: "INSPECTED_PASSED",
  });

  const createResMutation = useCreateReservation();
  const releaseResMutation = useReleaseReservation();

  const handleAddLine = () => {
    setResLines([...resLines, { materialId: "", quantity: 0, selectedRollIds: [] }]);
  };

  const handleUpdateLine = (index: number, field: string, value: any) => {
    const updated = [...resLines];
    updated[index] = { ...updated[index], [field]: value };
    setResLines(updated);
  };

  const handleToggleRoll = (lineIdx: number, rollId: string) => {
    const updated = [...resLines];
    const current = updated[lineIdx].selectedRollIds;
    if (current.includes(rollId)) {
      updated[lineIdx].selectedRollIds = current.filter((id) => id !== rollId);
    } else {
      updated[lineIdx].selectedRollIds = [...current, rollId];
    }
    // Auto-update quantity based on selected rolls if fabric
    const selectedLength = availableRolls
      .filter((r) => updated[lineIdx].selectedRollIds.includes(r.id))
      .reduce((sum, r) => sum + Number(r.netLength), 0);
    if (selectedLength > 0) {
      updated[lineIdx].quantity = selectedLength;
    }
    setResLines(updated);
  };

  const handleCreateReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productionOrderId) {
      toast.error("Validation Error", "Please select a Production Order.");
      return;
    }
    for (const l of resLines) {
      if (!l.materialId || l.quantity <= 0) {
        toast.error("Validation Error", "Each line must specify a material and quantity > 0.");
        return;
      }
    }

    createResMutation.mutate(
      {
        data: {
          productionOrderId,
          notes: notes || undefined,
          lines: resLines.map((l) => ({
            materialId: l.materialId,
            quantity: Number(l.quantity),
            rollIds: l.selectedRollIds.length > 0 ? l.selectedRollIds : undefined,
          })),
        },
        idempotencyKey: `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
      {
        onSuccess: () => {
          toast.success("Reservation Created", "Materials and rolls successfully hard-reserved.");
          setCreateModalOpen(false);
          setProductionOrderId("");
          setNotes("");
          setResLines([{ materialId: "", quantity: 0, selectedRollIds: [] }]);
        },
        onError: (err: any) => {
          toast.error("Reservation Failed", err?.message || "Could not complete reservation.");
        },
      }
    );
  };

  const handleReleaseReservation = (id: string, resNumber: string) => {
    if (confirm(`Release reservation ${resNumber}? This will unreserve stock and unlock fabric rolls.`)) {
      releaseResMutation.mutate(id, {
        onSuccess: () => {
          toast.success("Reservation Released", `${resNumber} stock allocations returned to available pool.`);
          if (selectedRes?.id === id) setDetailsModalOpen(false);
        },
        onError: (err: any) => {
          toast.error("Release Failed", err?.message || "Failed to release reservation.");
        },
      });
    }
  };

  const columns: ColumnDef<MaterialReservation>[] = [
    {
      header: "Reservation No",
      accessorKey: "reservationNumber",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-amber-50 text-amber-600">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-slate-900 block">
              {row.reservationNumber}
            </span>
            <span className="text-[10px] text-slate-400">
              {new Date(row.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Production Order",
      cell: (row) => (
        <div className="text-xs">
          <span className="font-mono font-bold text-slate-900 block">
            {row.productionOrder?.orderNumber || "PO-UNLINKED"}
          </span>
          <span className="text-[11px] text-slate-500">
            Status: {row.productionOrder?.status || "N/A"}
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        const variant =
          row.status === "ACTIVE"
            ? "warning"
            : row.status === "CONSUMED"
            ? "success"
            : "secondary";
        return (
          <Badge variant={variant as any} size="sm">
            {row.status}
          </Badge>
        );
      },
    },
    {
      header: "Reserved Lines",
      cell: (row) => {
        const totalQty = row.lines?.reduce((sum, l) => sum + Number(l.quantity), 0) || 0;
        return (
          <div className="text-xs">
            <span className="font-medium text-slate-800 block">{row.lines?.length || 0} Materials</span>
            <span className="font-mono text-amber-700 font-semibold text-[11px]">
              {totalQty.toLocaleString()} units reserved
            </span>
          </div>
        );
      },
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedRes(row);
              setDetailsModalOpen(true);
            }}
            className="h-7 text-xs"
          >
            Details
          </Button>
          {row.status === "ACTIVE" && can("RESERVATION:WRITE") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReleaseReservation(row.id, row.reservationNumber)}
              isLoading={releaseResMutation.isPending}
              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              <Unlock className="w-3 h-3 mr-1" />
              Release
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!can("RESERVATION:READ")) {
    return (
      <ForbiddenState
        requiredPermission="RESERVATION:READ"
        moduleName="Material Reservations & Allocations"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material Reservations & Roll Allocations"
        description="Pessimistic hard reservations against Production Orders ensuring raw material availability before cutting."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Materials & Warehouse", href: "/inventory" },
          { label: "Reservations" },
        ]}
        actions={
          can("RESERVATION:WRITE") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Material Reservation
            </Button>
          )
        }
      />

      <DataTable
        title="Production Material Reservations"
        subtitle="Stock allocations tied to production orders with fabric roll locking"
        columns={columns}
        data={reservations}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as any)?.message}
        onRetry={refetch}
        searchKey="reservationNumber"
        searchPlaceholder="Search by reservation number..."
        emptyTitle="No Material Reservations Found"
        emptyDescription="Create a reservation to allocate stock or rolls to a production order."
      />

      {/* Reservation Details Modal */}
      <Dialog
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedRes(null);
        }}
        title={`Reservation Details: ${selectedRes?.reservationNumber || ""}`}
        description={`Status: ${selectedRes?.status || ""}`}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          <div className="bg-slate-50 p-3 rounded-lg grid grid-cols-2 gap-3">
            <div>
              <span className="text-slate-500 block">Production Order:</span>
              <span className="font-mono font-bold text-slate-900">
                {selectedRes?.productionOrder?.orderNumber}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Reserved Date:</span>
              <span className="text-slate-800">
                {selectedRes?.createdAt ? new Date(selectedRes.createdAt).toLocaleString() : ""}
              </span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-3 py-2 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Allocated Material Lines
            </div>
            <div className="divide-y divide-slate-100">
              {selectedRes?.lines?.map((line: MaterialReservationLine) => (
                <div key={line.id} className="p-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">
                      {line.material?.code} - {line.material?.name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      UOM: {line.material?.uom} | Category: {line.material?.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-amber-700 block">
                      {line.quantity} {line.material?.uom}
                    </span>
                    <span className="text-[10px] text-slate-400">Locked to Order</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            {selectedRes?.status === "ACTIVE" && can("RESERVATION:WRITE") ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectedRes && handleReleaseReservation(selectedRes.id, selectedRes.reservationNumber)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
              >
                Release Allocation
              </Button>
            ) : (
              <div />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                setSelectedRes(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Create Reservation Modal */}
      <Dialog
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Material Reservation"
        description="Allocate inventory quantities or specific inspected fabric rolls to a production order."
      >
        <form onSubmit={handleCreateReservation} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Production Order *</label>
            <select
              className="w-full text-xs rounded border border-slate-200 bg-white p-2 text-slate-900"
              value={productionOrderId}
              onChange={(e) => setProductionOrderId(e.target.value)}
              required
            >
              <option value="">Select Production Order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} ({o.quantity} pcs)
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Reservation Notes"
            placeholder="e.g. Fabric allocated for batch cut schedule"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {/* Lines */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Reservation Lines
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddLine}
                className="h-6 text-[11px]"
              >
                + Add Material Line
              </Button>
            </div>

            {resLines.map((line, idx) => (
              <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-slate-50/60 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-medium text-slate-600 block mb-1 text-[11px]">
                      Material *
                    </label>
                    <select
                      className="w-full text-xs rounded border border-slate-200 bg-white p-1.5"
                      value={line.materialId}
                      onChange={(e) => handleUpdateLine(idx, "materialId", e.target.value)}
                      required
                    >
                      <option value="">Select Material</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code} - {m.name} ({m.uom})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Input
                      label="Quantity to Reserve *"
                      type="number"
                      value={line.quantity.toString()}
                      onChange={(e) => handleUpdateLine(idx, "quantity", e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Roll selection preview if material is selected */}
                {line.materialId && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Available Inspected Rolls (Optional Hard Allocation):
                    </span>
                    <div className="max-h-28 overflow-y-auto space-y-1 bg-white p-2 rounded border border-slate-200">
                      {availableRolls.filter((r) => r.materialId === line.materialId).length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">
                          No passed rolls in stock for this material.
                        </span>
                      ) : (
                        availableRolls
                          .filter((r) => r.materialId === line.materialId)
                          .map((roll) => {
                            const isSelected = line.selectedRollIds.includes(roll.id);
                            return (
                              <div
                                key={roll.id}
                                onClick={() => handleToggleRoll(idx, roll.id)}
                                className={`p-1.5 rounded cursor-pointer flex items-center justify-between text-[11px] transition-colors ${
                                  isSelected
                                    ? "bg-amber-100 border border-amber-300 font-semibold"
                                    : "hover:bg-slate-50 border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    readOnly
                                    className="rounded"
                                  />
                                  <span className="font-mono">{roll.barcode}</span>
                                  <span className="text-slate-500">
                                    Lot: {roll.dyeLot || "Std"} | Shade: {roll.shade || "Std"}
                                  </span>
                                </div>
                                <span className="font-mono text-slate-700">
                                  {roll.netLength} yds
                                </span>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              disabled={createResMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createResMutation.isPending}
            >
              Confirm Reservation
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
