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
import {
  useNcrs,
  useCreateNcr,
  useUpdateNcrStatus,
  useAddCapaAction,
  useUpdateCapaAction,
} from "../../../hooks/use-ncr";
import { useProductionOrders } from "../../../hooks/use-production";
import { useEmployees } from "../../../hooks/use-master-data";
import {
  NonConformanceReport,
  NcrStatus,
  NcrSource,
  DefectSeverity,
  CapaType,
  CapaStatus,
} from "../../../lib/api/types";
import {
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ListTodo,
} from "lucide-react";

const STATUSES: NcrStatus[] = [
  "OPEN",
  "UNDER_INVESTIGATION",
  "CAPA_ASSIGNED",
  "VERIFIED",
  "CLOSED",
];

export default function NcrPage() {
  const toast = useToast();

  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNcrId, setExpandedNcrId] = useState<string | null>(null);

  const { data: ncrs = [], isLoading } = useNcrs({
    status: selectedStatus !== "ALL" ? (selectedStatus as NcrStatus) : undefined,
    severity: selectedSeverity !== "ALL" ? (selectedSeverity as DefectSeverity) : undefined,
    search: searchQuery || undefined,
  });

  const { data: orders = [] } = useProductionOrders();
  const { data: employees = [] } = useEmployees();

  const createNcrMutation = useCreateNcr();
  const updateStatusMutation = useUpdateNcrStatus();
  const addCapaMutation = useAddCapaAction();
  const updateCapaMutation = useUpdateCapaAction();

  // Create NCR Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<NcrSource>("INLINE_INSPECTION");
  const [severity, setSeverity] = useState<DefectSeverity>("MAJOR");
  const [orderId, setOrderId] = useState("");
  const [description, setDescription] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [containment, setContainment] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Add CAPA Dialog State
  const [isCapaModalOpen, setIsCapaModalOpen] = useState(false);
  const [activeNcrForCapa, setActiveNcrForCapa] = useState<NonConformanceReport | null>(null);
  const [capaType, setCapaType] = useState<CapaType>("CORRECTIVE");
  const [capaDescription, setCapaDescription] = useState("");
  const [capaAssigneeId, setCapaAssigneeId] = useState("");
  const [capaDueDate, setCapaDueDate] = useState("");

  const handleCreateNcrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!description.trim()) {
      setFormError("Description is required.");
      return;
    }

    try {
      await createNcrMutation.mutateAsync({
        data: {
          title: title.trim(),
          source,
          severity,
          productionOrderId: orderId || undefined,
          description: description.trim(),
          rootCause: rootCause.trim() || undefined,
          containmentAction: containment.trim() || undefined,
          createdById: creatorId || employees[0]?.id,
          assignedToId: assigneeId || undefined,
          targetResolutionDate: targetDate || undefined,
        },
        idempotencyKey: `ncr-manual-${Date.now()}`,
      });

      toast.success("Non-Conformance Report created");
      setIsCreateOpen(false);
      setTitle("");
      setDescription("");
      setRootCause("");
      setContainment("");
    } catch (err: any) {
      setFormError(err.message || "Failed to create NCR");
    }
  };

  const handleStatusTransition = async (ncr: NonConformanceReport, nextStatus: NcrStatus) => {
    try {
      await updateStatusMutation.mutateAsync({
        id: ncr.id,
        data: { status: nextStatus },
      });
      toast.success(`NCR ${ncr.ncrNumber} transitioned to ${nextStatus}`);
    } catch (err: any) {
      toast.error(err.message || `Failed to transition status`);
    }
  };

  const handleAddCapaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNcrForCapa) return;

    if (!capaDescription.trim() || !capaAssigneeId || !capaDueDate) {
      toast.error("Please fill in all required CAPA fields.");
      return;
    }

    try {
      await addCapaMutation.mutateAsync({
        ncrId: activeNcrForCapa.id,
        data: {
          actionType: capaType,
          description: capaDescription.trim(),
          assigneeId: capaAssigneeId,
          dueDate: capaDueDate,
        },
      });

      toast.success("CAPA task added successfully");
      setIsCapaModalOpen(false);
      setCapaDescription("");
      setCapaDueDate("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add CAPA task");
    }
  };

  const handleCompleteCapa = async (ncrId: string, capaId: string) => {
    const notes = prompt("Enter CAPA completion notes:") || "Action completed on shop floor";
    try {
      await updateCapaMutation.mutateAsync({
        ncrId,
        capaId,
        data: {
          status: "COMPLETED",
          completionNotes: notes,
        },
      });
      toast.success("CAPA task marked as COMPLETED");
    } catch (err: any) {
      toast.error(err.message || "Failed to complete CAPA task");
    }
  };

  const handleVerifyCapa = async (ncrId: string, capaId: string) => {
    const notes = prompt("Enter verification notes (e.g. Audit re-checked and verified within tolerance):") || "Verified by QA supervisor";
    const verifierId = employees[0]?.id;
    try {
      await updateCapaMutation.mutateAsync({
        ncrId,
        capaId,
        data: {
          status: "VERIFIED",
          verifiedById: verifierId,
          verificationNotes: notes,
        },
      });
      toast.success("CAPA task VERIFIED");
    } catch (err: any) {
      toast.error(err.message || "Failed to verify CAPA task");
    }
  };

  const getNcrStatusBadge = (status: NcrStatus) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="danger" className="text-xs font-mono">OPEN</Badge>;
      case "UNDER_INVESTIGATION":
        return <Badge variant="warning" className="text-xs font-mono">INVESTIGATING</Badge>;
      case "CAPA_ASSIGNED":
        return <Badge variant="info" className="text-xs font-mono">CAPA ASSIGNED</Badge>;
      case "VERIFIED":
        return <Badge variant="outline" className="text-xs font-mono text-emerald-400 border-emerald-500/40">VERIFIED</Badge>;
      case "CLOSED":
        return <Badge variant="outline" className="text-xs font-mono text-slate-400 border-slate-700">CLOSED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openCount = ncrs.filter((n) => n.status === "OPEN").length;
  const investigatingCount = ncrs.filter((n) => n.status === "UNDER_INVESTIGATION").length;
  const capaAssignedCount = ncrs.filter((n) => n.status === "CAPA_ASSIGNED").length;
  const closedCount = ncrs.filter((n) => n.status === "CLOSED" || n.status === "VERIFIED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Non-Conformance Reports (NCR) & CAPA"
        description="Formal quality incident lifecycle, root-cause 5-Whys analysis, and corrective & preventive action tracking"
        breadcrumbs={[
          { label: "Quality Control", href: "/production/quality" },
          { label: "Non-Conformance & CAPA" },
        ]}
        actions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Raise New NCR
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Open NCRs</p>
              <p className="text-2xl font-bold text-rose-400 mt-1">{openCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Under Investigation</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{investigatingCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CAPA Actions Active</p>
              <p className="text-2xl font-bold text-sky-400 mt-1">{capaAssignedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <ListTodo className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Verified & Closed</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{closedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <Input
                  placeholder="Search NCR number, title, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-950 border-slate-800 text-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400">Status:</span>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                options={[
                  { label: "All Statuses", value: "ALL" },
                  ...STATUSES.map((s) => ({ label: s.replace("_", " "), value: s })),
                ]}
                className="w-48 bg-slate-950 border-slate-800 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NCRs Directory & Workflows */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading Non-Conformance Reports...</div>
        ) : ncrs.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800 p-12 text-center text-slate-500">
            <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p>No Non-Conformance Reports found. Good job! All quality checkpoints are clean.</p>
          </Card>
        ) : (
          ncrs.map((ncr) => {
            const isExpanded = expandedNcrId === ncr.id;
            const verifiedCapas = ncr.capaActions?.filter((c) => c.status === "VERIFIED").length || 0;
            const totalCapas = ncr.capaActions?.length || 0;

            return (
              <Card key={ncr.id} className="bg-slate-900 border-slate-800 overflow-hidden">
                <div
                  onClick={() => setExpandedNcrId(isExpanded ? null : ncr.id)}
                  className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-white text-base">{ncr.ncrNumber}</span>
                        {getNcrStatusBadge(ncr.status)}
                        <Badge variant="outline" className="text-xs font-mono">
                          Source: {ncr.source}
                        </Badge>
                        <Badge
                          variant={ncr.severity === "CRITICAL" ? "danger" : "warning"}
                          className="text-[10px] font-mono"
                        >
                          {ncr.severity}
                        </Badge>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-200 mt-1">{ncr.title}</h4>
                      {ncr.productionOrder && (
                        <p className="text-xs text-blue-400 mt-0.5">
                          Order: {ncr.productionOrder.orderNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs font-mono text-slate-400 block">
                        CAPA: {verifiedCapas}/{totalCapas} Verified
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Raised on {new Date(ncr.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>

                {/* Expanded Detail and CAPA Task Board */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-800 bg-slate-950/40 space-y-4">
                    {/* NCR Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
                      <div className="p-3 bg-slate-900/60 rounded border border-slate-800">
                        <span className="text-slate-500 uppercase tracking-wider font-semibold block mb-1">
                          Defect Description
                        </span>
                        <p>{ncr.description}</p>
                      </div>

                      <div className="p-3 bg-slate-900/60 rounded border border-slate-800">
                        <span className="text-slate-500 uppercase tracking-wider font-semibold block mb-1">
                          Immediate Containment Action
                        </span>
                        <p>{ncr.containmentAction || "No containment action logged."}</p>
                      </div>
                    </div>

                    {ncr.rootCause && (
                      <div className="p-3 bg-slate-900/60 rounded border border-slate-800 text-xs text-slate-300">
                        <span className="text-slate-500 uppercase tracking-wider font-semibold block mb-1">
                          Root Cause Analysis (5-Whys)
                        </span>
                        <p>{ncr.rootCause}</p>
                      </div>
                    )}

                    {/* CAPA Tasks List */}
                    <div className="space-y-2 pt-2 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                          <ListTodo className="w-4 h-4 text-sky-400" />
                          Corrective & Preventive Action (CAPA) Tasks
                        </h5>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveNcrForCapa(ncr);
                            setIsCapaModalOpen(true);
                          }}
                          className="text-xs"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add CAPA Task
                        </Button>
                      </div>

                      {(!ncr.capaActions || ncr.capaActions.length === 0) ? (
                        <p className="text-xs text-slate-500 italic p-3 bg-slate-900/40 rounded border border-slate-800">
                          No CAPA tasks logged. Click &quot;Add CAPA Task&quot; to assign corrective or preventive actions.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {ncr.capaActions.map((capa) => (
                            <div
                              key={capa.id}
                              className="p-3 bg-slate-900/80 border border-slate-800 rounded flex flex-wrap items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {capa.actionType}
                                  </Badge>
                                  <span className="font-medium text-white">{capa.description}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 space-x-3">
                                  <span>Assignee: {capa.assignee?.name || "QC Staff"}</span>
                                  <span>Due: {new Date(capa.dueDate).toLocaleDateString()}</span>
                                  {capa.completionNotes && (
                                    <span className="text-emerald-400">Notes: {capa.completionNotes}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {capa.status === "PENDING" && (
                                  <>
                                    <Badge variant="outline" className="text-[10px] font-mono text-amber-400">PENDING</Badge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleCompleteCapa(ncr.id, capa.id)}
                                      className="text-xs text-emerald-400 hover:bg-emerald-500/10"
                                    >
                                      Mark Completed
                                    </Button>
                                  </>
                                )}
                                {capa.status === "COMPLETED" && (
                                  <>
                                    <Badge variant="outline" className="text-[10px] font-mono text-sky-400">COMPLETED</Badge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleVerifyCapa(ncr.id, capa.id)}
                                      className="text-xs text-emerald-400 hover:bg-emerald-500/10"
                                    >
                                      Verify Action
                                    </Button>
                                  </>
                                )}
                                {capa.status === "VERIFIED" && (
                                  <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/40 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> VERIFIED
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status Workflow Action Strip */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <span className="text-xs text-slate-500">
                        Workflow Actions:
                      </span>
                      <div className="flex items-center gap-2">
                        {ncr.status === "OPEN" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusTransition(ncr, "UNDER_INVESTIGATION")}
                            className="text-xs"
                          >
                            Start Investigation
                          </Button>
                        )}
                        {ncr.status === "UNDER_INVESTIGATION" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusTransition(ncr, "CAPA_ASSIGNED")}
                            className="text-xs"
                          >
                            Mark CAPA Assigned
                          </Button>
                        )}
                        {ncr.status === "CAPA_ASSIGNED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusTransition(ncr, "VERIFIED")}
                            className="text-xs text-emerald-400 border-emerald-500/40"
                          >
                            Mark All Verified
                          </Button>
                        )}
                        {ncr.status !== "CLOSED" && (
                          <Button
                            size="sm"
                            onClick={() => handleStatusTransition(ncr, "CLOSED")}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-white"
                          >
                            Close NCR
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Raise NCR Modal Dialog */}
      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Raise Non-Conformance Report"
      >
        <form onSubmit={handleCreateNcrSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              NCR Title *
            </label>
            <Input
              placeholder="e.g. Critical Seam Slippage on Style POLO-01"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Source *
              </label>
              <Select
                value={source}
                onChange={(e) => setSource(e.target.value as NcrSource)}
                options={[
                  { label: "Inline Inspection", value: "INLINE_INSPECTION" },
                  { label: "AQL Lot Audit", value: "AQL_AUDIT" },
                  { label: "Customer Complaint", value: "CUSTOMER_COMPLAINT" },
                  { label: "Material Defect", value: "MATERIAL_DEFECT" },
                  { label: "Internal Audit", value: "INTERNAL_AUDIT" },
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Severity *
              </label>
              <Select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as DefectSeverity)}
                options={[
                  { label: "MAJOR", value: "MAJOR" },
                  { label: "CRITICAL", value: "CRITICAL" },
                  { label: "MINOR", value: "MINOR" },
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Production Order (Optional)
              </label>
              <Select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                options={[
                  { label: "None / Not Specified", value: "" },
                  ...orders.map((o) => ({ label: `${o.orderNumber} (Target: ${Number(o.targetQuantity)})`, value: o.id })),
                ]}
                className="bg-slate-950 border-slate-800 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Target Resolution Date
              </label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="bg-slate-950 border-slate-800 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Defect Description *
            </label>
            <Input
              placeholder="Detailed description of the observed defect or non-conformance..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Immediate Containment Action
            </label>
            <Input
              placeholder="Steps taken immediately to quarantine, halt, or isolate affected parts..."
              value={containment}
              onChange={(e) => setContainment(e.target.value)}
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Root Cause Analysis (5-Whys Summary)
            </label>
            <Input
              placeholder="Why did it happen? Underlying machine, material, or operator cause..."
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={createNcrMutation.isPending}
            >
              {createNcrMutation.isPending ? "Creating..." : "Raise NCR"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add CAPA Action Modal Dialog */}
      <Dialog
        open={isCapaModalOpen}
        onClose={() => setIsCapaModalOpen(false)}
        title={`Add CAPA Action for ${activeNcrForCapa?.ncrNumber}`}
      >
        <form onSubmit={handleAddCapaSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Action Type *
              </label>
              <Select
                value={capaType}
                onChange={(e) => setCapaType(e.target.value as CapaType)}
                options={[
                  { label: "CORRECTIVE (Fix current batch)", value: "CORRECTIVE" },
                  { label: "PREVENTIVE (Systemic prevention)", value: "PREVENTIVE" },
                  { label: "CONTAINMENT (Quarantine & hold)", value: "CONTAINMENT" },
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Due Date *
              </label>
              <Input
                type="date"
                value={capaDueDate}
                onChange={(e) => setCapaDueDate(e.target.value)}
                required
                className="bg-slate-950 border-slate-800 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Assignee Employee *
            </label>
            <Select
              value={capaAssigneeId}
              onChange={(e) => setCapaAssigneeId(e.target.value)}
              options={[
                { label: "Select Employee...", value: "" },
                ...employees.map((e) => ({ label: `${e.name} (${e.code})`, value: e.id })),
              ]}
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Action Description *
            </label>
            <Input
              placeholder="e.g. Replace blunt needle with titanium ball-point needle on Line 2..."
              value={capaDescription}
              onChange={(e) => setCapaDescription(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCapaModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={addCapaMutation.isPending}
            >
              {addCapaMutation.isPending ? "Assigning..." : "Assign Task"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
