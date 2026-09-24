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
  useDowntimeEvents,
  useCreateDowntimeEvent,
  useResolveDowntimeEvent,
} from "../../../hooks/use-downtime";
import { useProductionLines, useMachines } from "../../../hooks/use-master-data";
import { DowntimeEvent, DowntimeStatus } from "../../../lib/api/types";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Cpu,
  Layers,
  Activity,
  Plus,
  ZapOff,
  Flame,
  Wrench,
  HelpCircle,
} from "lucide-react";

const REASON_CODES = [
  { value: "MACHINE_BREAKDOWN", label: "Machine Breakdown", icon: Wrench },
  { value: "NEEDLE_BREAKAGE", label: "Needle Breakage", icon: AlertTriangle },
  { value: "MATERIAL_SHORTAGE", label: "Material / Fabric Shortage", icon: Layers },
  { value: "OPERATOR_ABSENT", label: "Operator Absenteeism", icon: Activity },
  { value: "POWER_FAILURE", label: "Power / Utility Failure", icon: ZapOff },
  { value: "QUALITY_HOLD", label: "Quality Inspection Hold", icon: Flame },
  { value: "CHANGEOVER", label: "Style Changeover & Setup", icon: Clock },
  { value: "SCHEDULED_MAINTENANCE", label: "Scheduled Maintenance", icon: Wrench },
  { value: "OTHER", label: "Other Operational Delay", icon: HelpCircle },
];

