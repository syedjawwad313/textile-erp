"use client";

import React, { useState } from "react";
import { usePermissions } from "../../../hooks/use-permissions";
import { useAuth } from "../../../lib/auth/auth-context";
import {
  useGatePasses,
  useCreateGatePass,
  useApproveGatePass,
  useDispatchGatePass,
  useCancelGatePass,
  useShipments,
} from "../../../hooks/use-shipping";
import { PageHeader } from "../../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../../components/tables/data-table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { useToast } from "../../../components/ui/toast";
import { ForbiddenState } from "../../../components/feedback/forbidden-state";
import {
  ShieldCheck,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  Ban,
  ArrowRightCircle,
  Eye,
  Lock,
  UserCheck,
} from "lucide-react";
import { OutboundGatePass } from "../../../lib/api/types";

export default function GatePassPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [activeGatePass, setActiveGatePass] = useState<OutboundGatePass | null>(null);

  // Form State
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [transporter, setTransporter] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [sealNumber, setSealNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Queries
  const {
    data: gatePasses = [],
    isLoading,
    refetch,
  } = useGatePasses({
    status: selectedStatus || undefined,
  });

  const { data: shipments = [] } = useShipments();
  const eligibleShipments = shipments.filter(
    (s) => s.status !== "CANCELLED" && s.status !== "DISPATCHED" && s.totalCartons > 0,
  );

  const createGatePassMutation = useCreateGatePass();
  const approveGatePassMutation = useApproveGatePass();
  const dispatchGatePassMutation = useDispatchGatePass();
  const cancelGatePassMutation = useCancelGatePass();

  // KPIs
  const totalGatePasses = gatePasses.length;
  const approvedReady = gatePasses.filter((g) => g.status === "APPROVED").length;
  const dispatchedToday = gatePasses.filter((g) => g.status === "DISPATCHED").length;

  const handleCreateGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipmentId || !transporter || !vehicleNumber || !driverName) {
      toast.error("Validation Error", "Please fill all required fields");
      return;
    }

    try {
      await createGatePassMutation.mutateAsync({
        data: {
          shipmentId: selectedShipmentId,
          transporter,
          vehicleNumber,
          driverName,
          driverPhone: driverPhone || undefined,
          sealNumber: sealNumber || undefined,
          notes: notes || undefined,
        },
        idempotencyKey: `gp-create-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      });

      toast.success("Gate Pass Drafted", "Outbound Gate Pass drafted successfully");
      setCreateModalOpen(false);
      resetForm();
      refetch();
    } catch (err: any) {
      toast.error("Failed to Draft Gate Pass", err?.message || "Failed to draft gate pass");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveGatePassMutation.mutateAsync(id);
      toast.success("Gate Pass Approved", "Gate pass approved by supervisor; cleared for gate-out");
      refetch();
    } catch (err: any) {
      toast.error("Approval Failed", err?.message || "Failed to approve gate pass");
    }
  };

  const handleDispatch = async (id: string, gatePassNumber: string) => {
    if (
      !confirm(
        `AUTHORITATIVE DISPATCH: Confirm physical vehicle exit for Gate Pass ${gatePassNumber}?\n\nThis will permanently mark cartons as SHIPPED and deduct finished goods inventory from the stock ledger exactly once.`,
      )
    ) {
      return;
    }

    try {
      await dispatchGatePassMutation.mutateAsync({
        id,
        idempotencyKey: `gp-dispatch-${id}`,
      });
      toast.success("Shipment Dispatched", "Vehicle gate-out dispatched! Finished goods inventory deducted.");
      refetch();
    } catch (err: any) {
      toast.error("Dispatch Failed", err?.message || "Failed to dispatch gate pass");
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this gate pass?")) {
      return;
    }
    try {
      await cancelGatePassMutation.mutateAsync({ id, reason: "Cancelled by supervisor" });
      toast.success("Gate Pass Cancelled", "Gate pass cancelled");
      refetch();
    } catch (err: any) {
      toast.error("Cancellation Failed", err?.message || "Failed to cancel gate pass");
    }
  };

  const resetForm = () => {
    setSelectedShipmentId("");
    setTransporter("");
    setVehicleNumber("");
    setDriverName("");
    setDriverPhone("");
    setSealNumber("");
    setNotes("");
  };

  if (!can("SHIPPING:READ") && !can("WAREHOUSE:READ")) {
    return <ForbiddenState moduleName="Outbound Gate Passes" requiredPermission="SHIPPING:READ" />;
  }

  const columns: ColumnDef<OutboundGatePass>[] = [
    {
      header: "Gate Pass #",
      accessorKey: "gatePassNumber",
      cell: (row) => (
        <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
          {row.gatePassNumber}
        </div>
      ),
    },
    {
      header: "Shipment #",
      cell: (row) => (
        <div className="font-mono text-xs text-slate-700 dark:text-slate-300">
          {row.shipment?.shipmentNumber || "—"}
        </div>
      ),
    },
    {
      header: "Transporter & Vehicle",
      cell: (row) => (
        <div className="text-sm">
          <div className="font-medium text-slate-900 dark:text-white">{row.transporter}</div>
          <div className="text-xs font-mono text-slate-500">Plate: {row.vehicleNumber}</div>
        </div>
      ),
    },
    {
      header: "Driver & Seal",
      cell: (row) => (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <div>Driver: {row.driverName}</div>
          <div className="text-slate-500 font-mono">Seal: {row.sealNumber || "No Seal"}</div>
        </div>
      ),
    },
    {
      header: "Packages",
      cell: (row) => (
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          {row.totalCartons} <span className="text-xs font-normal text-slate-500">ctns</span>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (row) => {
        let variant: "default" | "success" | "warning" | "danger" = "default";
        if (row.status === "DISPATCHED") variant = "success";
        else if (row.status === "APPROVED") variant = "warning";
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
              setActiveGatePass(row);
              setDetailModalOpen(true);
            }}
          >
            <Eye className="w-3.5 h-3.5" /> View
          </Button>

          {row.status === "DRAFT" && can("SHIPPING:APPROVE") && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1"
              onClick={() => handleApprove(row.id)}
            >
              <UserCheck className="w-3.5 h-3.5" /> Approve
            </Button>
          )}

          {row.status === "APPROVED" && can("SHIPPING:WRITE") && (
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
              onClick={() => handleDispatch(row.id, row.gatePassNumber)}
            >
              <ArrowRightCircle className="w-3.5 h-3.5" /> Gate-Out
            </Button>
          )}

          {row.status !== "DISPATCHED" && row.status !== "CANCELLED" && can("SHIPPING:WRITE") && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => handleCancel(row.id)}
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
        title="Outbound Gate Pass Terminal"
        description="Factory security release control, vehicle and container seal verification, and authoritative dispatch execution."
        actions={
          <div className="flex items-center gap-3">
            {can("SHIPPING:WRITE") && (
              <Button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" /> Draft Gate Pass
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Gate Passes</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{totalGatePasses}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Approved / Ready to Exit</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{approvedReady}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Dispatched & Gate-Out</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{dispatchedToday}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <select
            className="h-9 px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="APPROVED">Approved</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Gate Passes Table */}
      <DataTable
        columns={columns}
        data={gatePasses}
        isLoading={isLoading}
        emptyTitle="No Outbound Gate Passes"
        emptyDescription="No outbound gate passes found. Draft a gate pass for a staged shipment."
      />

      {/* Draft Gate Pass Dialog */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Draft Outbound Gate Pass">
        <form onSubmit={handleCreateGatePass} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Shipment *
            </label>
            <select
              required
              value={selectedShipmentId}
              onChange={(e) => setSelectedShipmentId(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
            >
              <option value="">Choose Shipment...</option>
              {eligibleShipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shipmentNumber} — {s.buyer?.name} ({s.totalCartons} ctns, {s.totalUnits} pcs)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Transporter / Logistics Firm *
              </label>
              <Input
                required
                value={transporter}
                onChange={(e) => setTransporter(e.target.value)}
                placeholder="e.g. Swift Cargo Logistics"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Vehicle Registration Plate *
              </label>
              <Input
                required
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="e.g. KHI-8921"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Driver Full Name *
              </label>
              <Input
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. Muhammad Iqbal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Driver Mobile Phone
              </label>
              <Input
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="e.g. +92 300 1234567"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Container Security Bolt Seal #
            </label>
            <Input
              value={sealNumber}
              onChange={(e) => setSealNumber(e.target.value)}
              placeholder="e.g. SL-984201"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Security Remarks / Gate Instructions
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Verified driver CNIC and license"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createGatePassMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createGatePassMutation.isPending ? "Drafting..." : "Draft Gate Pass"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Detail Modal */}
      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={activeGatePass ? `Gate Pass: ${activeGatePass.gatePassNumber}` : "Gate Pass Details"}
      >
        {activeGatePass && (
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Transporter:</span>
                <div className="font-semibold text-slate-900 dark:text-white">{activeGatePass.transporter}</div>
              </div>
              <div>
                <span className="text-slate-500">Vehicle Plate:</span>
                <div className="font-mono font-bold text-slate-900 dark:text-white">{activeGatePass.vehicleNumber}</div>
              </div>
              <div>
                <span className="text-slate-500">Driver:</span>
                <div className="font-medium text-slate-900 dark:text-white">{activeGatePass.driverName}</div>
                <div className="text-slate-500">{activeGatePass.driverPhone || "No Phone"}</div>
              </div>
              <div>
                <span className="text-slate-500">Seal Number:</span>
                <div className="font-mono font-semibold text-slate-900 dark:text-white">
                  {activeGatePass.sealNumber || "No Seal"}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Total Cartons:</span>
                <div className="font-bold text-slate-900 dark:text-white">{activeGatePass.totalCartons} cartons</div>
              </div>
              <div>
                <span className="text-slate-500">Status:</span>
                <Badge variant={activeGatePass.status === "DISPATCHED" ? "success" : "default"}>
                  {activeGatePass.status}
                </Badge>
              </div>
              {activeGatePass.dispatchedAt && (
                <div className="col-span-2 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                  Gate-Out Timestamp: {new Date(activeGatePass.dispatchedAt).toLocaleString()}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <Button onClick={() => setDetailModalOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
