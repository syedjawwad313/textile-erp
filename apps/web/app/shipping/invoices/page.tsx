"use client";

import React, { useState } from "react";
import { usePermissions } from "../../../hooks/use-permissions";
import { useAuth } from "../../../lib/auth/auth-context";
import {
  useInvoices,
  useCreateInvoice,
  useIssueInvoice,
  useSettleInvoice,
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
  FileText,
  Plus,
  Eye,
  CheckCircle2,
  DollarSign,
  Printer,
  Calendar,
  Building2,
  CreditCard,
} from "lucide-react";
import { CommercialInvoice } from "../../../lib/api/types";

export default function CommercialInvoicesPage() {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const toast = useToast();

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<CommercialInvoice | null>(null);

  // Settlement Form State
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidAmount, setPaidAmount] = useState<number | string>(0);
  const [settleNotes, setSettleNotes] = useState("");
  const settleInvoiceMutation = useSettleInvoice();

  // Form state
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [incoterms, setIncoterms] = useState("FOB");
  const [paymentTerms, setPaymentTerms] = useState("LC at sight");
  const [freightCharges, setFreightCharges] = useState(0);
  const [insuranceCharges, setInsuranceCharges] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Queries
  const {
    data: invoices = [],
    isLoading,
    refetch,
  } = useInvoices({
    status: selectedStatus || undefined,
  });

  const { data: shipments = [] } = useShipments();
  const eligibleShipments = shipments.filter(
    (s) => s.status !== "CANCELLED" && s.totalCartons > 0,
  );

  const createInvoiceMutation = useCreateInvoice();
  const issueInvoiceMutation = useIssueInvoice();

  // KPIs
  const totalInvoices = invoices.length;
  const issuedInvoices = invoices.filter((i) => i.status === "ISSUED" || i.status === "PAID").length;
  const totalInvoicedValue = invoices.reduce((acc, i) => acc + Number(i.totalAmount || 0), 0);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipmentId) {
      toast.error("Validation Error", "Please select a Shipment");
      return;
    }

    try {
      await createInvoiceMutation.mutateAsync({
        data: {
          shipmentId: selectedShipmentId,
          currency,
          incoterms,
          paymentTerms,
          freightCharges: Number(freightCharges) || 0,
          insuranceCharges: Number(insuranceCharges) || 0,
          discountAmount: Number(discountAmount) || 0,
          taxAmount: Number(taxAmount) || 0,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
        },
        idempotencyKey: `inv-create-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      });

      toast.success("Invoice Generated", "Commercial Invoice generated successfully");
      setCreateModalOpen(false);
      resetForm();
      refetch();
    } catch (err: any) {
      toast.error("Failed to Generate Invoice", err?.message || "Failed to generate invoice");
    }
  };

  const handleIssueInvoice = async (id: string) => {
    try {
      await issueInvoiceMutation.mutateAsync(id);
      toast.success("Invoice Issued", "Commercial Invoice issued successfully");
      refetch();
    } catch (err: any) {
      toast.error("Failed to Issue Invoice", err?.message || "Failed to issue invoice");
    }
  };

  const resetForm = () => {
    setSelectedShipmentId("");
    setCurrency("USD");
    setIncoterms("FOB");
    setPaymentTerms("LC at sight");
    setFreightCharges(0);
    setInsuranceCharges(0);
    setDiscountAmount(0);
    setTaxAmount(0);
    setDueDate("");
    setNotes("");
  };

  if (!can("SHIPPING:READ") && !can("COSTING:READ")) {
    return <ForbiddenState moduleName="Commercial Invoices" requiredPermission="SHIPPING:READ" />;
  }

  const columns: ColumnDef<CommercialInvoice>[] = [
    {
      header: "Invoice #",
      accessorKey: "invoiceNumber",
      cell: (row) => (
        <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
          {row.invoiceNumber}
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
      header: "Buyer",
      cell: (row) => (
        <div className="font-medium text-slate-900 dark:text-slate-100">{row.buyer?.name || "N/A"}</div>
      ),
    },
    {
      header: "Terms",
      cell: (row) => (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <div>{row.incoterms || "FOB"}</div>
          <div className="text-slate-400">{row.paymentTerms || "LC"}</div>
        </div>
      ),
    },
    {
      header: "Total Amount",
      cell: (row) => (
        <div className="font-semibold text-slate-900 dark:text-white">
          {row.currency} {Number(row.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      header: "Status",
      cell: (row) => {
        let variant: "default" | "success" | "warning" | "danger" = "default";
        if (row.status === "ISSUED" || row.status === "PAID") variant = "success";
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
              setActiveInvoice(row);
              setDetailModalOpen(true);
            }}
          >
            <Eye className="w-3.5 h-3.5" /> View
          </Button>
          {row.status === "DRAFT" && can("SHIPPING:WRITE") && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => handleIssueInvoice(row.id)}
            >
              Issue
            </Button>
          )}
          {row.status === "ISSUED" && can("SHIPPING:WRITE") && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => {
                setActiveInvoice(row);
                setPaymentReference(`PMT-${Date.now().toString().slice(-4)}`);
                setPaidAmount(Number(row.totalAmount));
                setSettleModalOpen(true);
              }}
            >
              <CreditCard className="w-3.5 h-3.5" /> Settle
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commercial Invoices"
        description="Generate and issue export commercial invoices with contractual unit prices pulled from Buyer Purchase Orders."
        actions={
          <div className="flex items-center gap-3">
            {can("SHIPPING:WRITE") && (
              <Button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" /> Generate Invoice
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Invoices</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{totalInvoices}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Issued Invoices</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{issuedInvoices}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total Invoiced Value</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              ${totalInvoicedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
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
            <option value="ISSUED">Issued</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <DataTable
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        emptyTitle="No Commercial Invoices"
        emptyDescription="No commercial invoices found. Generate an invoice from a shipment."
      />

      {/* Generate Invoice Dialog */}
      <Dialog open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Generate Commercial Invoice">
        <form onSubmit={handleCreateInvoice} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
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
                  {s.shipmentNumber} — {s.buyer?.name} ({s.totalUnits} pcs)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="PKR">PKR (Rs)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Incoterms
              </label>
              <Input value={incoterms} onChange={(e) => setIncoterms(e.target.value)} placeholder="e.g. FOB Karachi" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Terms
              </label>
              <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. LC at sight" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Freight Charges
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={freightCharges}
                onChange={(e) => setFreightCharges(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Insurance Charges
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={insuranceCharges}
                onChange={(e) => setInsuranceCharges(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createInvoiceMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createInvoiceMutation.isPending ? "Generating..." : "Generate Invoice"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Detail / Export View Dialog */}
      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={activeInvoice ? `Commercial Invoice: ${activeInvoice.invoiceNumber}` : "Invoice Details"}
      >
        {activeInvoice && (
          <div className="space-y-4 max-h-[80vh] overflow-y-auto p-2 bg-white dark:bg-slate-900 rounded-lg">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">COMMERCIAL INVOICE</div>
                <div className="text-xs text-slate-500 font-mono">{activeInvoice.invoiceNumber}</div>
              </div>
              <Badge variant={activeInvoice.status === "ISSUED" ? "success" : "default"}>
                {activeInvoice.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Buyer / Consignee:</span>
                <div className="text-slate-900 dark:text-white font-medium">{activeInvoice.buyer?.name}</div>
                <div className="text-slate-500">Code: {activeInvoice.buyer?.code}</div>
              </div>
              <div className="text-right">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Shipment Details:</span>
                <div className="font-mono">{activeInvoice.shipment?.shipmentNumber}</div>
                <div className="text-slate-500">{activeInvoice.incoterms} • {activeInvoice.paymentTerms}</div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mt-4">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="p-2">HS Code</th>
                    <th className="p-2">Description / Style</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Unit Price</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeInvoice.lines?.map((line) => (
                    <tr key={line.id}>
                      <td className="p-2 font-mono text-slate-500">{line.hsCode || "6109.10"}</td>
                      <td className="p-2 font-medium">{line.description}</td>
                      <td className="p-2 text-right font-semibold">{line.quantity}</td>
                      <td className="p-2 text-right">{activeInvoice.currency} {Number(line.unitPrice).toFixed(2)}</td>
                      <td className="p-2 text-right font-bold">{activeInvoice.currency} {Number(line.totalPrice).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Breakdown */}
            <div className="flex justify-end text-xs">
              <div className="w-64 space-y-1.5 border-t border-slate-200 dark:border-slate-700 pt-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{activeInvoice.currency} {Number(activeInvoice.subtotal).toFixed(2)}</span>
                </div>
                {Number(activeInvoice.freightCharges) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Freight:</span>
                    <span>+{activeInvoice.currency} {Number(activeInvoice.freightCharges).toFixed(2)}</span>
                  </div>
                )}
                {Number(activeInvoice.insuranceCharges) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Insurance:</span>
                    <span>+{activeInvoice.currency} {Number(activeInvoice.insuranceCharges).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Total Amount:</span>
                  <span>{activeInvoice.currency} {Number(activeInvoice.totalAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              <Button onClick={() => setDetailModalOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Settle Invoice Dialog */}
      <Dialog
        isOpen={settleModalOpen}
        onClose={() => setSettleModalOpen(false)}
        title={`Record Payment & Settle — ${activeInvoice?.invoiceNumber}`}
        description="Record commercial payment remittance reference and update status to PAID."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!activeInvoice) return;
            settleInvoiceMutation.mutate(
              {
                id: activeInvoice.id,
                data: {
                  paymentReference: paymentReference.trim(),
                  paymentDate: new Date(paymentDate).toISOString(),
                  paidAmount: Number(paidAmount),
                  notes: settleNotes.trim() || undefined,
                },
              },
              {
                onSuccess: () => {
                  toast.success("Payment Recorded", `Invoice ${activeInvoice.invoiceNumber} is marked PAID.`);
                  setSettleModalOpen(false);
                },
                onError: (err: any) => {
                  toast.error("Settlement Failed", err?.message || "Could not settle invoice.");
                },
              },
            );
          }}
          className="space-y-4"
        >
          <Input
            label="Payment / Wire Reference"
            placeholder="e.g. SWIFT-REF-99213"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Payment Received Date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
            <Input
              label={`Settled Amount (${activeInvoice?.currency || "USD"})`}
              type="number"
              step="0.01"
              min="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              required
            />
          </div>

          <Input
            label="Remittance Notes (Optional)"
            placeholder="e.g. Cleared via Standard Chartered Bank Karachi LC"
            value={settleNotes}
            onChange={(e) => setSettleNotes(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSettleModalOpen(false)}
              disabled={settleInvoiceMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={settleInvoiceMutation.isPending}
            >
              Confirm Settlement
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
