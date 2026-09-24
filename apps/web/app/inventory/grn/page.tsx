"use client";

import React, { useState } from "react";
import { usePermissions } from "../../../hooks/use-permissions";
import { useAuth } from "../../../lib/auth/auth-context";
import { useGrns, useCreateGrn, usePostGrn } from "../../../hooks/use-grn";
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
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { GoodsReceiptNote, GrnLine, Material, Supplier, Warehouse, Bin } from "../../../lib/api/types";

export default function GoodsReceiptPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedGrn, setSelectedGrn] = useState<GoodsReceiptNote | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Form states
  const [supplierId, setSupplierId] = useState("");
  const [deliveryChallanNo, setDeliveryChallanNo] = useState("");
  const [gatePassNo, setGatePassNo] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [remarks, setRemarks] = useState("");

  // Line items state
  const [lines, setLines] = useState<
    Array<{
      materialId: string;
      binId: string;
      qtyReceived: number;
      qtyAccepted: number;
      qtyRejected: number;
      unitCost: number;
      lotNumber: string;
      shade: string;
      remarks: string;
    }>
  >([
    {
      materialId: "",
      binId: "",
      qtyReceived: 0,
      qtyAccepted: 0,
      qtyRejected: 0,
      unitCost: 0,
      lotNumber: "",
      shade: "",
      remarks: "",
    },
  ]);

  const {
    data: grns = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useGrns();

  // Reference queries for modal
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>("/suppliers"),
    enabled: isAuthenticated && createModalOpen,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: () => api.get<Material[]>("/materials"),
    enabled: isAuthenticated && createModalOpen,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api.get<Warehouse[]>("/warehouses"),
    enabled: isAuthenticated && createModalOpen,
  });

  const createGrnMutation = useCreateGrn();
  const postGrnMutation = usePostGrn();

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        materialId: "",
        binId: "",
        qtyReceived: 0,
        qtyAccepted: 0,
        qtyRejected: 0,
        unitCost: 0,
        lotNumber: "",
        shade: "",
        remarks: "",
      },
    ]);
  };

  const handleUpdateLine = (index: number, field: string, value: any) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "qtyReceived" && updated[index].qtyAccepted === 0) {
      updated[index].qtyAccepted = Number(value);
    }
    setLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const handleCreateGrn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Validation Error", "Please select a supplier.");
      return;
    }
    for (const line of lines) {
      if (!line.materialId || line.qtyReceived <= 0) {
        toast.error("Validation Error", "Each line must have a material and quantity received > 0.");
        return;
      }
    }

    createGrnMutation.mutate(
      {
        data: {
          supplierId,
          warehouseId: warehouses[0]?.id || "",
          deliveryChallanNumber: deliveryChallanNo || undefined,
          gatePassNumber: gatePassNo || undefined,
          notes: remarks || invoiceNo ? `Invoice: ${invoiceNo}. ${remarks}` : undefined,
          lines: lines.map((l) => ({
            materialId: l.materialId,
            binId: l.binId || undefined,
            receivedQuantity: Number(l.qtyReceived),
            uom: materials.find((m) => m.id === l.materialId)?.uom || "YDS",
          })),
        },
        idempotencyKey: `grn-create-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
      {
        onSuccess: () => {
          toast.success("GRN Created", "Goods Receipt Note created in Draft status.");
          setCreateModalOpen(false);
          setLines([
            {
              materialId: "",
              binId: "",
              qtyReceived: 0,
              qtyAccepted: 0,
              qtyRejected: 0,
              unitCost: 0,
              lotNumber: "",
              shade: "",
              remarks: "",
            },
          ]);
          setDeliveryChallanNo("");
          setGatePassNo("");
          setInvoiceNo("");
          setRemarks("");
        },
        onError: (err: any) => {
          toast.error("Creation Failed", err?.message || "Failed to create GRN.");
        },
      }
    );
  };

  const handlePostGrn = (id: string, grnNumber: string) => {
    if (confirm(`Post ${grnNumber} to Inventory Ledger? This will atomically update stock balances and generate fabric rolls.`)) {
      postGrnMutation.mutate(
        {
          id,
          idempotencyKey: `post-${id}-${Date.now()}`,
        },
        {
          onSuccess: () => {
            toast.success("GRN Posted", `${grnNumber} posted to Inventory Ledger successfully.`);
            if (selectedGrn?.id === id) {
              setDetailsModalOpen(false);
            }
          },
          onError: (err: any) => {
            toast.error("Posting Failed", err?.message || "Failed to post GRN to ledger.");
          },
        }
      );
    }
  };

  const columns: ColumnDef<GoodsReceiptNote>[] = [
    {
      header: "GRN Number",
      accessorKey: "grnNumber",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 text-blue-600">
            <Truck className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-slate-900 block">
              {row.grnNumber}
            </span>
            <span className="text-[10px] text-slate-400">
              {new Date(row.receivedDate).toLocaleDateString()}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Supplier",
      cell: (row) => (
        <div className="text-xs">
          <span className="font-medium text-slate-900 block">{row.supplier?.name || "N/A"}</span>
          <span className="text-slate-400 text-[11px] font-mono">{row.supplier?.code}</span>
        </div>
      ),
    },
    {
      header: "VPO / Challan",
      cell: (row) => (
        <div className="text-xs font-mono">
          <span className="font-semibold text-slate-800 block">
            {row.vpo?.vpoNumber || "Direct Receipt"}
          </span>
          <span className="text-slate-500 text-[11px]">
            {row.deliveryChallanNumber ? `DC: ${row.deliveryChallanNumber}` : "No DC"}
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        const variant =
          row.status === "RECEIVED" || row.status === "ACCEPTED"
            ? "success"
            : row.status === "DRAFT"
            ? "warning"
            : "secondary";
        return (
          <Badge variant={variant as any} size="sm">
            {row.status}
          </Badge>
        );
      },
    },
    {
      header: "Items / Qty",
      cell: (row) => {
        const totalQty = (row.grnLines || []).reduce((sum: number, l: GrnLine) => sum + Number(l.receivedQuantity || 0), 0);
        return (
          <div className="text-xs">
            <span className="font-medium text-slate-800 block">
              {row.grnLines?.length || 0} line items
            </span>
            <span className="font-mono font-semibold text-slate-600 text-[11px]">
              {totalQty.toLocaleString()} units
            </span>
          </div>
        );
      },
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedGrn(row);
              setDetailsModalOpen(true);
            }}
            className="h-7 text-xs"
          >
            Details
          </Button>
          {row.status === "DRAFT" && can("GRN:WRITE") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handlePostGrn(row.id, row.grnNumber)}
              isLoading={postGrnMutation.isPending}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              Post Ledger
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!can("GRN:READ")) {
    return (
      <ForbiddenState
        requiredPermission="GRN:READ"
        moduleName="Goods Receipt Notes (GRN)"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods Receipt Notes (GRN)"
        description="Inbound delivery receiving, physical inspection verification, and server-authoritative ledger posting."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Materials & Warehouse", href: "/inventory" },
          { label: "Goods Receipt" },
        ]}
        actions={
          can("GRN:WRITE") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Goods Receipt
            </Button>
          )
        }
      />

      <DataTable
        title="Inbound Goods Receipts"
        subtitle="All raw materials received against Purchase Orders or direct vendor deliveries"
        columns={columns}
        data={grns}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as any)?.message}
        onRetry={refetch}
        searchKey="grnNumber"
        searchPlaceholder="Search by GRN number..."
        emptyTitle="No Goods Receipts Found"
        emptyDescription="Create your first Goods Receipt Note to log incoming deliveries."
      />

      {/* Details Modal */}
      <Dialog
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedGrn(null);
        }}
        title={`GRN Details: ${selectedGrn?.grnNumber || ""}`}
        description={`Status: ${selectedGrn?.status || ""} | Received: ${
          selectedGrn?.receivedDate ? new Date(selectedGrn.receivedDate).toLocaleString() : ""
        }`}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 block">Supplier:</span>
              <span className="font-semibold text-slate-800">{selectedGrn?.supplier?.name}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Purchase Order:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {selectedGrn?.vpo?.vpoNumber || "Direct Inbound"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Challan / Gate Pass:</span>
              <span className="font-medium text-slate-700">
                {selectedGrn?.deliveryChallanNumber || "-"} / {selectedGrn?.gatePassNumber || "-"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Warehouse:</span>
              <span className="font-medium text-slate-700">{selectedGrn?.warehouse?.name || "-"}</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              Received Line Items
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {selectedGrn?.grnLines?.map((line: GrnLine) => (
                <div key={line.id} className="p-3 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-slate-900 block">
                      {line.material?.code} - {line.material?.name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Lot: {line.lotNumber || "N/A"} | Shade: {line.shade || "N/A"} | Bin: {line.bin?.code || "Default"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold text-emerald-600 block">
                      Accepted: {line.acceptedQuantity} {line.uom}
                    </span>
                    {Number(line.rejectedQuantity) > 0 && (
                      <span className="font-mono text-rose-500 text-[11px] block">
                        Rejected: {line.rejectedQuantity} {line.uom}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            {selectedGrn?.status === "DRAFT" && can("GRN:WRITE") ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => selectedGrn && handlePostGrn(selectedGrn.id, selectedGrn.grnNumber)}
                isLoading={postGrnMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Post to Stock Ledger
              </Button>
            ) : (
              <div />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDetailsModalOpen(false);
                setSelectedGrn(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Create GRN Dialog */}
      <Dialog
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Goods Receipt Note (GRN)"
        description="Receive incoming materials, inspect physical lot quantities, and record vendor delivery documentation."
      >
        <form onSubmit={handleCreateGrn} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Supplier *
              </label>
              <select
                className="w-full text-xs rounded-md border border-slate-200 bg-white p-2 text-slate-900"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Input
                label="Delivery Challan No"
                placeholder="e.g. DC-98421"
                value={deliveryChallanNo}
                onChange={(e) => setDeliveryChallanNo(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Gate Pass No"
              placeholder="e.g. GP-2026-081"
              value={gatePassNo}
              onChange={(e) => setGatePassNo(e.target.value)}
            />
            <Input
              label="Vendor Invoice No"
              placeholder="e.g. INV-2026-784"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
          </div>

          <Input
            label="Receiving Remarks"
            placeholder="e.g. Delivery truck arrived in good condition, seal verified"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />

          {/* Line Items Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Material Line Items
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

            {lines.map((line, idx) => (
              <div
                key={idx}
                className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Line #{idx + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="text-rose-500 hover:text-rose-700 text-[11px]"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-0.5">
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
                    <label className="text-[11px] font-medium text-slate-600 block mb-0.5">
                      Target Storage Bin
                    </label>
                    <select
                      className="w-full text-xs rounded border border-slate-200 bg-white p-1.5"
                      value={line.binId}
                      onChange={(e) => handleUpdateLine(idx, "binId", e.target.value)}
                    >
                      <option value="">Default Bin</option>
                      {warehouses.flatMap((wh) =>
                        (wh.bins || []).map((b: Bin) => (
                          <option key={b.id} value={b.id}>
                            {wh.code} / {b.code} ({b.name})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Input
                    label="Qty Received *"
                    type="number"
                    value={line.qtyReceived.toString()}
                    onChange={(e) => handleUpdateLine(idx, "qtyReceived", e.target.value)}
                    required
                  />
                  <Input
                    label="Qty Accepted"
                    type="number"
                    value={line.qtyAccepted.toString()}
                    onChange={(e) => handleUpdateLine(idx, "qtyAccepted", e.target.value)}
                  />
                  <Input
                    label="Qty Rejected"
                    type="number"
                    value={line.qtyRejected.toString()}
                    onChange={(e) => handleUpdateLine(idx, "qtyRejected", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Input
                    label="Lot / Roll No"
                    placeholder="e.g. LOT-A24"
                    value={line.lotNumber}
                    onChange={(e) => handleUpdateLine(idx, "lotNumber", e.target.value)}
                  />
                  <Input
                    label="Shade / Color"
                    placeholder="e.g. Navy Blue 19-4010"
                    value={line.shade}
                    onChange={(e) => handleUpdateLine(idx, "shade", e.target.value)}
                  />
                  <Input
                    label="Unit Cost ($)"
                    type="number"
                    step="0.01"
                    value={line.unitCost.toString()}
                    onChange={(e) => handleUpdateLine(idx, "unitCost", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              disabled={createGrnMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createGrnMutation.isPending}
            >
              Save GRN (Draft)
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
