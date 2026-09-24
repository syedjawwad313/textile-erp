"use client";

import React, { useState } from "react";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  useProductionSchedules,
  useCreateSchedule,
  useUpdateSchedule,
  useScheduleConflicts,
} from "../../../hooks/use-production-schedules";
import { useProductionLines } from "../../../hooks/use-master-data";
import { useProductionOrders } from "../../../hooks/use-production";
import { useShifts } from "../../../hooks/use-shifts";
import {
  Calendar,
  Clock,
  AlertTriangle,
  Layers,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  Filter,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { ScheduleStatus } from "../../../lib/api/types";

export default function ProductionSchedulingPage() {
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // Form states for creating schedule
  const [newOrderId, setNewOrderId] = useState("");
  const [newLineId, setNewLineId] = useState("");
  const [newShiftId, setNewShiftId] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newStart, setNewStart] = useState(
    new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  );
  const [newEnd, setNewEnd] = useState(
    new Date(Date.now() + 28800000).toISOString().slice(0, 16)
  );
  const [newPlannedQty, setNewPlannedQty] = useState<number>(500);
  const [newNotes, setNewNotes] = useState("");
  const [createError, setCreateError] = useState("");

  const { data: productionLines = [] } = useProductionLines();
  const { data: productionOrders = [] } = useProductionOrders();
  const { data: shifts = [] } = useShifts();

  const {
    data: schedules = [],
    isLoading: isSchedulesLoading,
    refetch: refetchSchedules,
  } = useProductionSchedules({
    productionLineId: selectedLineId || undefined,
    status: (selectedStatus as ScheduleStatus) || undefined,
  });

  const { data: conflictReport } = useScheduleConflicts({
    productionLineId: selectedLineId || undefined,
  });

  const createScheduleMutation = useCreateSchedule();
  const updateScheduleMutation = useUpdateSchedule();

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");

    if (!newOrderId || !newLineId) {
      setCreateError("Please select both a production order and production line.");
      return;
    }
    if (new Date(newEnd) <= new Date(newStart)) {
      setCreateError("Scheduled End time must be after Scheduled Start time.");
      return;
    }

    try {
      await createScheduleMutation.mutateAsync({
        data: {
          productionOrderId: newOrderId,
          productionLineId: newLineId,
          shiftId: newShiftId || undefined,
          scheduledDate: newDate,
          scheduledStart: new Date(newStart).toISOString(),
          scheduledEnd: new Date(newEnd).toISOString(),
          plannedQuantity: Number(newPlannedQty),
          notes: newNotes.trim() || undefined,
        },
      });
      setIsCreateModalOpen(false);
      setNewNotes("");
      refetchSchedules();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create schedule. Possible overlap detected.");
    }
  };

  const handleStatusTransition = async (scheduleId: string, status: ScheduleStatus) => {
    try {
      await updateScheduleMutation.mutateAsync({
        id: scheduleId,
        data: { status },
      });
    } catch (err: any) {
      alert(err?.message || "Failed to update schedule status");
    }
  };

  const totalSchedules = schedules.length;
  const inProgressCount = schedules.filter((s) => s.status === "IN_PROGRESS").length;
  const scheduledCount = schedules.filter((s) => s.status === "SCHEDULED").length;
  const completedCount = schedules.filter((s) => s.status === "COMPLETED").length;

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Production Scheduling & Line Slotting"
        description="Schedule released production orders against sewing/assembly lines and shifts with automated overlap collision protection."
        actions={
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Schedule Run
          </Button>
        }
      />

      {/* Conflict Alerts Banner */}
      {conflictReport?.hasConflicts && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 animate-in fade-in">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5 flex-1">
              <h4 className="text-sm font-bold text-red-200">
                {conflictReport.count} Schedule Conflict(s) Detected on Shop Floor
              </h4>
              <div className="space-y-1 text-xs">
                {conflictReport.conflicts.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                    <span>{c.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Schedules
              </p>
              <h3 className="text-2xl font-bold text-white mt-1">{totalSchedules}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Across production lines</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <Calendar className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Running In-Progress
              </p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                {inProgressCount}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Currently active on floor</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <Play className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Upcoming Scheduled
              </p>
              <h3 className="text-2xl font-bold text-sky-400 mt-1">{scheduledCount}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Queued slots</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Completed
              </p>
              <h3 className="text-2xl font-bold text-purple-400 mt-1">{completedCount}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Finished schedule runs</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-400">Line:</span>
          <Select
            value={selectedLineId}
            onChange={(e) => setSelectedLineId(e.target.value)}
            className="w-52 bg-slate-800 border-slate-700 text-slate-200"
          >
            <option value="">All Production Lines</option>
            {productionLines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.code})
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-400">Status:</span>
          <Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-44 bg-slate-800 border-slate-700 text-slate-200"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </Select>
        </div>
      </div>

      {/* Schedules Table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <CardHeader className="p-5 border-b border-slate-800">
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            Production Schedule Slots
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isSchedulesLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-12 w-full bg-slate-800" />
              <Skeleton className="h-12 w-full bg-slate-800" />
              <Skeleton className="h-12 w-full bg-slate-800" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No production schedules found</p>
              <p className="text-xs text-slate-500 mt-1">
                Click &quot;Schedule Run&quot; to reserve capacity and assign an order to a line.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Order</th>
                    <th className="px-4 py-3.5">Line</th>
                    <th className="px-4 py-3.5">Shift</th>
                    <th className="px-4 py-3.5">Time Window</th>
                    <th className="px-4 py-3.5 text-right">Planned Pcs</th>
                    <th className="px-4 py-3.5 text-right">Actual Pcs</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {schedules.map((schedule) => {
                    const startStr = new Date(schedule.scheduledStart).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const endStr = new Date(schedule.scheduledEnd).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <tr
                        key={schedule.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <span className="font-bold text-white font-mono">
                            {schedule.productionOrder?.orderNumber}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className="bg-slate-800 text-slate-200 border-slate-700"
                          >
                            {schedule.productionLine?.code}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          {schedule.shift ? (
                            <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs">
                              {schedule.shift.code}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-500">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <span>{startStr}</span>
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span>{endStr}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-white font-mono">
                          {Number(schedule.plannedQuantity).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-300">
                          {Number(schedule.actualQuantity).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge
                            className={`text-xs ${
                              schedule.status === "IN_PROGRESS"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : schedule.status === "SCHEDULED"
                                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                : schedule.status === "COMPLETED"
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {schedule.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {schedule.status === "SCHEDULED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleStatusTransition(schedule.id, "IN_PROGRESS")
                                }
                                className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 h-7 px-2"
                              >
                                Start
                              </Button>
                            )}
                            {schedule.status === "IN_PROGRESS" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleStatusTransition(schedule.id, "COMPLETED")
                                }
                                className="text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30 h-7 px-2"
                              >
                                Complete
                              </Button>
                            )}
                            {(schedule.status === "SCHEDULED" ||
                              schedule.status === "IN_PROGRESS") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleStatusTransition(schedule.id, "CANCELLED")
                                }
                                className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2"
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
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

      {/* Modal: Schedule New Run */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                Schedule Production Run
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Production Order *
                </label>
                <Select
                  value={newOrderId}
                  onChange={(e) => setNewOrderId(e.target.value)}
                  className="w-full bg-slate-800 border-slate-700 text-slate-200"
                >
                  <option value="">Select Production Order...</option>
                  {productionOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} (Target: {Number(o.targetQuantity).toLocaleString()} pcs)
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Production Line *
                  </label>
                  <Select
                    value={newLineId}
                    onChange={(e) => setNewLineId(e.target.value)}
                    className="w-full bg-slate-800 border-slate-700 text-slate-200"
                  >
                    <option value="">Select Line...</option>
                    {productionLines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Operating Shift (Optional)
                  </label>
                  <Select
                    value={newShiftId}
                    onChange={(e) => setNewShiftId(e.target.value)}
                    className="w-full bg-slate-800 border-slate-700 text-slate-200"
                  >
                    <option value="">Standard Operating Day</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Scheduled Date *
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Start Timestamp *
                  </label>
                  <input
                    type="datetime-local"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    End Timestamp *
                  </label>
                  <input
                    type="datetime-local"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Planned Output Target (pcs) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={newPlannedQty}
                  onChange={(e) => setNewPlannedQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Special instructions or setup remarks..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createScheduleMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {createScheduleMutation.isPending ? "Validating & Scheduling..." : "Confirm Schedule"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
