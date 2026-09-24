"use client";

import React, { useState } from "react";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  useShifts,
  useCreateShift,
  useUpdateShift,
  useShiftAssignments,
  useCreateShiftAssignment,
  useDeleteShiftAssignment,
} from "../../../hooks/use-shifts";
import {
  useFactoryUnits,
  useProductionLines,
  useEmployees,
} from "../../../hooks/use-master-data";
import {
  Clock,
  Users,
  Plus,
  Moon,
  Sun,
  Trash2,
  Calendar,
  Layers,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function ShiftsManagementPage() {
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>("");
  const [isCreateShiftOpen, setIsCreateShiftOpen] = useState(false);
  const [activeShiftForRoster, setActiveShiftForRoster] = useState<string | null>(null);
  const [isAssignWorkerOpen, setIsAssignWorkerOpen] = useState(false);
  const [workDate, setWorkDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Form states for Shift creation
  const [newFactoryId, setNewFactoryId] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newStartTime, setNewStartTime] = useState("06:00");
  const [newEndTime, setNewEndTime] = useState("14:30");
  const [newActive, setNewActive] = useState(true);
  const [createShiftError, setCreateShiftError] = useState("");

  // Form states for Assignment creation
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignLineId, setAssignLineId] = useState("");
  const [assignRole, setAssignRole] = useState<"OPERATOR" | "SUPERVISOR" | "QC">("OPERATOR");
  const [assignmentError, setAssignmentError] = useState("");

  const { data: factories = [] } = useFactoryUnits();
  const { data: productionLines = [] } = useProductionLines();
  const { data: employees = [] } = useEmployees();

  const {
    data: shifts = [],
    isLoading: isShiftsLoading,
    refetch: refetchShifts,
  } = useShifts({
    factoryUnitId: selectedFactoryId || undefined,
  });

  const activeShift = shifts.find((s) => s.id === activeShiftForRoster) || shifts[0];

  const {
    data: assignments = [],
    isLoading: isAssignmentsLoading,
  } = useShiftAssignments(activeShift?.id || "", {
    workDate,
  });

  const createShiftMutation = useCreateShift();
  const updateShiftMutation = useUpdateShift();
  const createAssignmentMutation = useCreateShiftAssignment();
  const deleteAssignmentMutation = useDeleteShiftAssignment();

  // Calculated overnight check
  const isOvernightNew = newEndTime <= newStartTime;

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateShiftError("");

    if (!newFactoryId) {
      setCreateShiftError("Please select a factory unit.");
      return;
    }
    if (!newCode.trim() || !newName.trim()) {
      setCreateShiftError("Shift code and name are required.");
      return;
    }

    try {
      await createShiftMutation.mutateAsync({
        factoryUnitId: newFactoryId,
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        startTime: newStartTime,
        endTime: newEndTime,
        active: newActive,
      });
      setIsCreateShiftOpen(false);
      setNewCode("");
      setNewName("");
      refetchShifts();
    } catch (err: any) {
      setCreateShiftError(err?.message || "Failed to create shift");
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignmentError("");

    if (!activeShift) return;
    if (!assignEmployeeId) {
      setAssignmentError("Please select an employee.");
      return;
    }

    try {
      await createAssignmentMutation.mutateAsync({
        shiftId: activeShift.id,
        data: {
          employeeId: assignEmployeeId,
          productionLineId: assignLineId || undefined,
          workDate,
          role: assignRole,
        },
      });
      setIsAssignWorkerOpen(false);
      setAssignEmployeeId("");
      setAssignLineId("");
    } catch (err: any) {
      setAssignmentError(err?.message || "Failed to assign worker");
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!activeShift) return;
    if (confirm("Are you sure you want to remove this employee from the shift roster?")) {
      await deleteAssignmentMutation.mutateAsync({
        shiftId: activeShift.id,
        assignmentId,
      });
    }
  };

  const totalShifts = shifts.length;
  const activeShifts = shifts.filter((s) => s.active).length;
  const overnightShifts = shifts.filter((s) => s.isOvernight).length;
  const totalRosterToday = assignments.length;

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="MES Shift & Workforce Management"
        description="Define plant working shifts, working durations, and assign workforce rosters to production lines."
        actions={
          <Button
            onClick={() => setIsCreateShiftOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Shift
          </Button>
        }
      />

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Shifts
              </p>
              <h3 className="text-2xl font-bold text-white mt-1">{totalShifts}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Configured in factory</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Active Shifts
              </p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">{activeShifts}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Operational lines</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Overnight Shifts
              </p>
              <h3 className="text-2xl font-bold text-amber-400 mt-1">{overnightShifts}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Midnight crossing</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <Moon className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Roster Staffed ({workDate})
              </p>
              <h3 className="text-2xl font-bold text-sky-400 mt-1">{totalRosterToday}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Active shift staff</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-400">Filter by Factory:</span>
          <Select
            value={selectedFactoryId}
            onChange={(e) => setSelectedFactoryId(e.target.value)}
            className="w-56 bg-slate-800 border-slate-700 text-slate-200"
          >
            <option value="">All Factory Units</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.code})
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-400">Roster Date:</span>
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Grid: Left = Shift Definitions, Right = Selected Shift Workforce Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Shift Cards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Configured Shifts
            </h2>
            <span className="text-xs text-slate-400">{shifts.length} shifts found</span>
          </div>

          {isShiftsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full bg-slate-800" />
              <Skeleton className="h-24 w-full bg-slate-800" />
              <Skeleton className="h-24 w-full bg-slate-800" />
            </div>
          ) : shifts.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800 p-8 text-center">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No shifts configured</p>
              <p className="text-xs text-slate-500 mt-1">
                Click &quot;Add Shift&quot; above to define factory working shifts.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {shifts.map((shift) => {
                const isSelected = activeShift?.id === shift.id;
                return (
                  <div
                    key={shift.id}
                    onClick={() => setActiveShiftForRoster(shift.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-800/90 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-950/20"
                        : "bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-base">
                            {shift.name}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs border-slate-700 text-slate-300"
                          >
                            {shift.code}
                          </Badge>
                          {shift.isOvernight && (
                            <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs flex items-center gap-1">
                              <Moon className="w-3 h-3" /> Overnight
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Factory: {shift.factoryUnit?.name || "Global Plant"}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                          {shift.startTime} - {shift.endTime}
                        </span>
                        <p className="text-xs text-indigo-400 font-medium mt-1">
                          {shift.durationHours} hrs ({shift.durationMinutes} min)
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span>Staffed: {shift._count?.assignments ?? 0} operators</span>
                      <span>Scheduled: {shift._count?.schedules ?? 0} runs</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Workforce Shift Roster */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" />
                Shift Workforce Roster
              </h2>
              {activeShift && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Showing assigned workforce for{" "}
                  <strong className="text-slate-200">{activeShift.name}</strong> on{" "}
                  <strong className="text-sky-300">{workDate}</strong>
                </p>
              )}
            </div>

            {activeShift && (
              <Button
                size="sm"
                onClick={() => setIsAssignWorkerOpen(true)}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white"
              >
                <Plus className="w-4 h-4" />
                Assign Worker
              </Button>
            )}
          </div>

          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardContent className="p-0">
              {isAssignmentsLoading ? (
                <div className="p-6 space-y-3">
                  <Skeleton className="h-10 w-full bg-slate-800" />
                  <Skeleton className="h-10 w-full bg-slate-800" />
                  <Skeleton className="h-10 w-full bg-slate-800" />
                </div>
              ) : assignments.length === 0 ? (
                <div className="p-10 text-center">
                  <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium">
                    No workforce assigned for {workDate}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Click &quot;Assign Worker&quot; to staff operators or supervisors to this shift.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-950/80 text-xs uppercase text-slate-400 tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-3.5">Employee</th>
                        <th className="px-4 py-3.5">Assigned Line</th>
                        <th className="px-4 py-3.5">Role</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {assignments.map((assignment) => (
                        <tr
                          key={assignment.id}
                          className="hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-white">
                              {assignment.employee?.name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              {assignment.employee?.code}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {assignment.productionLine ? (
                              <Badge
                                variant="outline"
                                className="bg-slate-800 text-slate-200 border-slate-700"
                              >
                                {assignment.productionLine.code}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-500">Unassigned Line</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge
                              className={`text-xs ${
                                assignment.role === "SUPERVISOR"
                                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                  : assignment.role === "QC"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              }`}
                            >
                              {assignment.role}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-400">
                            {assignment.workDate.slice(0, 10)}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 h-auto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Dialog: Add New Shift */}
      {isCreateShiftOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                Create Operational Shift
              </h3>
              <button
                onClick={() => setIsCreateShiftOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="p-6 space-y-4">
              {createShiftError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createShiftError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Factory Unit *
                </label>
                <Select
                  value={newFactoryId}
                  onChange={(e) => setNewFactoryId(e.target.value)}
                  className="w-full bg-slate-800 border-slate-700 text-slate-200"
                >
                  <option value="">Select Factory Unit...</option>
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.code})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Shift Code *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SHIFT-A, MORNING"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Shift Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Morning Shift"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-400" /> Start Time (24h) *
                  </label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5 text-indigo-400" /> End Time (24h) *
                  </label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {isOvernightNew && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
                  <Moon className="w-4 h-4 shrink-0" />
                  <span>
                    Overnight shift detected: End time is on the next calendar day.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="newActive"
                  checked={newActive}
                  onChange={(e) => setNewActive(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <label htmlFor="newActive" className="text-sm text-slate-300 font-medium">
                  Active Shift (available for line scheduling)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateShiftOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createShiftMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {createShiftMutation.isPending ? "Creating..." : "Save Shift"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog: Assign Worker */}
      {isAssignWorkerOpen && activeShift && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" />
                Assign Worker to {activeShift.name}
              </h3>
              <button
                onClick={() => setIsAssignWorkerOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="p-6 space-y-4">
              {assignmentError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{assignmentError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Employee *
                </label>
                <Select
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                  className="w-full bg-slate-800 border-slate-700 text-slate-200"
                >
                  <option value="">Select Employee...</option>
                  {employees
                    .filter((emp) => !activeShift.factoryUnitId || emp.factoryUnitId === activeShift.factoryUnitId)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.code} - {emp.type})
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Production Line (Optional)
                </label>
                <Select
                  value={assignLineId}
                  onChange={(e) => setAssignLineId(e.target.value)}
                  className="w-full bg-slate-800 border-slate-700 text-slate-200"
                >
                  <option value="">Plant-wide / Floating</option>
                  {productionLines
                    .filter((line) => !activeShift.factoryUnitId || line.factoryUnitId === activeShift.factoryUnitId)
                    .map((line) => (
                      <option key={line.id} value={line.id}>
                        {line.name} ({line.code})
                      </option>
                    ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Work Date *
                  </label>
                  <input
                    type="date"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Assigned Role
                  </label>
                  <Select
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value as any)}
                    className="w-full bg-slate-800 border-slate-700 text-slate-200"
                  >
                    <option value="OPERATOR">Operator</option>
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="QC">QC Inspector</option>
                  </Select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAssignWorkerOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createAssignmentMutation.isPending}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {createAssignmentMutation.isPending ? "Assigning..." : "Assign Worker"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