export default function DowntimeManagementPage() {
  const toast = useToast();
  const { data: downtimeEvents = [], isLoading: isEventsLoading } = useDowntimeEvents();
  const { data: lines = [] } = useProductionLines();
  const { data: machines = [] } = useMachines();

  const createMutation = useCreateDowntimeEvent();
  const resolveMutation = useResolveDowntimeEvent();

  // Log Downtime Dialog State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [selectedReasonCode, setSelectedReasonCode] = useState("MACHINE_BREAKDOWN");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [remarksInput, setRemarksInput] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Resolve Incident Dialog State
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [targetEventToResolve, setTargetEventToResolve] = useState<DowntimeEvent | null>(null);
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");

  const selectedLine = lines.find((l) => l.id === selectedLineId);
  const filteredMachines = machines.filter(
    (m) => !selectedLine || m.factoryUnitId === selectedLine.factoryUnitId
  );

  const handleOpenLogModal = () => {
    setSelectedLineId(lines.length > 0 ? lines[0].id : "");
    setSelectedMachineId("");
    setSelectedReasonCode("MACHINE_BREAKDOWN");
    setStartTimeInput(new Date().toISOString().slice(0, 16));
    setRemarksInput("");
    setFormErrors({});
    setIsLogModalOpen(true);
  };

  const handleOpenResolveModal = (event: DowntimeEvent) => {
    setTargetEventToResolve(event);
    setEndTimeInput(new Date().toISOString().slice(0, 16));
    setResolutionRemarks("");
    setIsResolveModalOpen(true);
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!selectedLineId) errs.selectedLineId = "Please select a production line.";
    if (!selectedReasonCode) errs.selectedReasonCode = "Please select a reason code.";

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    try {
      await createMutation.mutateAsync({
        data: {
          productionLineId: selectedLineId,
          machineId: selectedMachineId || undefined,
          reasonCode: selectedReasonCode,
          startTime: startTimeInput ? new Date(startTimeInput).toISOString() : undefined,
          remarks: remarksInput.trim() || undefined,
        },
        idempotencyKey: `dt-log-${selectedLineId}-${Date.now()}`,
      });

      toast.success("Downtime Incident Logged", "Active stoppage event recorded.");
      setIsLogModalOpen(false);
    } catch (err: any) {
      toast.error("Failed to Log Downtime", err?.message || "Could not log incident.");
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEventToResolve) return;

    try {
      await resolveMutation.mutateAsync({
        id: targetEventToResolve.id,
        data: {
          endTime: endTimeInput ? new Date(endTimeInput).toISOString() : undefined,
          remarks: resolutionRemarks.trim() || undefined,
        },
      });

      toast.success("Incident Resolved", "Downtime event marked as RESOLVED.");
      setIsResolveModalOpen(false);
      setTargetEventToResolve(null);
    } catch (err: any) {
      toast.error("Failed to Resolve Incident", err?.message || "Could not resolve downtime.");
    }
  };

  // KPI Calculations
  const activeEvents = downtimeEvents.filter((e) => e.status === "ACTIVE");
  const activeStoppagesCount = activeEvents.length;
  const affectedLinesCount = new Set(activeEvents.map((e) => e.productionLineId)).size;

  const totalDowntimeMinutes = downtimeEvents.reduce((total, event) => {
    const start = new Date(event.startTime).getTime();
    const end = event.endTime ? new Date(event.endTime).getTime() : Date.now();
    const diffMins = Math.max(0, Math.round((end - start) / (1000 * 60)));
    return total + diffMins;
  }, 0);

  const formatDuration = (startIso: string, endIso?: string | null) => {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const diffMinutes = Math.max(0, Math.round((end - start) / (1000 * 60)));

    if (diffMinutes < 60) return `${diffMinutes}m`;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const reasonCounts: Record<string, number> = {};
  downtimeEvents.forEach((e) => {
    reasonCounts[e.reasonCode] = (reasonCounts[e.reasonCode] || 0) + 1;
  });
  const primaryReason =
    Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None Recorded";

  return (
    <div className="space-y-6">
      <PageHeader
        title="MES Downtime Tracking & Stoppage Management"
        description="Monitor active shop-floor line stoppages, log machine breakdowns, record root causes, and track incident resolution metrics in real-time."
        breadcrumbs={[
          { label: "MES", href: "/dashboard" },
          { label: "Downtime Tracking" },
        ]}
        actions={
          <Button variant="primary" size="sm" onClick={handleOpenLogModal}>
            <Plus className="w-4 h-4" />
            Log Downtime Incident
          </Button>
        }
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                activeStoppagesCount > 0
                  ? "bg-rose-100 text-rose-600 border border-rose-200"
                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
              }`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Stoppages
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {activeStoppagesCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {activeStoppagesCount > 0 ? "Line downtime in progress" : "All stations running normally"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Affected Lines
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {affectedLinesCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">Lines with active incidents</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Stoppage Time
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">
                {totalDowntimeMinutes < 60
                  ? `${totalDowntimeMinutes}m`
                  : `${Math.floor(totalDowntimeMinutes / 60)}h ${totalDowntimeMinutes % 60}m`}
              </div>
              <div className="text-xs text-slate-500 mt-1">Cumulative loss logged</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Primary Root Cause
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1 truncate max-w-[140px]">
                {primaryReason.replace(/_/g, " ")}
              </div>
              <div className="text-xs text-slate-500 mt-1">Most frequent reason code</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incidents Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Downtime & Stoppage Incident Log
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Historical and active manufacturing delay incidents tracked across sewing and assembly lines.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isEventsLoading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading downtime incident log...
            </div>
          ) : downtimeEvents.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No downtime events logged yet. Click &quot;Log Downtime Incident&quot; to report a line stoppage.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Production Line</th>
                    <th className="px-6 py-3.5">Machine Station</th>
                    <th className="px-6 py-3.5">Reason Code</th>
                    <th className="px-6 py-3.5">Duration</th>
                    <th className="px-6 py-3.5">Timeline</th>
                    <th className="px-6 py-3.5">Remarks</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {downtimeEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        {event.status === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            RESOLVED
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div>{event.productionLine?.name || "Production Line"}</div>
                        <div className="text-xs font-mono text-slate-500">
                          {event.productionLine?.code || "LINE-01"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {event.machine ? (
                          <div>
                            <div className="font-medium text-slate-900">{event.machine.name}</div>
                            <div className="text-xs font-mono text-slate-500">{event.machine.code} ({event.machine.type})</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Line-Wide Stoppage</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          {event.reasonCode.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">
                        {formatDuration(event.startTime, event.endTime)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        <div>Start: {new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        {event.endTime && (
                          <div className="text-slate-400">End: {new Date(event.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 max-w-[200px] truncate">
                        {event.remarks || <span className="text-slate-400 italic">—</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {event.status === "ACTIVE" ? (
                          <Button
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                            onClick={() => handleOpenResolveModal(event)}
                          >
                            Resolve
                          </Button>
                        ) : (
                          <span className="text-xs font-mono text-slate-400">Closed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Downtime Modal */}
      <Dialog
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Log Production Downtime Incident"
        description="Record an active line or machine stoppage with timestamp and root cause telemetry."
      >
        <form onSubmit={handleLogSubmit} className="space-y-4">
          <Select
            label="Production Line"
            value={selectedLineId}
            onChange={(e) => {
              setSelectedLineId(e.target.value);
              setSelectedMachineId("");
            }}
            error={formErrors.selectedLineId}
            required
          >
            <option value="">Select a production line...</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.code})
              </option>
            ))}
          </Select>

          <Select
            label="Machine Station (Optional if Line-Wide)"
            value={selectedMachineId}
            onChange={(e) => setSelectedMachineId(e.target.value)}
          >
            <option value="">Line-Wide Stoppage (No Specific Machine)</option>
            {filteredMachines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.code}) — {m.type}
              </option>
            ))}
          </Select>

          <Select
            label="Primary Root Cause / Reason Code"
            value={selectedReasonCode}
            onChange={(e) => setSelectedReasonCode(e.target.value)}
            required
          >
            {REASON_CODES.map((rc) => (
              <option key={rc.value} value={rc.value}>
                {rc.label}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-3">
            <Input
              label="Incident Start Time"
              type="datetime-local"
              value={startTimeInput}
              onChange={(e) => setStartTimeInput(e.target.value)}
              required
            />

            <Input
              label="Supervisor Remarks / Description"
              type="text"
              placeholder="e.g. Motor overheating, waiting for electrician..."
              value={remarksInput}
              onChange={(e) => setRemarksInput(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLogModalOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createMutation.isPending}
            >
              Record Downtime Event
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Resolve Downtime Modal */}
      <Dialog
        isOpen={isResolveModalOpen}
        onClose={() => {
          setIsResolveModalOpen(false);
          setTargetEventToResolve(null);
        }}
        title="Resolve Downtime Incident"
        description="Mark the stoppage event as resolved and log final restoration timestamps."
      >
        {targetEventToResolve && (
          <form onSubmit={handleResolveSubmit} className="space-y-4">
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Production Line:</span>
                <span className="font-semibold text-slate-900">
                  {targetEventToResolve.productionLine?.name}
                </span>
              </div>
              {targetEventToResolve.machine && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Machine:</span>
                  <span className="font-semibold text-slate-900">
                    {targetEventToResolve.machine.name} ({targetEventToResolve.machine.code})
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Reason:</span>
                <span className="font-medium text-slate-800">
                  {targetEventToResolve.reasonCode.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Started At:</span>
                <span className="font-mono text-slate-700">
                  {new Date(targetEventToResolve.startTime).toLocaleString()}
                </span>
              </div>
            </div>

            <Input
              label="Incident End / Restoration Time"
              type="datetime-local"
              value={endTimeInput}
              onChange={(e) => setEndTimeInput(e.target.value)}
              required
            />

            <Input
              label="Resolution Action & Remarks"
              type="text"
              placeholder="e.g. Motor replaced, test run completed successfully..."
              value={resolutionRemarks}
              onChange={(e) => setResolutionRemarks(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsResolveModalOpen(false);
                  setTargetEventToResolve(null);
                }}
                disabled={resolveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                isLoading={resolveMutation.isPending}
              >
                Confirm Resolution
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
