"use client";

import React, { useState } from "react";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Dialog } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useToast } from "../../../components/ui/toast";
import { useBundles, useGenerateBundles } from "../../../hooks/use-bundles";
import { useCuttingRecords } from "../../../hooks/use-production";
import { Bundle, CuttingRecord, BundleStatus } from "../../../lib/api/types";
import {
  QrCode,
  Layers,
  Package,
  Scissors,
  CheckCircle2,
  Tag,
  ArrowRight,
  TrendingUp,
  Boxes,
  Plus,
  Copy,
} from "lucide-react";

export default function BundleManagementPage() {
  const toast = useToast();
  const { data: bundles = [], isLoading: isBundlesLoading } = useBundles();
  const { data: cuttingRecords = [], isLoading: isCuttingLoading } = useCuttingRecords();
  const generateMutation = useGenerateBundles();

  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedCuttingId, setSelectedCuttingId] = useState("");
  const [bundleSize, setBundleSize] = useState<number | string>(20);
  const [customTotalQty, setCustomTotalQty] = useState<number | string>("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [generatedResult, setGeneratedResult] = useState<Bundle[] | null>(null);

  const selectedCuttingRecord = cuttingRecords.find((c) => c.id === selectedCuttingId);

  // Calculate already bundled quantity for the selected cutting record
  const existingBundlesForRecord = bundles.filter(
    (b) => b.cuttingRecordId === selectedCuttingId
  );
  const totalBundledForRecord = existingBundlesForRecord.reduce(
    (sum, b) => sum + Number(b.quantity || 0),
    0
  );
  const availableCuttingCapacity = selectedCuttingRecord
    ? Math.max(0, Number(selectedCuttingRecord.cutQuantity) - totalBundledForRecord)
    : 0;

  const handleOpenGenerateDialog = () => {
    // Pick first cutting record with available capacity
    const recordWithCapacity = cuttingRecords.find((c) => {
      const bundled = bundles
        .filter((b) => b.cuttingRecordId === c.id)
        .reduce((sum, b) => sum + Number(b.quantity || 0), 0);
      return Number(c.cutQuantity) - bundled > 0;
    });

    setSelectedCuttingId(recordWithCapacity ? recordWithCapacity.id : "");
    setBundleSize(20);
    setCustomTotalQty("");
    setFormErrors({});
    setGeneratedResult(null);
    setIsGenerateDialogOpen(true);
  };

  const handleCloseGenerateDialog = () => {
    setIsGenerateDialogOpen(false);
    setGeneratedResult(null);
  };

  const handleSubmitGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs: Record<string, string> = {};
    if (!selectedCuttingId) errs.selectedCuttingId = "Please select a cutting room record.";
    if (!bundleSize || Number(bundleSize) <= 0) {
      errs.bundleSize = "Bundle size must be greater than zero.";
    }

    const qtyToGenerate = customTotalQty
      ? Number(customTotalQty)
      : availableCuttingCapacity;

    if (qtyToGenerate <= 0) {
      errs.customTotalQty = "No available cut capacity to generate bundles.";
    } else if (qtyToGenerate > availableCuttingCapacity) {
      errs.customTotalQty = `Quantity exceeds available capacity (${availableCuttingCapacity} pcs).`;
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        data: {
          cuttingRecordId: selectedCuttingId,
          bundleSize: Number(bundleSize),
          totalQuantity: customTotalQty ? Number(customTotalQty) : undefined,
        },
        idempotencyKey: `gen-bnd-${selectedCuttingId}-${Date.now()}`,
      });

      toast.success(
        "Bundles Generated Successfully",
        `Created ${result.length} serializable bundles (${qtyToGenerate} total pieces).`
      );
      setGeneratedResult(result);
    } catch (err: any) {
      toast.error("Bundle Generation Failed", err?.message || "Could not generate bundles.");
    }
  };

  // KPI Calculations
  const totalBundles = bundles.length;
  const totalPiecesInBundles = bundles.reduce(
    (sum, b) => sum + Number(b.quantity || 0),
    0
  );
  const cutStageBundles = bundles.filter((b) => b.status === "CUT").length;
  const activeOperationsCount = new Set(
    bundles.map((b) => b.currentOperationId).filter(Boolean)
  ).size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Garment Bundle Management & Serialization"
        description="Convert cut garment components into serialized WIP bundles with deterministic barcodes, sequence numbers, and initial workstation operation routing."
        breadcrumbs={[
          { label: "MES", href: "/dashboard" },
          { label: "Bundle Tracking" },
        ]}
        actions={
          <Button variant="primary" size="sm" onClick={handleOpenGenerateDialog}>
            <Plus className="w-4 h-4" />
            Generate Bundles
          </Button>
        }
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Bundles
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalBundles}</div>
              <div className="text-xs text-slate-500 mt-1">Serialized shop floor units</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                WIP Volume (Panels)
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {totalPiecesInBundles.toLocaleString()} pcs
              </div>
              <div className="text-xs text-slate-500 mt-1">Allocated across all bundles</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cut Stage Bundles
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{cutStageBundles}</div>
              <div className="text-xs text-slate-500 mt-1">Awaiting sewing line scan</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Operations
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {activeOperationsCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">WIP distribution stages</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bundles Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Shop Floor WIP Bundles
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Individual barcoded bundle tickets tracked through each workstation operation.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isBundlesLoading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading shop floor bundles...
            </div>
          ) : bundles.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No bundles generated yet. Click &quot;Generate Bundles&quot; to divide cut garment panels into serialized bundles.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">Barcode / Ticket</th>
                    <th className="px-6 py-3.5">Order / Style</th>
                    <th className="px-6 py-3.5">Cutting Ref</th>
                    <th className="px-6 py-3.5">Bundle #</th>
                    <th className="px-6 py-3.5">Quantity</th>
                    <th className="px-6 py-3.5">Current Operation</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bundles.map((bundle) => (
                    <tr key={bundle.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold bg-slate-900 text-slate-100 border border-slate-800">
                          <Tag className="w-3 h-3 text-blue-400" />
                          {bundle.barcode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono font-medium text-slate-900">
                          {bundle.productionOrder?.orderNumber || "PRD-ORDER"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {bundle.productionOrder?.buyerPoLine?.style?.name || "Garment SKU"}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {bundle.cuttingRecordId.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-xs font-mono font-medium text-slate-700">
                        #{bundle.bundleSequence || 1}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 font-mono">
                        {Number(bundle.quantity).toLocaleString()} pcs
                      </td>
                      <td className="px-6 py-4">
                        {bundle.currentOperation ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            Seq {bundle.currentOperation.sequence}: {bundle.currentOperation.operationName}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Initial Cut Stage</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            bundle.status === "FINISHED"
                              ? "success"
                              : bundle.status === "DEFECTIVE"
                              ? "danger"
                              : bundle.status === "IN_SEWING" || bundle.status === "IN_WASHING"
                              ? "info"
                              : "neutral"
                          }
                        >
                          {bundle.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-mono text-slate-400">
                        {new Date(bundle.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Bundles Modal Dialog */}
      <Dialog
        isOpen={isGenerateDialogOpen}
        onClose={handleCloseGenerateDialog}
        title="Generate Granular Garment Bundles"
        description="Subdivide completed fabric cutting records into serialized, barcoded bundle tickets for shop-floor tracking."
      >
        {generatedResult ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-emerald-900">
                Successfully Generated {generatedResult.length} Bundles!
              </h4>
              <p className="text-xs text-emerald-700 mt-1">
                Each bundle is tagged with a unique barcode and routed to the initial manufacturing operation.
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Generated Barcode Tickets:
              </div>
              {generatedResult.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-xs font-mono"
                >
                  <span className="font-semibold text-slate-900">{b.barcode}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
                    {Number(b.quantity)} pcs
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <Button variant="primary" size="sm" onClick={handleCloseGenerateDialog}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitGenerate} className="space-y-4">
            <Select
              label="Source Cutting Record"
              value={selectedCuttingId}
              onChange={(e) => setSelectedCuttingId(e.target.value)}
              error={formErrors.selectedCuttingId}
              required
            >
              <option value="">Select a cutting room record...</option>
              {cuttingRecords.map((c) => {
                const bundled = bundles
                  .filter((b) => b.cuttingRecordId === c.id)
                  .reduce((sum, b) => sum + Number(b.quantity || 0), 0);
                const remaining = Number(c.cutQuantity) - bundled;

                return (
                  <option key={c.id} value={c.id}>
                    {c.productionOrder?.orderNumber || "Order"} — Cut: {Number(c.cutQuantity)} pcs (Remaining: {remaining} pcs)
                  </option>
                );
              })}
            </Select>

            {selectedCuttingRecord && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Cut Pieces:</span>
                  <span className="font-semibold text-slate-900">
                    {Number(selectedCuttingRecord.cutQuantity).toLocaleString()} pcs
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Already Bundled:</span>
                  <span className="font-medium text-slate-700">
                    {totalBundledForRecord.toLocaleString()} pcs
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="text-slate-700 font-semibold">Available to Bundle:</span>
                  <span className="font-bold text-emerald-700">
                    {availableCuttingCapacity.toLocaleString()} pcs
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Bundle Size (pcs / bundle)"
                type="number"
                min="1"
                placeholder="e.g. 20"
                value={bundleSize}
                onChange={(e) => setBundleSize(e.target.value)}
                error={formErrors.bundleSize}
                required
                helperText="Standard batch size for shop floor lines"
              />

              <Input
                label="Total Quantity (Optional Override)"
                type="number"
                min="1"
                placeholder={`Max: ${availableCuttingCapacity}`}
                value={customTotalQty}
                onChange={(e) => setCustomTotalQty(e.target.value)}
                error={formErrors.customTotalQty}
                helperText="Leave blank to bundle all remaining capacity"
              />
            </div>

            {/* Live Preview Calculation */}
            {selectedCuttingRecord && Number(bundleSize) > 0 && availableCuttingCapacity > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-900">
                <div className="font-semibold flex items-center gap-1">
                  <Boxes className="w-3.5 h-3.5 text-blue-600" />
                  Generation Preview:
                </div>
                <div className="mt-1 text-slate-700">
                  {(() => {
                    const qty = customTotalQty ? Number(customTotalQty) : availableCuttingCapacity;
                    const bSize = Number(bundleSize);
                    const fullCount = Math.floor(qty / bSize);
                    const rem = qty % bSize;

                    if (rem > 0) {
                      return `Will yield ${fullCount} full bundles (${bSize} pcs each) + 1 remainder bundle (${rem} pcs) = ${fullCount + 1} total bundles (${qty} pcs).`;
                    }
                    return `Will yield exactly ${fullCount} bundles (${bSize} pcs each) = ${qty} total pieces.`;
                  })()}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCloseGenerateDialog}
                disabled={generateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={generateMutation.isPending}
                disabled={availableCuttingCapacity <= 0}
              >
                Generate Barcodes & Bundles
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
