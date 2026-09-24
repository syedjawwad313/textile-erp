"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Dialog } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { useToast } from "../../../components/ui/toast";
import {
  useAqlAudits,
  useAqlCalculation,
  useRecordAqlAudit,
} from "../../../hooks/use-aql";
import { useProductionOrders } from "../../../hooks/use-production";
import { useEmployees } from "../../../hooks/use-master-data";
import { useInspectionPlans } from "../../../hooks/use-inspection-plans";
import { useDefectCatalog } from "../../../hooks/use-defect-catalog";
import { useCreateNcr } from "../../../hooks/use-ncr";
import {
  AqlAudit,
  AqlAuditStatus,
  DefectSeverity,
  InspectionStage,
} from "../../../lib/api/types";
import {
  Calculator,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  FileSpreadsheet,
  Layers,
  Lock,
  ArrowRight,
  Trash2,
} from "lucide-react";

interface AuditDefectFormItem {
  defectCode: string;
  severity: DefectSeverity;
  quantity: number;
  notes?: string;
}

export default function AqlAuditsPage() {
  const toast = useToast();

  // Filter state
  const [filterOrderId, setFilterOrderId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const { data: audits = [], isLoading } = useAqlAudits({
    productionOrderId: filterOrderId || undefined,
    status: filterStatus !== "ALL" ? (filterStatus as AqlAuditStatus) : undefined,
  });

  const { data: orders = [] } = useProductionOrders();
  const { data: employees = [] } = useEmployees();
  const { data: plans = [] } = useInspectionPlans({ stage: "FINAL_AUDIT" });
  const { data: catalogDefects = [] } = useDefectCatalog({ active: true });

  const recordAuditMutation = useRecordAqlAudit();
  const createNcrMutation = useCreateNcr();

  // Calculator Widget State
  const [calcLotSize, setCalcLotSize] = useState<number>(1000);
  const [calcLevel, setCalcLevel] = useState<string>("LEVEL_II");
  const [calcMajor, setCalcMajor] = useState<number>(2.5);
  const [calcMinor, setCalcMinor] = useState<number>(4.0);

  const { data: calcResult } = useAqlCalculation({
    lotSize: calcLotSize,
    inspectionLevel: calcLevel,
    aqlMajor: calcMajor,
    aqlMinor: calcMinor,
  });

  // Execute Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [selectedAuditorId, setSelectedAuditorId] = useState<string>("");
  const [auditLotSize, setAuditLotSize] = useState<number>(500);
  const [auditLevel, setAuditLevel] = useState<string>("LEVEL_II");
  const [auditStage, setAuditStage] = useState<InspectionStage>("FINAL_AUDIT");
  const [auditDefects, setAuditDefects] = useState<AuditDefectFormItem[]>([]);
  const [auditNotes, setAuditNotes] = useState("");
  const [auditError, setAuditError] = useState<string | null>(null);

  // Pre-filled NCR Dialog State (Approved Decision #2)
  const [isNcrModalOpen, setIsNcrModalOpen] = useState(false);
  const [ncrTitle, setNcrTitle] = useState("");
  const [ncrDescription, setNcrDescription] = useState("");
  const [ncrContainment, setNcrContainment] = useState("");
  const [ncrOrderId, setNcrOrderId] = useState("");
  const [ncrAuditId, setNcrAuditId] = useState("");
  const [ncrSeverity, setNcrSeverity] = useState<DefectSeverity>("MAJOR");

  // Auto-select first auditor
  useEffect(() => {
    if (employees.length > 0 && !selectedAuditorId) {
      const qc = employees.find((e) => e.type === "QC") || employees[0];
      setSelectedAuditorId(qc.id);
    }
  }, [employees, selectedAuditorId]);

  // When order is selected in audit modal, prefill lot size from completed or target qty
  const handleOrderChange = (orderId: string) => {
    setSelectedOrderId(orderId);
    const ord = orders.find((o) => o.id === orderId);
    if (ord) {
      const lot = Number(ord.completedQty) > 0 ? Number(ord.completedQty) : Number(ord.targetQuantity);
      setAuditLotSize(lot);
    }
  };

  // Live sampling plan for the audit modal
  const { data: activeSamplingPlan } = useAqlCalculation({
    lotSize: auditLotSize,
    inspectionLevel: auditLevel,
    aqlMajor: 2.5,
    aqlMinor: 4.0,
  });

  const addDefectLine = () => {
    const firstCode = catalogDefects[0]?.code || "SEAM_PUCKERING";
    const defaultSev = catalogDefects[0]?.defaultSeverity || "MAJOR";
    setAuditDefects([
      ...auditDefects,
      {
        defectCode: firstCode,
        severity: defaultSev,
        quantity: 1,
      },
    ]);
  };

  const removeDefectLine = (index: number) => {
    setAuditDefects(auditDefects.filter((_, i) => i !== index));
  };

  const updateDefectLine = (index: number, field: keyof AuditDefectFormItem, value: any) => {
    const updated = [...auditDefects];
    updated[index] = { ...updated[index], [field]: value };
    // If defect code changed, auto-update severity from catalog
    if (field === "defectCode") {
      const match = catalogDefects.find((d) => d.code === value);
      if (match) {
        updated[index].severity = match.defaultSeverity;
      }
    }
    setAuditDefects(updated);
  };

  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuditError(null);

    if (!selectedOrderId) {
      setAuditError("Please select a Production Order.");
      return;
    }
    if (!selectedAuditorId) {
      setAuditError("Please select an Auditor.");
      return;
    }

    try {
      const res: any = await recordAuditMutation.mutateAsync({
        data: {
          productionOrderId: selectedOrderId,
          planId: selectedPlanId || undefined,
          stage: auditStage,
          inspectionLevel: auditLevel,
          lotSize: Number(auditLotSize),
          auditorId: selectedAuditorId,
          defects: auditDefects,
          notes: auditNotes || undefined,
        },
        idempotencyKey: `audit-${selectedOrderId}-${Date.now()}`,
      });

      setIsAuditModalOpen(false);

      if (res.status === "FAILED") {
        toast.error(`AQL Audit FAILED: Order placed on Quality Hold`);
        // Prompt auditor to submit pre-filled NCR (Approved Decision #2)
        if (res.prefilledNcr) {
          setNcrTitle(res.prefilledNcr.title);
          setNcrDescription(res.prefilledNcr.description);
          setNcrContainment(res.prefilledNcr.containmentAction);
          setNcrOrderId(res.prefilledNcr.productionOrderId);
          setNcrAuditId(res.prefilledNcr.aqlAuditId);
          setNcrSeverity(res.prefilledNcr.severity as DefectSeverity);
          setIsNcrModalOpen(true);
        }
      } else {
        toast.success(`AQL Audit PASSED: Lot accepted for shipment`);
      }

      setAuditDefects([]);
      setAuditNotes("");
    } catch (err: any) {
      setAuditError(err.message || "Failed to record AQL audit");
    }
  };

  const handleNcrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createNcrMutation.mutateAsync({
        data: {
          title: ncrTitle,
          source: "AQL_AUDIT",
          severity: ncrSeverity,
          productionOrderId: ncrOrderId || undefined,
          aqlAuditId: ncrAuditId || undefined,
          description: ncrDescription,
          containmentAction: ncrContainment,
          createdById: selectedAuditorId || employees[0].id,
        },
        idempotencyKey: `ncr-${ncrAuditId}-${Date.now()}`,
      });

      toast.success("Non-Conformance Report (NCR) submitted successfully");
      setIsNcrModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit NCR");
    }
  };

  const passedCount = audits.filter((a) => a.status === "PASSED").length;
  const failedCount = audits.filter((a) => a.status === "FAILED").length;
  const passRate = audits.length > 0 ? ((passedCount / audits.length) * 100).toFixed(1) : "100.0";

  return (
    <div className="space-y-6">
      <PageHeader
        title="AQL Lot Audits & Statistical Sampling"
        description="ANSI/ASQ Z1.4 / ISO 2859-1 Normal Inspection Level II Acceptance Engine and Final Audits"
        breadcrumbs={[
          { label: "Quality Control", href: "/production/quality" },
          { label: "AQL Audits" },
        ]}
        actions={
          <Button
            onClick={() => setIsAuditModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Execute Lot Audit
          </Button>
        }
      />

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Lot Acceptance Rate</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{passRate}%</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Passed Lots</p>
              <p className="text-2xl font-bold text-white mt-1">{passedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rejected Lots (Holds Applied)</p>
              <p className="text-2xl font-bold text-rose-400 mt-1">{failedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Standard Applied</p>
              <p className="text-sm font-bold text-slate-200 mt-1 font-mono">ISO 2859-1 Level II</p>
              <p className="text-[10px] text-slate-500">Single Normal Sampling</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Calculator className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive ISO 2859-1 Sampling Calculator Widget */}
      <Card className="bg-slate-900 border-slate-800 border-t-2 border-t-blue-500">
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-400" />
            ISO 2859-1 / ANSI/ASQ Z1.4 Sampling Parameter Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Order / Lot Size (Pieces)
              </label>
              <Input
                type="number"
                min={2}
                value={calcLotSize}
                onChange={(e) => setCalcLotSize(Number(e.target.value))}
                className="bg-slate-950 border-slate-800 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Inspection Level
              </label>
              <Select
                value={calcLevel}
                onChange={(e) => setCalcLevel(e.target.value)}
                options={[
                  { label: "Level I (Reduced)", value: "LEVEL_I" },
                  { label: "Level II (Normal Standard)", value: "LEVEL_II" },
                  { label: "Level III (Tightened)", value: "LEVEL_III" },
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Major AQL Target
              </label>
              <Select
                value={String(calcMajor)}
                onChange={(e) => setCalcMajor(Number(e.target.value))}
                options={[
                  { label: "AQL 1.0", value: "1" },
                  { label: "AQL 1.5", value: "1.5" },
                  { label: "AQL 2.5 (Standard)", value: "2.5" },
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Minor AQL Target
              </label>
              <Select
                value={String(calcMinor)}
                onChange={(e) => setCalcMinor(Number(e.target.value))}
                options={[
                  { label: "AQL 2.5", value: "2.5" },
                  { label: "AQL 4.0 (Standard)", value: "4" },
                  { label: "AQL 6.5", value: "6.5" },
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>
          </div>

          {/* Calculator Output Grid */}
          {calcResult && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-950/60 rounded-lg border border-slate-800/80">
              <div className="p-2 border-r border-slate-800/60">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Code Letter
                </span>
                <span className="text-xl font-mono font-bold text-blue-400">
                  {calcResult.codeLetter}
                </span>
              </div>

              <div className="p-2 border-r border-slate-800/60">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Required Sample Size
                </span>
                <span className="text-xl font-mono font-bold text-white">
                  {calcResult.sampleSize} pcs
                </span>
              </div>

              <div className="p-2 border-r border-slate-800/60">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Critical Defect Limit
                </span>
                <span className="text-sm font-mono font-bold text-rose-400 block mt-1">
                  Ac: {calcResult.criticalThreshold.ac} / Re: {calcResult.criticalThreshold.re}
                </span>
              </div>

              <div className="p-2 border-r border-slate-800/60">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Major AQL ({calcResult.aqlMajor}%) Limit
                </span>
                <span className="text-sm font-mono font-bold text-amber-400 block mt-1">
                  Ac: {calcResult.majorThreshold.ac} / Re: {calcResult.majorThreshold.re}
                </span>
              </div>

              <div className="p-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Minor AQL ({calcResult.aqlMinor}%) Limit
                </span>
                <span className="text-sm font-mono font-bold text-sky-400 block mt-1">
                  Ac: {calcResult.minorThreshold.ac} / Re: {calcResult.minorThreshold.re}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audits History Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
          <CardTitle className="text-base text-slate-200">AQL Lot Audit Records</CardTitle>
          <div className="flex items-center gap-3">
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={[
                { label: "All Audit Statuses", value: "ALL" },
                { label: "PASSED Lots", value: "PASSED" },
                { label: "FAILED Lots", value: "FAILED" },
              ]}
              className="w-40 bg-slate-950 border-slate-800 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading audit history...</div>
          ) : audits.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-600" />
              <p>No AQL lot audits recorded yet. Click &quot;Execute Lot Audit&quot; to perform one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs font-semibold text-slate-400 uppercase bg-slate-950/60 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3">Audit #</th>
                    <th className="px-6 py-3">Production Order</th>
                    <th className="px-6 py-3">Lot / Sample Size</th>
                    <th className="px-6 py-3">Defects (Crit/Maj/Min)</th>
                    <th className="px-6 py-3">Max Allowed (Ac)</th>
                    <th className="px-6 py-3">Verdict</th>
                    <th className="px-6 py-3">Auditor</th>
                    <th className="px-6 py-3">Audit Date</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {audits.map((audit) => {
                    const isPassed = audit.status === "PASSED";
                    return (
                      <tr key={audit.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-white">{audit.auditNumber}</td>
                        <td className="px-6 py-4 font-mono text-blue-400">
                          {audit.productionOrder?.orderNumber || "—"}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {audit.sampleSize} / {audit.lotSize} pcs
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          <span className={audit.criticalDefects > 0 ? "text-rose-400 font-bold" : "text-slate-400"}>
                            {audit.criticalDefects}
                          </span>
                          {" / "}
                          <span className={audit.majorDefects > audit.maxAllowedMajor ? "text-rose-400 font-bold" : "text-amber-400"}>
                            {audit.majorDefects}
                          </span>
                          {" / "}
                          <span className={audit.minorDefects > audit.maxAllowedMinor ? "text-rose-400 font-bold" : "text-sky-400"}>
                            {audit.minorDefects}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                          Crit: {audit.maxAllowedCritical} | Maj: {audit.maxAllowedMajor} | Min: {audit.maxAllowedMinor}
                        </td>
                        <td className="px-6 py-4">
                          {isPassed ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono text-xs">
                              PASSED
                            </Badge>
                          ) : (
                            <Badge variant="danger" className="font-mono text-xs flex items-center gap-1 w-fit">
                              <Lock className="w-3 h-3" /> FAILED (HOLD)
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-300">
                          {audit.auditor?.name || "QC Auditor"}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                          {new Date(audit.auditDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!isPassed && (!audit.ncrs || audit.ncrs.length === 0) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setNcrTitle(`NCR for Failed AQL Audit ${audit.auditNumber}`);
                                setNcrDescription(`AQL Lot Audit ${audit.auditNumber} exceeded defect threshold: Critical: ${audit.criticalDefects}, Major: ${audit.majorDefects}, Minor: ${audit.minorDefects}.`);
                                setNcrContainment("Order placed on Quality Hold. Shipment blocked.");
                                setNcrOrderId(audit.productionOrderId);
                                setNcrAuditId(audit.id);
                                setNcrSeverity(audit.criticalDefects > 0 ? "CRITICAL" : "MAJOR");
                                setIsNcrModalOpen(true);
                              }}
                              className="text-xs text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
                            >
                              Raise NCR
                            </Button>
                          )}
                          {audit.ncrs && audit.ncrs.length > 0 && (
                            <Badge variant="outline" className="text-xs font-mono text-blue-400 border-blue-500/30">
                              {audit.ncrs[0].ncrNumber}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execute AQL Audit Modal */}
      <Dialog
        open={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        title="Execute Lot Acceptance Audit"
      >
        <form onSubmit={handleAuditSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {auditError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-xs">
              {auditError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Production Order *
              </label>
              <Select
                value={selectedOrderId}
                onChange={(e) => handleOrderChange(e.target.value)}
                options={[
                  { label: "Select Order...", value: "" },
                  ...orders.map((o) => ({ label: `${o.orderNumber} (Qty: ${Number(o.targetQuantity)})`, value: o.id })),
                ]}
                className="bg-slate-950 border-slate-800 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                QC Auditor *
              </label>
              <Select
                value={selectedAuditorId}
                onChange={(e) => setSelectedAuditorId(e.target.value)}
                options={employees.map((e) => ({ label: `${e.name} (${e.code})`, value: e.id }))}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Lot Size (Pieces) *
              </label>
              <Input
                type="number"
                min={2}
                value={auditLotSize}
                onChange={(e) => setAuditLotSize(Number(e.target.value))}
                required
                className="bg-slate-950 border-slate-800 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Inspection Stage
              </label>
              <Select
                value={auditStage}
                onChange={(e) => setAuditStage(e.target.value as InspectionStage)}
                options={[
                  { label: "Final Shipment Audit", value: "FINAL_AUDIT" },
                  { label: "Pre-Final Audit", value: "PRE_FINAL" },
                  { label: "End-Line Audit", value: "END_LINE" },
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Inspection Plan (Optional)
              </label>
              <Select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                options={[
                  { label: "Standard ANSI Protocol", value: "" },
                  ...plans.map((p) => ({ label: `${p.code} - ${p.name}`, value: p.id })),
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>
          </div>

          {/* Realtime Calculated Sampling Limits Bar */}
          {activeSamplingPlan && (
            <div className="p-3 bg-blue-950/20 border border-blue-800/40 rounded-lg flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400">Sample to Pull: </span>
                <span className="font-mono font-bold text-white">{activeSamplingPlan.sampleSize} pcs</span>
                <span className="text-slate-500 font-mono"> (Letter {activeSamplingPlan.codeLetter})</span>
              </div>
              <div className="space-x-3 font-mono">
                <span className="text-rose-400 font-semibold">Crit Max: {activeSamplingPlan.criticalThreshold.ac}</span>
                <span className="text-amber-400 font-semibold">Maj Max: {activeSamplingPlan.majorThreshold.ac}</span>
                <span className="text-sky-400 font-semibold">Min Max: {activeSamplingPlan.minorThreshold.ac}</span>
              </div>
            </div>
          )}

          {/* Sample Defect Line Items */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Defects Found in Sample
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDefectLine}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Defect
              </Button>
            </div>

            {auditDefects.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded border border-slate-800">
                No defects logged yet. If no defects are added, the sample will be recorded with 0 defects (100% PASS).
              </p>
            ) : (
              auditDefects.map((def, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded">
                  <Select
                    value={def.defectCode}
                    onChange={(e) => updateDefectLine(idx, "defectCode", e.target.value)}
                    options={catalogDefects.map((c) => ({ label: `${c.code} - ${c.name}`, value: c.code }))}
                    className="flex-1 bg-slate-900 border-slate-700 text-xs font-mono"
                  />

                  <Select
                    value={def.severity}
                    onChange={(e) => updateDefectLine(idx, "severity", e.target.value as DefectSeverity)}
                    options={[
                      { label: "MINOR", value: "MINOR" },
                      { label: "MAJOR", value: "MAJOR" },
                      { label: "CRITICAL", value: "CRITICAL" },
                    ]}
                    className="w-28 bg-slate-900 border-slate-700 text-xs"
                  />

                  <Input
                    type="number"
                    min={1}
                    value={def.quantity}
                    onChange={(e) => updateDefectLine(idx, "quantity", Number(e.target.value))}
                    className="w-20 bg-slate-900 border-slate-700 text-xs font-mono"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDefectLine(idx)}
                    className="text-rose-400 hover:text-rose-300 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Auditor Notes
            </label>
            <Input
              placeholder="Overall observations, carton numbers checked..."
              value={auditNotes}
              onChange={(e) => setAuditNotes(e.target.value)}
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAuditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={recordAuditMutation.isPending}
            >
              {recordAuditMutation.isPending ? "Evaluating & Submitting..." : "Evaluate & Submit Audit"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Pre-Filled NCR Creation Modal (Approved Decision #2) */}
      <Dialog
        open={isNcrModalOpen}
        onClose={() => setIsNcrModalOpen(false)}
        title="Raise Non-Conformance Report (NCR)"
      >
        <form onSubmit={handleNcrSubmit} className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300 text-xs flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>The AQL audit failed defect thresholds. An active QualityHold was placed on the production order. Please confirm and submit the Non-Conformance Report below.</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              NCR Title *
            </label>
            <Input
              value={ncrTitle}
              onChange={(e) => setNcrTitle(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Severity Rating
              </label>
              <Select
                value={ncrSeverity}
                onChange={(e) => setNcrSeverity(e.target.value as DefectSeverity)}
                options={[
                  { label: "MAJOR", value: "MAJOR" },
                  { label: "CRITICAL", value: "CRITICAL" },
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Source
              </label>
              <Input
                value="AQL_AUDIT"
                disabled
                className="bg-slate-950 border-slate-800 text-sm font-mono text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Defect Description *
            </label>
            <Input
              value={ncrDescription}
              onChange={(e) => setNcrDescription(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Immediate Containment Action
            </label>
            <Input
              value={ncrContainment}
              onChange={(e) => setNcrContainment(e.target.value)}
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNcrModalOpen(false)}
            >
              Skip NCR for Now
            </Button>
            <Button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={createNcrMutation.isPending}
            >
              {createNcrMutation.isPending ? "Submitting..." : "Submit Formal NCR"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
