"use client";

import React, { useState } from "react";
import { usePermissions } from "../../../hooks/use-permissions";
import { useAuth } from "../../../lib/auth/auth-context";
import {
  useMaterialRequisitions,
  useCreateRequisition,
  useApproveRequisition,
  useMaterialIssues,
  useCreateIssue,
  usePostIssue,
  useMaterialReturns,
  useCreateReturn,
  usePostReturn,
  useLinkCuttingRecordRolls,
} from "../../../hooks/use-stores";
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
  Package,
  Plus,
  Send,
  RotateCcw,
  CheckCircle2,
  FileText,
  Layers,
  Scissors,
  ArrowRight,
} from "lucide-react";
import {
  MaterialRequisition,
  MaterialIssueNote,
  MaterialReturnNote,
  ProductionOrder,
  Material,
  FabricRoll,
  CuttingRecord,
  Warehouse,
} from "../../../lib/api/types";

export default function StoreIssuesPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"REQUISITIONS" | "ISSUES" | "RETURNS">("REQUISITIONS");

  // Modals
  const [createReqOpen, setCreateReqOpen] = useState(false);
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [createReturnOpen, setCreateReturnOpen] = useState(false);

  // Queries
  const { data: requisitions = [], isLoading: isLoadingReq, refetch: refetchReq } = useMaterialRequisitions();
  const { data: issues = [], isLoading: isLoadingIss, refetch: refetchIss } = useMaterialIssues();
  const { data: returns = [], isLoading: isLoadingRet, refetch: refetchRet } = useMaterialReturns();

  // Reference queries
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-active"],
    queryFn: () => api.get<ProductionOrder[]>("/production/orders"),
    enabled: isAuthenticated,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials-all"],
    queryFn: () => api.get<Material[]>("/materials"),
    enabled: isAuthenticated,
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses-all"],
    queryFn: () => api.get<Warehouse[]>("/warehouses"),
    enabled: isAuthenticated,
  });

  const { data: reservedRolls = [] } = useFabricRolls({
    status: "RESERVED",
  });

  // Requisition Form State
  const [reqOrderId, setReqOrderId] = useState("");
  const [reqRemarks, setReqRemarks] = useState("");
  const [reqLines, setReqLines] = useState<Array<{ materialId: string; qtyRequested: number }>>([
    { materialId: "", qtyRequested: 0 },
  ]);

  // Issue Form State
  const [issueReqId, setIssueReqId] = useState("");
  const [issueOrderId, setIssueOrderId] = useState("");
  const [issueRemarks, setIssueRemarks] = useState("");
  const [issueLines, setIssueLines] = useState<
    Array<{ materialId: string; qtyIssued: number; rollIds: string[] }>
  >([{ materialId: "", qtyIssued: 0, rollIds: [] }]);

  // Return Form State
  const [returnIssueId, setReturnIssueId] = useState("");
  const [returnReason, setReturnReason] = useState("EXCESS_FABRIC");
  const [returnRemarks, setReturnRemarks] = useState("");
  const [returnLines, setReturnLines] = useState<
    Array<{ materialId: string; qtyReturned: number; rollId?: string }>
  >([{ materialId: "", qtyReturned: 0 }]);

  // Mutations
  const createReqMutation = useCreateRequisition();
  const approveReqMutation = useApproveRequisition();
  const createIssueMutation = useCreateIssue();
  const postIssueMutation = usePostIssue();
  const createReturnMutation = useCreateReturn();
  const postReturnMutation = usePostReturn();

  // Requisition Handlers
  const handleCreateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqOrderId) {
      toast.error("Validation Error", "Select a Production Order.");
      return;
    }
    createReqMutation.mutate(
      {
        productionOrderId: reqOrderId,
        notes: reqRemarks || undefined,
        requiredDate: new Date().toISOString(),
        lines: reqLines.map((l) => ({
          materialId: l.materialId,
          requestedQuantity: Number(l.qtyRequested),
          uom: materials.find((m) => m.id === l.materialId)?.uom || "YDS",
        })),
      },
      {
        onSuccess: () => {
          toast.success("Requisition Created", "Store requisition drafted successfully.");
          setCreateReqOpen(false);
          setReqOrderId("");
          setReqRemarks("");
          setReqLines([{ materialId: "", qtyRequested: 0 }]);
        },
        onError: (err: any) => {
          toast.error("Error", err?.message || "Failed to create requisition.");
        },
      }
    );
  };

  const handleApproveRequisition = (id: string, reqNo: string) => {
    approveReqMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Requisition Approved", `${reqNo} approved for issue.`);
      },
      onError: (err: any) => {
        toast.error("Approval Failed", err?.message || "Failed to approve.");
      },
    });
  };

  // Issue Handlers
  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    createIssueMutation.mutate(
      {
        data: {
          requisitionId: issueReqId || undefined,
          productionOrderId: issueOrderId || (orders[0]?.id || ""),
          notes: issueRemarks || undefined,
          lines: issueLines.map((l) => ({
            materialId: l.materialId,
            fabricRollId: l.rollIds?.[0] || undefined,
            binId: warehouses[0]?.bins?.[0]?.id || undefined,
            quantity: Number(l.qtyIssued),
            uom: materials.find((m) => m.id === l.materialId)?.uom || "YDS",
          })),
        },
        idempotencyKey: `iss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
      {
        onSuccess: () => {
          toast.success("Issue Note Created", "Material issue note prepared.");
          setCreateIssueOpen(false);
        },
        onError: (err: any) => {
          toast.error("Error", err?.message || "Failed to create issue note.");
        },
      }
    );
  };

  const handlePostIssue = (id: string, issueNo: string) => {
    if (confirm(`Post ${issueNo} to Ledger? This will deduct stock balances and move rolls to Cutting Room.`)) {
      postIssueMutation.mutate(
        { id, idempotencyKey: `post-iss-${id}-${Date.now()}` },
        {
          onSuccess: () => {
            toast.success("Issue Posted", `${issueNo} posted to ledger and rolls transferred.`);
          },
          onError: (err: any) => {
            toast.error("Posting Failed", err?.message || "Failed to post issue.");
          },
        }
      );
    }
  };

  // Return Handlers
  const handleCreateReturn = (e: React.FormEvent) => {
    e.preventDefault();
    createReturnMutation.mutate(
      {
        data: {
          productionOrderId: returnIssueId || (orders[0]?.id || ""),
          reason: returnReason,
          lines: returnLines.map((l) => ({
            materialId: l.materialId,
            fabricRollId: l.rollId || undefined,
            binId: warehouses[0]?.bins?.[0]?.id || "",
            quantity: Number(l.qtyReturned),
            isScrap: false,
            uom: materials.find((m) => m.id === l.materialId)?.uom || "YDS",
          })),
        },
        idempotencyKey: `ret-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      },
      {
        onSuccess: () => {
          toast.success("Return Created", "Material return slip drafted.");
          setCreateReturnOpen(false);
        },
        onError: (err: any) => {
          toast.error("Error", err?.message || "Failed to create return.");
        },
      }
    );
  };

  const handlePostReturn = (id: string, returnNo: string) => {
    if (confirm(`Post return ${returnNo}? This will credit inventory ledger balances.`)) {
      postReturnMutation.mutate(
        { id, idempotencyKey: `post-ret-${id}-${Date.now()}` },
        {
          onSuccess: () => {
            toast.success("Return Posted", `${returnNo} posted to stock ledger.`);
          },
          onError: (err: any) => {
            toast.error("Posting Failed", err?.message || "Failed to post return.");
          },
        }
      );
    }
  };

  // Columns for Requisitions
  const reqColumns: ColumnDef<MaterialRequisition>[] = [
    {
      header: "Requisition No",
      accessorKey: "requisitionNumber",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 text-blue-600">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-slate-900 block">
              {row.requisitionNumber}
            </span>
            <span className="text-[10px] text-slate-400">
              {new Date(row.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Order / Dept",
      cell: (row) => (
        <div className="text-xs">
          <span className="font-mono font-semibold text-slate-800 block">
            {row.productionOrder?.orderNumber || "General Requisition"}
          </span>
          <span className="text-slate-500 text-[11px]">{row.departmentId || "Cutting Floor"}</span>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        let variant = "secondary";
        if (row.status === "APPROVED") variant = "info";
        if (row.status === "ISSUED") variant = "success";
        if (row.status === "DRAFT") variant = "warning";
        return (
          <Badge variant={variant as any} size="sm">
            {row.status}
          </Badge>
        );
      },
    },
    {
      header: "Lines / Qty",
      cell: (row) => {
        const total = row.lines?.reduce((s, l) => s + Number(l.requestedQuantity), 0) || 0;
        return (
          <span className="font-mono text-xs font-medium text-slate-800">
            {row.lines?.length || 0} items ({total.toLocaleString()} units)
          </span>
        );
      },
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          {row.status === "DRAFT" && can("REQUISITION:WRITE") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleApproveRequisition(row.id, row.requisitionNumber)}
              isLoading={approveReqMutation.isPending}
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
            >
              Approve
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Columns for Issues
  const issueColumns: ColumnDef<MaterialIssueNote>[] = [
    {
      header: "Issue Note No",
      accessorKey: "issueNumber",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-emerald-50 text-emerald-600">
            <Send className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-slate-900 block">
              {row.issueNumber}
            </span>
            <span className="text-[10px] text-slate-400">
              {new Date(row.issuedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Requisition Ref",
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {row.requisitionId ? `Req: ${row.requisitionId.slice(0, 8)}` : "Direct Floor Issue"}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => (
        <Badge variant={row.status === "ISSUED" ? "success" : "warning"} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Issued Units",
      cell: (row) => {
        const total = row.lines?.reduce((s, l) => s + Number(l.quantity), 0) || 0;
        return (
          <span className="font-mono text-xs font-semibold text-slate-900">
            {total.toLocaleString()} units
          </span>
        );
      },
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          {row.status === "DRAFT" && can("STORE_ISSUE:WRITE") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handlePostIssue(row.id, row.issueNumber)}
              isLoading={postIssueMutation.isPending}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              Post to Ledger
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Columns for Returns
  const returnColumns: ColumnDef<MaterialReturnNote>[] = [
    {
      header: "Return Slip No",
      accessorKey: "returnNumber",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-rose-50 text-rose-600">
            <RotateCcw className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-slate-900 block">
              {row.returnNumber}
            </span>
            <span className="text-[10px] text-slate-400">
              {new Date(row.returnedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: "Original Issue / Reason",
      cell: (row) => (
        <div className="text-xs">
          <span className="font-medium text-slate-800 block">
            {(row.reason || "EXCESS_FABRIC").replace(/_/g, " ")}
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            {row.productionOrderId ? `Order: ${row.productionOrderId.slice(0, 8)}` : "General Return"}
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => (
        <Badge variant={row.status === "RETURNED" ? "success" : "warning"} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Returned Units",
      cell: (row) => {
        const total = row.lines?.reduce((s, l) => s + Number(l.quantity), 0) || 0;
        return (
          <span className="font-mono text-xs font-semibold text-rose-600">
            +{total.toLocaleString()} units
          </span>
        );
      },
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          {row.status === "DRAFT" && can("STORE_ISSUE:WRITE") && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handlePostReturn(row.id, row.returnNumber)}
              isLoading={postReturnMutation.isPending}
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              Post Return
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!can("STORE_ISSUE:READ")) {
    return (
      <ForbiddenState
        requiredPermission="STORE_ISSUE:READ"
        moduleName="Store Requisitions & Material Issues"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Requisitions, Issues & Returns"
        description="Material dispatch to Cutting & Sewing departments, double-entry inventory deductions, and return reconciliation."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Materials & Warehouse", href: "/inventory" },
          { label: "Stores & Issues" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "REQUISITIONS" && can("REQUISITION:WRITE") && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateReqOpen(true)}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Requisition
              </Button>
            )}
            {activeTab === "ISSUES" && can("STORE_ISSUE:WRITE") && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreateIssueOpen(true)}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-3.5 h-3.5" />
                New Issue Note
              </Button>
            )}
            {activeTab === "RETURNS" && can("STORE_ISSUE:WRITE") && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCreateReturnOpen(true)}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Return Slip
              </Button>
            )}
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("REQUISITIONS")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "REQUISITIONS"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Material Requisitions ({requisitions.length})
        </button>
        <button
          onClick={() => setActiveTab("ISSUES")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "ISSUES"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Material Issue Notes ({issues.length})
        </button>
        <button
          onClick={() => setActiveTab("RETURNS")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            activeTab === "RETURNS"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Material Returns ({returns.length})
        </button>
      </div>

      {/* Requisitions Tab Table */}
      {activeTab === "REQUISITIONS" && (
        <DataTable
          title="Floor Material Requisitions"
          subtitle="Requests raised by production departments for fabric rolls, trims, and accessories"
          columns={reqColumns}
          data={requisitions}
          isLoading={isLoadingReq}
          onRetry={refetchReq}
          searchKey="requisitionNumber"
          searchPlaceholder="Search by requisition number..."
          emptyTitle="No Requisitions Found"
          emptyDescription="Create a store requisition to request materials for production."
        />
      )}

      {/* Issues Tab Table */}
      {activeTab === "ISSUES" && (
        <DataTable
          title="Material Issue Notes"
          subtitle="Physical material transfers out of warehouse into Cutting Room, reducing double-entry ledger balances"
          columns={issueColumns}
          data={issues}
          isLoading={isLoadingIss}
          onRetry={refetchIss}
          searchKey="issueNumber"
          searchPlaceholder="Search by issue note number..."
          emptyTitle="No Material Issues Found"
          emptyDescription="Create an issue note against an approved requisition to transfer stock."
        />
      )}

      {/* Returns Tab Table */}
      {activeTab === "RETURNS" && (
        <DataTable
          title="Material Return Slips"
          subtitle="Surplus fabric remnants, defective rolls, and unconsumed trims returned to store"
          columns={returnColumns}
          data={returns}
          isLoading={isLoadingRet}
          onRetry={refetchRet}
          searchKey="returnNumber"
          searchPlaceholder="Search by return slip number..."
          emptyTitle="No Material Returns Found"
          emptyDescription="Record return of leftover materials from cutting or sewing floor."
        />
      )}

      {/* Create Requisition Dialog */}
      <Dialog
        isOpen={createReqOpen}
        onClose={() => setCreateReqOpen(false)}
        title="Create Material Requisition"
        description="Request fabric rolls or trims from warehouse for production."
      >
        <form onSubmit={handleCreateRequisition} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Production Order *</label>
            <select
              className="w-full text-xs rounded border border-slate-200 bg-white p-2"
              value={reqOrderId}
              onChange={(e) => setReqOrderId(e.target.value)}
              required
            >
              <option value="">Select Production Order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} ({o.targetQuantity ?? o.quantity ?? 0} pcs)
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Requisition Remarks"
            placeholder="e.g. Urgent fabric draw for line cut setup"
            value={reqRemarks}
            onChange={(e) => setReqRemarks(e.target.value)}
          />

          <div className="space-y-2 pt-2">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
              Requested Materials
            </span>
            {reqLines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2 p-2 border border-slate-200 rounded bg-slate-50">
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Material *</label>
                  <select
                    className="w-full text-xs rounded border border-slate-200 bg-white p-1.5"
                    value={l.materialId}
                    onChange={(e) => {
                      const updated = [...reqLines];
                      updated[idx].materialId = e.target.value;
                      setReqLines(updated);
                    }}
                    required
                  >
                    <option value="">Select Material</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Input
                    label="Qty Requested *"
                    type="number"
                    value={l.qtyRequested.toString()}
                    onChange={(e) => {
                      const updated = [...reqLines];
                      updated[idx].qtyRequested = Number(e.target.value);
                      setReqLines(updated);
                    }}
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateReqOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={createReqMutation.isPending}>
              Create Requisition
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Create Issue Dialog */}
      <Dialog
        isOpen={createIssueOpen}
        onClose={() => setCreateIssueOpen(false)}
        title="Create Material Issue Note"
        description="Fulfill approved requisition by picking warehouse stock and rolls."
      >
        <form onSubmit={handleCreateIssue} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Requisition Reference</label>
            <select
              className="w-full text-xs rounded border border-slate-200 bg-white p-2"
              value={issueReqId}
              onChange={(e) => setIssueReqId(e.target.value)}
            >
              <option value="">Select Approved Requisition (Optional)</option>
              {requisitions
                .filter((r) => r.status === "APPROVED" || r.status === "DRAFT")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.requisitionNumber} ({r.productionOrder?.orderNumber})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Production Order</label>
            <select
              className="w-full text-xs rounded border border-slate-200 bg-white p-2"
              value={issueOrderId}
              onChange={(e) => setIssueOrderId(e.target.value)}
            >
              <option value="">Select Production Order</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Issue Remarks"
            placeholder="e.g. Delivered to Cutting Table #2"
            value={issueRemarks}
            onChange={(e) => setIssueRemarks(e.target.value)}
          />

          <div className="space-y-2 pt-2">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
              Issue Lines
            </span>
            {issueLines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2 p-2 border border-slate-200 rounded bg-slate-50">
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Material *</label>
                  <select
                    className="w-full text-xs rounded border border-slate-200 bg-white p-1.5"
                    value={l.materialId}
                    onChange={(e) => {
                      const updated = [...issueLines];
                      updated[idx].materialId = e.target.value;
                      setIssueLines(updated);
                    }}
                    required
                  >
                    <option value="">Select Material</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Input
                    label="Qty Issued *"
                    type="number"
                    value={l.qtyIssued.toString()}
                    onChange={(e) => {
                      const updated = [...issueLines];
                      updated[idx].qtyIssued = Number(e.target.value);
                      setIssueLines(updated);
                    }}
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateIssueOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={createIssueMutation.isPending}>
              Draft Issue Note
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Create Return Dialog */}
      <Dialog
        isOpen={createReturnOpen}
        onClose={() => setCreateReturnOpen(false)}
        title="Create Material Return Slip"
        description="Return excess or defective fabric/trims back into warehouse storage."
      >
        <form onSubmit={handleCreateReturn} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Return Reason *</label>
            <select
              className="w-full text-xs rounded border border-slate-200 bg-white p-2"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              required
            >
              <option value="EXCESS_FABRIC">Excess Fabric Remaining After Cutting</option>
              <option value="DEFECTIVE_ROLL">Defective Roll Rejected on Cutting Table</option>
              <option value="CUT_PIECE_REMNANT">Cut Piece Remnant / End Bit</option>
              <option value="ORDER_CANCELLED">Production Order Scaled Down / Cancelled</option>
            </select>
          </div>

          <Input
            label="Return Remarks"
            placeholder="e.g. Uncut roll returned to warehouse rack B-12"
            value={returnRemarks}
            onChange={(e) => setReturnRemarks(e.target.value)}
          />

          <div className="space-y-2 pt-2">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
              Return Lines
            </span>
            {returnLines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-2 gap-2 p-2 border border-slate-200 rounded bg-slate-50">
                <div>
                  <label className="text-[11px] text-slate-600 block mb-1">Material *</label>
                  <select
                    className="w-full text-xs rounded border border-slate-200 bg-white p-1.5"
                    value={l.materialId}
                    onChange={(e) => {
                      const updated = [...returnLines];
                      updated[idx].materialId = e.target.value;
                      setReturnLines(updated);
                    }}
                    required
                  >
                    <option value="">Select Material</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} - {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Input
                    label="Qty Returned *"
                    type="number"
                    value={l.qtyReturned.toString()}
                    onChange={(e) => {
                      const updated = [...returnLines];
                      updated[idx].qtyReturned = Number(e.target.value);
                      setReturnLines(updated);
                    }}
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateReturnOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={createReturnMutation.isPending}>
              Draft Return Slip
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
