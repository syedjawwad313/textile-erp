"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api/client";
import { BuyerPo, Vpo, SupplierReturnNote, Material } from "../../lib/api/types";
import { useBuyers, useStyles, useSuppliers } from "../../hooks/use-master-data";
import { usePermissions } from "../../hooks/use-permissions";
import { useAuth } from "../../lib/auth/auth-context";
import { PageHeader } from "../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../components/tables/data-table";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { ForbiddenState } from "../../components/feedback/forbidden-state";
import { useToast } from "../../components/ui/toast";
import { ShoppingBag, Plus, Truck, RotateCcw, CheckCircle, Send } from "lucide-react";

export default function ProcurementPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"buyer-pos" | "vpos" | "supplier-returns">("buyer-pos");
  const [createBuyerPoOpen, setCreateBuyerPoOpen] = useState(false);
  const [createVpoOpen, setCreateVpoOpen] = useState(false);
  const [createReturnOpen, setCreateReturnOpen] = useState(false);

  // Form states - Buyer PO
  const [poNumber, setPoNumber] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [quantity, setQuantity] = useState<number | string>(5000);
  const [unitPrice, setUnitPrice] = useState<number | string>(12.5);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));

  // Form states - VPO
  const [vpoNumber, setVpoNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [vpoOrderDate, setVpoOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [vpoMaterialId, setVpoMaterialId] = useState("");
  const [vpoQuantity, setVpoQuantity] = useState<number | string>(1000);
  const [vpoUnitCost, setVpoUnitCost] = useState<number | string>(3.5);

  // Form states - Supplier Return
  const [returnSupplierId, setReturnSupplierId] = useState("");
  const [returnMaterialId, setReturnMaterialId] = useState("");
  const [returnQuantity, setReturnQuantity] = useState<number | string>(50);
  const [returnUom, setReturnUom] = useState("YDS");
  const [returnReason, setReturnReason] = useState("ASTM D5430 4-Point Defect Rejection (>28 pts/100 sq yd)");

  const { data: buyers = [] } = useBuyers();
  const { data: styles = [] } = useStyles();
  const { data: suppliers = [] } = useSuppliers();

  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: () => api.get<Material[]>("/materials"),
    enabled: isAuthenticated,
  });

  // Queries
  const {
    data: buyerPos = [],
    isLoading: isBuyerPosLoading,
    isError: isBuyerPosError,
    error: buyerPosError,
    refetch: refetchBuyerPos,
  } = useQuery({
    queryKey: ["buyer-pos"],
    queryFn: () => api.get<BuyerPo[]>("/buyer-pos"),
    enabled: isAuthenticated && activeTab === "buyer-pos",
  });

  const {
    data: vpos = [],
    isLoading: isVposLoading,
    isError: isVposError,
    error: vposError,
    refetch: refetchVpos,
  } = useQuery({
    queryKey: ["vpos"],
    queryFn: () => api.get<Vpo[]>("/vpos"),
    enabled: isAuthenticated && activeTab === "vpos",
  });

  const {
    data: supplierReturns = [],
    isLoading: isReturnsLoading,
    isError: isReturnsError,
    error: returnsError,
    refetch: refetchReturns,
  } = useQuery({
    queryKey: ["supplier-returns"],
    queryFn: () => api.get<SupplierReturnNote[]>("/supplier-returns"),
    enabled: isAuthenticated && activeTab === "supplier-returns",
  });

  // Buyer PO Mutation
  const createBuyerPoMutation = useMutation({
    mutationFn: (data: any) => api.post<BuyerPo>("/buyer-pos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyer-pos"] });
      toast.success("Buyer PO Issued", `Successfully created PO ${poNumber}`);
      setCreateBuyerPoOpen(false);
    },
    onError: (err: any) => {
      toast.error("Creation Failed", err?.message || "Could not issue Buyer PO");
    },
  });

  // VPO Mutation
  const createVpoMutation = useMutation({
    mutationFn: (data: any) => api.post<Vpo>("/vpos", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vpos"] });
      toast.success("Vendor PO Created", `Successfully created VPO ${vpoNumber}`);
      setCreateVpoOpen(false);
    },
    onError: (err: any) => {
      toast.error("Creation Failed", err?.message || "Could not issue VPO");
    },
  });

  // VPO Status Mutations
  const approveVpoMutation = useMutation({
    mutationFn: (id: string) => api.post<Vpo>(`/vpos/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vpos"] });
      toast.success("VPO Approved", "Vendor Purchase Order is approved for issuance");
    },
    onError: (err: any) => {
      toast.error("Approval Failed", err?.message || "Could not approve VPO");
    },
  });

  const issueVpoMutation = useMutation({
    mutationFn: (id: string) => api.post<Vpo>(`/vpos/${id}/issue`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vpos"] });
      toast.success("VPO Issued", "Vendor Purchase Order issued to supplier");
    },
    onError: (err: any) => {
      toast.error("Issue Failed", err?.message || "Could not issue VPO");
    },
  });

  // Supplier Return Mutation
  const createSupplierReturnMutation = useMutation({
    mutationFn: (data: any) =>
      api.post<SupplierReturnNote>("/supplier-returns", data, {
        headers: { "x-idempotency-key": `srn-ui-${Date.now()}` },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-returns"] });
      toast.success("Supplier Return Note Created", "Goods returned to supplier and ledger deducted");
      setCreateReturnOpen(false);
    },
    onError: (err: any) => {
      toast.error("Return Failed", err?.message || "Could not process supplier return");
    },
  });

  const handleCreateBuyerPo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poNumber || !buyerId || !styleId) {
      toast.error("Validation Error", "Please fill in all required fields.");
      return;
    }
    createBuyerPoMutation.mutate({
      buyerId,
      poNumber: poNumber.trim(),
      orderDate: new Date(orderDate).toISOString(),
      lines: [
        {
          styleId,
          quantity: Number(quantity),
          unitPrice: Number(unitPrice),
        },
      ],
    });
  };

  const handleCreateVpo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vpoNumber || !supplierId) {
      toast.error("Validation Error", "Please fill in all required fields.");
      return;
    }
    const lines = vpoMaterialId
      ? [
          {
            materialId: vpoMaterialId,
            quantity: Number(vpoQuantity),
            unitCost: Number(vpoUnitCost),
          },
        ]
      : undefined;

    createVpoMutation.mutate({
      supplierId,
      vpoNumber: vpoNumber.trim(),
      orderDate: new Date(vpoOrderDate).toISOString(),
      lines,
    });
  };

  const handleCreateSupplierReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnSupplierId || !returnMaterialId || !returnQuantity) {
      toast.error("Validation Error", "Please select supplier, material, and quantity.");
      return;
    }

    createSupplierReturnMutation.mutate({
      supplierId: returnSupplierId,
      reason: returnReason,
      lines: [
        {
          materialId: returnMaterialId,
          quantity: Number(returnQuantity),
          uom: returnUom,
          reason: returnReason,
        },
      ],
    });
  };

  const buyerMap = new Map(buyers.map((b) => [b.id, b.name]));
  const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));
  const materialMap = new Map(materials.map((m) => [m.id, `${m.name} (${m.code})`]));

  const buyerPoColumns: ColumnDef<BuyerPo>[] = [
    {
      header: "PO Number",
      accessorKey: "poNumber",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 text-blue-600">
            <ShoppingBag className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-xs font-semibold text-slate-900">
            {row.poNumber}
          </span>
        </div>
      ),
    },
    {
      header: "Buyer Account",
      cell: (row) => (
        <span className="font-medium text-slate-900">
          {buyerMap.get(row.buyerId) || row.buyerId}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => (
        <Badge variant={row.status === "CONFIRMED" ? "success" : "info"} size="sm">
          {row.status || "CONFIRMED"}
        </Badge>
      ),
    },
    {
      header: "Order Date",
      accessorKey: "orderDate",
      cell: (row) => (
        <span className="text-xs text-slate-600 font-mono">
          {row.orderDate ? new Date(row.orderDate).toLocaleDateString() : "-"}
        </span>
      ),
    },
    {
      header: "Created Date",
      accessorKey: "createdAt",
      cell: (row) => (
        <span className="text-xs text-slate-500">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"}
        </span>
      ),
    },
  ];

  const vpoColumns: ColumnDef<Vpo>[] = [
    {
      header: "VPO Number",
      accessorKey: "vpoNumber",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-rose-50 text-rose-700">
            <Truck className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-xs font-semibold text-slate-900">
            {row.vpoNumber}
          </span>
        </div>
      ),
    },
    {
      header: "Vendor / Supplier",
      cell: (row) => (
        <span className="font-medium text-slate-900">
          {supplierMap.get(row.supplierId) || row.supplierId}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => {
        let variant: "success" | "neutral" | "warning" | "info" = "neutral";
        if (row.status === "ISSUED" || row.status === "COMPLETED") variant = "success";
        else if (row.status === "APPROVED") variant = "info";
        else if (row.status === "DRAFT" || row.status === "SUBMITTED") variant = "warning";

        return (
          <Badge variant={variant} size="sm">
            {row.status || "DRAFT"}
          </Badge>
        );
      },
    },
    {
      header: "Order Date",
      accessorKey: "orderDate",
      cell: (row) => (
        <span className="text-xs text-slate-600 font-mono">
          {row.orderDate ? new Date(row.orderDate).toLocaleDateString() : "-"}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {(row.status === "DRAFT" || row.status === "SUBMITTED") && can("VPO:APPROVE") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => approveVpoMutation.mutate(row.id)}
              disabled={approveVpoMutation.isPending}
            >
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              Approve
            </Button>
          )}
          {row.status === "APPROVED" && can("VPO:WRITE") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => issueVpoMutation.mutate(row.id)}
              disabled={issueVpoMutation.isPending}
            >
              <Send className="w-3 h-3 text-blue-600" />
              Issue
            </Button>
          )}
        </div>
      ),
    },
  ];

  const returnColumns: ColumnDef<SupplierReturnNote>[] = [
    {
      header: "Return Note #",
      accessorKey: "returnNumber",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-amber-50 text-amber-700">
            <RotateCcw className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-xs font-semibold text-slate-900">
            {row.returnNumber}
          </span>
        </div>
      ),
    },
    {
      header: "Supplier",
      cell: (row) => (
        <span className="font-medium text-slate-900">
          {row.supplier?.name || supplierMap.get(row.supplierId) || row.supplierId}
        </span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => (
        <Badge variant={row.status === "COMPLETED" ? "success" : "info"} size="sm">
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Items Returned",
      cell: (row) => (
        <span className="text-xs font-medium text-slate-700">
          {row.lines?.length || 0} line(s)
        </span>
      ),
    },
    {
      header: "Reason",
      accessorKey: "reason",
      cell: (row) => (
        <span className="text-xs text-slate-600 max-w-xs truncate block">
          {row.reason || "-"}
        </span>
      ),
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: (row) => (
        <span className="text-xs text-slate-500 font-mono">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"}
        </span>
      ),
    },
  ];

  if (!can("BUYER_PO:READ") && !can("VPO:READ") && !can("SUPPLIER:READ")) {
    return (
      <ForbiddenState
        requiredPermission="BUYER_PO:READ"
        moduleName="Supply Chain Procurement"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supply Chain & Procurement"
        description="Manage commercial Buyer Purchase Orders, Vendor Purchase Orders (VPO), and Supplier Return Notes for rejected materials."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Supply Chain" },
          { label: "Procurement" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "buyer-pos" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPoNumber(`PO-${Date.now().toString().slice(-4)}`);
                  setBuyerId(buyers.length > 0 ? buyers[0].id : "");
                  setStyleId(styles.length > 0 ? styles[0].id : "");
                  setCreateBuyerPoOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Issue Buyer PO
              </Button>
            )}
            {activeTab === "vpos" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setVpoNumber(`VPO-${Date.now().toString().slice(-4)}`);
                  setSupplierId(suppliers.length > 0 ? suppliers[0].id : "");
                  setCreateVpoOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Issue Vendor PO
              </Button>
            )}
            {activeTab === "supplier-returns" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setReturnSupplierId(suppliers.length > 0 ? suppliers[0].id : "");
                  setReturnMaterialId(materials.length > 0 ? materials[0].id : "");
                  setCreateReturnOpen(true);
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Create Supplier Return
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("buyer-pos")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "buyer-pos"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Buyer Purchase Orders (Sales)
        </button>
        <button
          onClick={() => setActiveTab("vpos")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "vpos"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Truck className="w-4 h-4" />
          Vendor Purchase Orders (Sourcing)
        </button>
        <button
          onClick={() => setActiveTab("supplier-returns")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "supplier-returns"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          Supplier Returns & Debit Notes
        </button>
      </div>

      {activeTab === "buyer-pos" && (
        <DataTable
          title="Buyer Purchase Orders Directory"
          subtitle="Orders placed by client brands"
          columns={buyerPoColumns}
          data={buyerPos}
          isLoading={isBuyerPosLoading}
          isError={isBuyerPosError}
          errorMessage={(buyerPosError as any)?.message}
          onRetry={refetchBuyerPos}
          searchKey="poNumber"
          searchPlaceholder="Search by PO Number..."
          emptyTitle="No Buyer POs Issued"
          emptyDescription="Issue your first Buyer Purchase Order to initiate material demand and production planning."
          emptyActionLabel="Issue Buyer PO"
          onEmptyAction={() => {
            setPoNumber(`PO-${Date.now().toString().slice(-4)}`);
            setBuyerId(buyers.length > 0 ? buyers[0].id : "");
            setStyleId(styles.length > 0 ? styles[0].id : "");
            setCreateBuyerPoOpen(true);
          }}
        />
      )}

      {activeTab === "vpos" && (
        <DataTable
          title="Vendor Purchase Orders (VPO)"
          subtitle="Material procurement orders issued to approved suppliers"
          columns={vpoColumns}
          data={vpos}
          isLoading={isVposLoading}
          isError={isVposError}
          errorMessage={(vposError as any)?.message}
          onRetry={refetchVpos}
          searchKey="vpoNumber"
          searchPlaceholder="Search by VPO Number..."
          emptyTitle="No Vendor POs Issued"
          emptyDescription="Issue a VPO to procure yarns, fabrics, and trims from registered suppliers."
          emptyActionLabel="Issue Vendor PO"
          onEmptyAction={() => {
            setVpoNumber(`VPO-${Date.now().toString().slice(-4)}`);
            setSupplierId(suppliers.length > 0 ? suppliers[0].id : "");
            setCreateVpoOpen(true);
          }}
        />
      )}

      {activeTab === "supplier-returns" && (
        <DataTable
          title="Supplier Return Notes (Debit Notes)"
          subtitle="Authoritative outbound returns for ASTM D5430 rejected materials and defects"
          columns={returnColumns}
          data={supplierReturns}
          isLoading={isReturnsLoading}
          isError={isReturnsError}
          errorMessage={(returnsError as any)?.message}
          onRetry={refetchReturns}
          searchKey="returnNumber"
          searchPlaceholder="Search by Return Number..."
          emptyTitle="No Supplier Returns Recorded"
          emptyDescription="Defective rolls or non-conforming lots returned to suppliers will appear here with automatic inventory deduction."
          emptyActionLabel="Create Supplier Return"
          onEmptyAction={() => {
            setReturnSupplierId(suppliers.length > 0 ? suppliers[0].id : "");
            setReturnMaterialId(materials.length > 0 ? materials[0].id : "");
            setCreateReturnOpen(true);
          }}
        />
      )}

      {/* Create Buyer PO Dialog */}
      <Dialog
        isOpen={createBuyerPoOpen}
        onClose={() => setCreateBuyerPoOpen(false)}
        title="Issue Buyer Purchase Order"
        description="Register a confirmed buyer sales order with SKU quantities and delivery milestone."
      >
        <form onSubmit={handleCreateBuyerPo} className="space-y-4">
          <Input
            label="PO Reference Number"
            placeholder="e.g. PO-8849"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            required
          />

          <Select
            label="Buyer Account"
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
            required
          >
            <option value="">Select Buyer...</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </Select>

          <Select
            label="Ordered Garment Style"
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
            required
          >
            <option value="">Select Garment Style...</option>
            {styles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity (Pcs)"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <Input
              label="Unit Price (USD)"
              type="number"
              step="0.01"
              min="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              required
            />
          </div>

          <Input
            label="Order Date"
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateBuyerPoOpen(false)}
              disabled={createBuyerPoMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createBuyerPoMutation.isPending}
            >
              Issue Buyer PO
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Create VPO Dialog */}
      <Dialog
        isOpen={createVpoOpen}
        onClose={() => setCreateVpoOpen(false)}
        title="Issue Vendor Purchase Order"
        description="Issue a raw material procurement PO to a yarn/fabric vendor with line item specifications."
      >
        <form onSubmit={handleCreateVpo} className="space-y-4">
          <Input
            label="VPO Number"
            placeholder="e.g. VPO-9912"
            value={vpoNumber}
            onChange={(e) => setVpoNumber(e.target.value)}
            required
          />

          <Select
            label="Material Supplier / Vendor"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
          >
            <option value="">Select Supplier...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </Select>

          <Input
            label="Order Date"
            type="date"
            value={vpoOrderDate}
            onChange={(e) => setVpoOrderDate(e.target.value)}
            required
          />

          <div className="p-3 bg-slate-50 rounded-lg space-y-3 border border-slate-100">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Procurement Line Item (Optional)
            </h4>
            <Select
              label="Material"
              value={vpoMaterialId}
              onChange={(e) => setVpoMaterialId(e.target.value)}
            >
              <option value="">Select Material...</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code}) - {m.uom}
                </option>
              ))}
            </Select>

            {vpoMaterialId && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Quantity"
                  type="number"
                  min="1"
                  value={vpoQuantity}
                  onChange={(e) => setVpoQuantity(e.target.value)}
                />
                <Input
                  label="Unit Cost ($)"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={vpoUnitCost}
                  onChange={(e) => setVpoUnitCost(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateVpoOpen(false)}
              disabled={createVpoMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createVpoMutation.isPending}
            >
              Issue Vendor PO
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Create Supplier Return Dialog */}
      <Dialog
        isOpen={createReturnOpen}
        onClose={() => setCreateReturnOpen(false)}
        title="Issue Supplier Return Note"
        description="Return defective fabric rolls or non-conforming materials to the supplier. Ledger inventory will be deducted."
      >
        <form onSubmit={handleCreateSupplierReturn} className="space-y-4">
          <Select
            label="Supplier"
            value={returnSupplierId}
            onChange={(e) => setReturnSupplierId(e.target.value)}
            required
          >
            <option value="">Select Supplier...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </Select>

          <Select
            label="Material to Return"
            value={returnMaterialId}
            onChange={(e) => setReturnMaterialId(e.target.value)}
            required
          >
            <option value="">Select Material...</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.code}) [{m.uom}]
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Return Quantity"
              type="number"
              min="0.01"
              step="any"
              value={returnQuantity}
              onChange={(e) => setReturnQuantity(e.target.value)}
              required
            />
            <Input
              label="UOM"
              value={returnUom}
              onChange={(e) => setReturnUom(e.target.value)}
              required
            />
          </div>

          <Input
            label="Defect Reason / Rejection Justification"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreateReturnOpen(false)}
              disabled={createSupplierReturnMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createSupplierReturnMutation.isPending}
            >
              Confirm & Return to Supplier
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
