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
  useInspectionPlans,
  useCreateInspectionPlan,
} from "../../../hooks/use-inspection-plans";
import { useStyles } from "../../../hooks/use-master-data";
import { InspectionStage, DefectSeverity, InspectionPlan } from "../../../lib/api/types";
import {
  ClipboardList,
  Plus,
  Search,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Tag,
} from "lucide-react";

const STAGES: InspectionStage[] = [
  "IN_LINE",
  "END_LINE",
  "PRE_FINAL",
  "FINAL_AUDIT",
  "FABRIC_INSPECTION",
];

interface CheckpointFormItem {
  checkpoint: string;
  standard: string;
  tolerance: string;
  severity: DefectSeverity;
  sequence: number;
}

export default function InspectionPlansPage() {
  const toast = useToast();

  const [selectedStage, setSelectedStage] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useInspectionPlans({
    stage: selectedStage !== "ALL" ? selectedStage : undefined,
    search: searchQuery || undefined,
  });

  const { data: styles = [] } = useStyles();
  const createPlanMutation = useCreateInspectionPlan();

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [styleId, setStyleId] = useState<string>("");
  const [stage, setStage] = useState<InspectionStage>("FINAL_AUDIT");
  const [aqlLevel, setAqlLevel] = useState<number>(2.5);
  const [inspectionLevel, setInspectionLevel] = useState<string>("LEVEL_II");
  const [checklists, setChecklists] = useState<CheckpointFormItem[]>([
    {
      checkpoint: "Stitch count per inch (SPI)",
      standard: "10-12 SPI on critical seams",
      tolerance: "+/- 1 stitch",
      severity: "MAJOR",
      sequence: 1,
    },
    {
      checkpoint: "Seam appearance and puckering",
      standard: "Smooth seam without wrinkling or pull",
      tolerance: "Zero puckering visible at 3 feet",
      severity: "MAJOR",
      sequence: 2,
    },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const addCheckpointRow = () => {
    setChecklists([
      ...checklists,
      {
        checkpoint: "",
        standard: "",
        tolerance: "",
        severity: "MAJOR",
        sequence: checklists.length + 1,
      },
    ]);
  };

  const removeCheckpointRow = (idx: number) => {
    setChecklists(checklists.filter((_, i) => i !== idx));
  };

  const updateCheckpointRow = (idx: number, field: keyof CheckpointFormItem, value: any) => {
    const updated = [...checklists];
    updated[idx] = { ...updated[idx], [field]: value };
    setChecklists(updated);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!code.trim()) {
      setFormError("Plan code is required.");
      return;
    }
    if (!name.trim()) {
      setFormError("Plan name is required.");
      return;
    }

    const cleanChecklists = checklists
      .filter((c) => c.checkpoint.trim())
      .map((c, i) => ({
        ...c,
        sequence: i + 1,
      }));

    try {
      await createPlanMutation.mutateAsync({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        styleId: styleId || undefined,
        stage,
        aqlLevel: Number(aqlLevel),
        inspectionLevel,
        active: true,
        checklists: cleanChecklists,
      });

      toast.success("Inspection plan created successfully");
      setIsCreateOpen(false);
      setCode("");
      setName("");
      setStyleId("");
      setChecklists([]);
    } catch (err: any) {
      setFormError(err.message || "Failed to create inspection plan");
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedPlanId(expandedPlanId === id ? null : id);
  };

  const getStageBadge = (stg: InspectionStage) => {
    switch (stg) {
      case "FINAL_AUDIT":
        return <Badge variant="danger" className="text-xs font-mono">FINAL AUDIT</Badge>;
      case "PRE_FINAL":
        return <Badge variant="warning" className="text-xs font-mono">PRE-FINAL</Badge>;
      case "END_LINE":
        return <Badge variant="info" className="text-xs font-mono">END-LINE</Badge>;
      case "IN_LINE":
        return <Badge variant="outline" className="text-xs font-mono text-emerald-400 border-emerald-500/40">IN-LINE</Badge>;
      default:
        return <Badge variant="outline">{stg}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inspection Plans & Checklists"
        description="Formal quality specifications, checkpoint standards, and AQL tolerances by inspection stage"
        breadcrumbs={[
          { label: "Quality Control", href: "/production/quality" },
          { label: "Inspection Plans" },
        ]}
        actions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Create Inspection Plan
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <Input
                  placeholder="Search plan code, protocol name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-950 border-slate-800 text-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400">Stage:</span>
              <Select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                options={[
                  { label: "All Inspection Stages", value: "ALL" },
                  ...STAGES.map((s) => ({ label: s.replace("_", " "), value: s })),
                ]}
                className="w-48 bg-slate-950 border-slate-800 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plans List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading inspection plans...</div>
        ) : plans.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800 p-12 text-center text-slate-500">
            <ClipboardList className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p>No inspection plans found. Click &quot;Create Inspection Plan&quot; to define one.</p>
          </Card>
        ) : (
          plans.map((plan) => {
            const isExpanded = expandedPlanId === plan.id;
            return (
              <Card key={plan.id} className="bg-slate-900 border-slate-800 overflow-hidden">
                <div
                  onClick={() => toggleExpand(plan.id)}
                  className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-white text-base">{plan.code}</span>
                        {getStageBadge(plan.stage)}
                        <Badge variant="outline" className="text-xs font-mono">
                          AQL {Number(plan.aqlLevel)} ({plan.inspectionLevel})
                        </Badge>
                      </div>
                      <h4 className="text-sm font-medium text-slate-300 mt-1">{plan.name}</h4>
                      {plan.style && (
                        <p className="text-xs text-blue-400 mt-0.5">
                          Style: {plan.style.code} — {plan.style.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-slate-400">
                      {plan.checklists?.length || 0} Checkpoints
                    </span>
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>

                {/* Expanded Checklists Table */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-800 bg-slate-950/40">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                      Inspection Checkpoints & Standards
                    </h5>
                    {(!plan.checklists || plan.checklists.length === 0) ? (
                      <p className="text-xs text-slate-500 italic">No checklist items defined for this plan.</p>
                    ) : (
                      <div className="overflow-x-auto rounded border border-slate-800">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-950 text-slate-400 uppercase font-semibold">
                            <tr>
                              <th className="px-4 py-2.5">#</th>
                              <th className="px-4 py-2.5">Checkpoint</th>
                              <th className="px-4 py-2.5">Inspection Standard</th>
                              <th className="px-4 py-2.5">Tolerance</th>
                              <th className="px-4 py-2.5">Severity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {plan.checklists.map((chk) => (
                              <tr key={chk.id} className="hover:bg-slate-800/20">
                                <td className="px-4 py-2.5 font-mono text-slate-500">{chk.sequence}</td>
                                <td className="px-4 py-2.5 font-medium text-white">{chk.checkpoint}</td>
                                <td className="px-4 py-2.5 text-slate-300">{chk.standard || "—"}</td>
                                <td className="px-4 py-2.5 font-mono text-amber-400">{chk.tolerance || "—"}</td>
                                <td className="px-4 py-2.5">
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {chk.severity}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Create Inspection Plan Dialog */}
      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Inspection Plan"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-400 text-xs">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Plan Code *
              </label>
              <Input
                placeholder="e.g. PLAN-SHIRT-FINAL"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                className="bg-slate-950 border-slate-800 font-mono text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Inspection Stage *
              </label>
              <Select
                value={stage}
                onChange={(e) => setStage(e.target.value as InspectionStage)}
                options={STAGES.map((s) => ({ label: s.replace("_", " "), value: s }))}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Plan Protocol Name *
            </label>
            <Input
              placeholder="e.g. Polo Shirt Pre-Shipment Audit Protocol"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Style (Optional)
              </label>
              <Select
                value={styleId}
                onChange={(e) => setStyleId(e.target.value)}
                options={[
                  { label: "General Template (All Styles)", value: "" },
                  ...styles.map((s) => ({ label: `${s.code} - ${s.name}`, value: s.id })),
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Target AQL Level
              </label>
              <Select
                value={String(aqlLevel)}
                onChange={(e) => setAqlLevel(Number(e.target.value))}
                options={[
                  { label: "AQL 1.0 (High Strictness)", value: "1" },
                  { label: "AQL 1.5 (Strict)", value: "1.5" },
                  { label: "AQL 2.5 (Industry Standard)", value: "2.5" },
                  { label: "AQL 4.0 (Normal Minor)", value: "4" },
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Inspection Level
              </label>
              <Select
                value={inspectionLevel}
                onChange={(e) => setInspectionLevel(e.target.value)}
                options={[
                  { label: "Level I (Reduced)", value: "LEVEL_I" },
                  { label: "Level II (Normal Standard)", value: "LEVEL_II" },
                  { label: "Level III (Tightened)", value: "LEVEL_III" },
                ]}
                className="bg-slate-950 border-slate-800 text-sm"
              />
            </div>
          </div>

          {/* Dynamic Checklists Builder */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Checkpoints & Verification Criteria
              </h5>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCheckpointRow}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Checkpoint
              </Button>
            </div>

            {checklists.map((chk, idx) => (
              <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                  <Input
                    placeholder="Checkpoint name (e.g. Seam puckering test)..."
                    value={chk.checkpoint}
                    onChange={(e) => updateCheckpointRow(idx, "checkpoint", e.target.value)}
                    required
                    className="flex-1 bg-slate-900 border-slate-700 text-xs"
                  />
                  <Select
                    value={chk.severity}
                    onChange={(e) => updateCheckpointRow(idx, "severity", e.target.value)}
                    options={[
                      { label: "MINOR", value: "MINOR" },
                      { label: "MAJOR", value: "MAJOR" },
                      { label: "CRITICAL", value: "CRITICAL" },
                    ]}
                    className="w-28 bg-slate-900 border-slate-700 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCheckpointRow(idx)}
                    className="text-rose-400 hover:text-rose-300 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Standard (e.g. 10-12 SPI)"
                    value={chk.standard}
                    onChange={(e) => updateCheckpointRow(idx, "standard", e.target.value)}
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                  <Input
                    placeholder="Tolerance (e.g. +/- 1 SPI)"
                    value={chk.tolerance}
                    onChange={(e) => updateCheckpointRow(idx, "tolerance", e.target.value)}
                    className="bg-slate-900 border-slate-700 text-xs"
                  />
                </div>
              </div>
            ))}
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
              disabled={createPlanMutation.isPending}
            >
              {createPlanMutation.isPending ? "Creating..." : "Save Protocol"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
