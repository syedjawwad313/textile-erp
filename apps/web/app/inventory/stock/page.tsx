"use client";

import React, { useState } from "react";
import { usePermissions } from "../../../hooks/use-permissions";
import { useAuth } from "../../../lib/auth/auth-context";
import {
  useInventoryItems,
  useInventoryTransactions,
  useInventorySummary,
} from "../../../hooks/use-inventory-stock";
import { PageHeader } from "../../../components/layout/page-header";
import { DataTable, ColumnDef } from "../../../components/tables/data-table";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { ForbiddenState } from "../../../components/feedback/forbidden-state";
import {
  Warehouse,
  Package,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  History,
  Boxes,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { InventoryItem, InventoryTransaction } from "../../../lib/api/types";

export default function StockLedgerPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<InventoryItem | null>(null);
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);

  const {
    data: items = [],
    isLoading: isLoadingItems,
    isError: isErrorItems,
    error: errorItems,
    refetch: refetchItems,
  } = useInventoryItems(selectedCategory ? { category: selectedCategory } : undefined);

  const { data: summary, isLoading: isLoadingSummary } = useInventorySummary();

  const {
    data: transactions = [],
    isLoading: isLoadingTx,
  } = useInventoryTransactions(
    selectedMaterial?.materialId ? { materialId: selectedMaterial.materialId, limit: 50 } : undefined
  );

  const columns: ColumnDef<InventoryItem>[] = [
    {
      header: "Material Code",
      accessorKey: "materialCode",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-blue-50 text-blue-600">
            <Package className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-slate-900 block">
              {row.materialCode}
            </span>
            <span className="text-[11px] text-slate-500">{row.materialName}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Category",
      accessorKey: "category",
      cell: (row) => (
        <Badge variant="outline" size="sm">
          {row.category}
        </Badge>
      ),
    },
    {
      header: "Warehouse / Bin",
      cell: (row) => (
        <div className="text-xs">
          <span className="font-medium text-slate-800 block">{row.warehouseName || row.warehouseCode}</span>
          <span className="text-slate-500 font-mono text-[11px]">{row.binCode}</span>
        </div>
      ),
    },
    {
      header: "On-Hand Stock",
      accessorKey: "onHand",
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900">
          {(row.onHand ?? 0).toLocaleString()} {row.uom}
        </span>
      ),
    },
    {
      header: "Allocated / Reserved",
      accessorKey: "reserved",
      cell: (row) => (
        <div className="flex items-center gap-1.5 font-mono text-xs">
          {(row.reserved ?? 0) > 0 ? (
            <>
              <Lock className="w-3 h-3 text-amber-500" />
              <span className="text-amber-700 font-medium">{(row.reserved ?? 0).toLocaleString()}</span>
            </>
          ) : (
            <span className="text-slate-400">0</span>
          )}
        </div>
      ),
    },
    {
      header: "Net Available",
      accessorKey: "available",
      cell: (row) => {
        const available = row.available ?? 0;
        const isLow = available <= 0;
        return (
          <span
            className={`font-mono text-xs font-bold ${
              isLow ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {available.toLocaleString()} {row.uom}
          </span>
        );
      },
    },
    {
      header: "Ledger Audit",
      cell: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedMaterial(row);
            setLedgerModalOpen(true);
          }}
          className="h-7 text-xs flex items-center gap-1"
        >
          <History className="w-3 h-3 text-slate-500" />
          Audit Trail
        </Button>
      ),
    },
  ];

  if (!can("INVENTORY:READ")) {
    return (
      <ForbiddenState
        requiredPermission="INVENTORY:READ"
        moduleName="Stock Ledger & Warehouse Control"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Ledger & Material Balances"
        description="Server-authoritative double-entry perpetual inventory ledger with real-time lot, bin, and reservation tracking."
        breadcrumbs={[
          { label: "ERP", href: "/dashboard" },
          { label: "Materials & Warehouse", href: "/inventory" },
          { label: "Stock Ledger" },
        ]}
      />

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">
              Total Materials (SKUs)
            </span>
            <span className="text-xl font-bold text-slate-900">
              {isLoadingSummary ? "..." : summary?.totalMaterials ?? items.length}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">
              Total On-Hand Units
            </span>
            <span className="text-xl font-bold text-slate-900">
              {isLoadingSummary ? "..." : summary?.totalOnHand?.toLocaleString() ?? 0}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">
              Hard Reserved Units
            </span>
            <span className="text-xl font-bold text-slate-900">
              {isLoadingSummary ? "..." : summary?.totalReserved?.toLocaleString() ?? 0}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">
              Available to Promise
            </span>
            <span className="text-xl font-bold text-indigo-600">
              {isLoadingSummary ? "..." : summary?.totalAvailable?.toLocaleString() ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {["", "FABRIC", "TRIM", "ACCESSORY", "YARN"].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              selectedCategory === cat
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {cat || "All Categories"}
          </button>
        ))}
      </div>

      {/* Main Stock Ledger Table */}
      <DataTable
        title="Stock Balances & Storage Locations"
        subtitle="Bin-level inventory balances updated atomically via double-entry transactions"
        columns={columns}
        data={items}
        isLoading={isLoadingItems}
        isError={isErrorItems}
        errorMessage={(errorItems as any)?.message}
        onRetry={refetchItems}
        searchKey="materialName"
        searchPlaceholder="Search by material code or name..."
        emptyTitle="No Material Stock Found"
        emptyDescription="Post a Goods Receipt Note (GRN) to populate on-hand raw material stock."
      />

      {/* Audit Trail Drawer / Modal */}
      <Dialog
        isOpen={ledgerModalOpen}
        onClose={() => {
          setLedgerModalOpen(false);
          setSelectedMaterial(null);
        }}
        title={`Ledger Audit Trail: ${selectedMaterial?.materialCode || ""}`}
        description={`Authoritative transaction history for ${selectedMaterial?.materialName || ""}`}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {isLoadingTx ? (
            <div className="py-8 text-center text-slate-400 text-sm">Loading ledger entries...</div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">No transaction entries found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((tx: InventoryTransaction) => {
                const isPositive = ["RECEIPT", "RETURN", "TRANSFER_IN"].includes(tx.type);
                return (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-1.5 rounded-full ${
                          isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        }`}
                      >
                        {isPositive ? (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 uppercase tracking-wide text-[11px]">
                            {tx.type}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Ref: {tx.reference || "N/A"}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {tx.notes || "System posted transaction"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-mono font-bold block ${
                          isPositive ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {isPositive ? "+" : "-"}
                        {Math.abs(tx.quantity).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(tx.createdAt || tx.timestamp || "").toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLedgerModalOpen(false);
                setSelectedMaterial(null);
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
