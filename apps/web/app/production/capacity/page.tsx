"use client";

import React, { useState } from "react";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import { useLineCapacity } from "../../../hooks/use-production-schedules";
import { useProductionLines, useFactoryUnits } from "../../../hooks/use-master-data";
import { useShifts } from "../../../hooks/use-shifts";
import {
  Gauge,
  Activity,
  AlertTriangle,
  Clock,
  Layers,
  ArrowDownRight,
  ShieldAlert,
  Flame,
  CheckCircle,
} from "lucide-react";

export default function LineCapacityDashboardPage() {
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>("");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const { data: productionLines = [] } = useProductionLines();
  const { data: factories = [] } = useFactoryUnits();
  const { data: shifts = [] } = useShifts();

  const {
    data: capacityMetrics = [],
    isLoading: isCapacityLoading,
  } = useLineCapacity({
    productionLineId: selectedLineId || undefined,
    factoryUnitId: selectedFactoryId || undefined,
    shiftId: selectedShiftId || undefined,
    date: targetDate,
  });

  // Aggregated summary metrics
  const totalNominal = capacityMetrics.reduce((acc, m) => acc + m.nominalShiftCapacity, 0);
  const totalAvailable = capacityMetrics.reduce((acc, m) => acc + m.availableCapacity, 0);
  const totalScheduled = capacityMetrics.reduce((acc, m) => acc + m.scheduledLoad, 0);
  const totalDowntimeMinutes = capacityMetrics.reduce((acc, m) => acc + m.downtimeMinutes, 0);
  const capacityLostFromDowntime = Math.max(0, totalNominal - totalAvailable);
  const averageUtilization =
    totalAvailable > 0
      ? Math.min(100, Math.round((totalScheduled / totalAvailable) * 10000) / 100)
      : totalScheduled > 0
      ? 100
      : 0;

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Line Capacity & Shift Utilization"
        description="Authoritative shift capacity formulas discounting real downtime event losses against scheduled production loads."
      />

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Nominal Shift Capacity
              </p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {Math.round(totalNominal).toLocaleString()} pcs
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Rated standard output</p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Available Working Capacity
              </p>
              <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                {Math.round(totalAvailable).toLocaleString()} pcs
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Net downtime discounted</p>
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
                Downtime Capacity Loss
              </p>
              <h3 className="text-2xl font-bold text-red-400 mt-1">
                -{Math.round(capacityLostFromDowntime).toLocaleString()} pcs
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {totalDowntimeMinutes} min total outages
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Capacity Utilization
              </p>
              <h3
                className={`text-2xl font-bold mt-1 ${
                  averageUtilization > 95
                    ? "text-red-400"
                    : averageUtilization > 80
                    ? "text-amber-400"
                    : "text-sky-400"
                }`}
              >
                {averageUtilization}%
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {Math.round(totalScheduled).toLocaleString()} pcs scheduled load
              </p>
            </div>
            <div className="w-11 h-11 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20">
              <Gauge className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Factory:</span>
            <Select
              value={selectedFactoryId}
              onChange={(e) => setSelectedFactoryId(e.target.value)}
              className="w-44 bg-slate-800 border-slate-700 text-slate-200 text-xs"
            >
              <option value="">All Factories</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.code})
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Line:</span>
            <Select
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="w-44 bg-slate-800 border-slate-700 text-slate-200 text-xs"
            >
              <option value="">All Lines</option>
              {productionLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Shift:</span>
            <Select
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              className="w-44 bg-slate-800 border-slate-700 text-slate-200 text-xs"
            >
              <option value="">All Shifts</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Operating Date:</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="px-3 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Line Capacity Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          Production Lines Shift Allocation & Availability
        </h2>

        {isCapacityLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-64 w-full bg-slate-800" />
            <Skeleton className="h-64 w-full bg-slate-800" />
            <Skeleton className="h-64 w-full bg-slate-800" />
          </div>
        ) : capacityMetrics.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800 p-12 text-center">
            <Gauge className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No line capacity metrics found</p>
            <p className="text-xs text-slate-500 mt-1">
              Verify that production lines and shifts are configured in this factory.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {capacityMetrics.map((metric, idx) => {
              const util = metric.utilizationPercentage;
              const barColor =
                util > 100
                  ? "bg-red-500"
                  : util > 80
                  ? "bg-amber-500"
                  : "bg-emerald-500";

              return (
                <Card
                  key={idx}
                  className={`bg-slate-900/90 border transition-all ${
                    metric.isOverloaded
                      ? "border-red-500/60 shadow-lg shadow-red-950/20"
                      : metric.hasActiveDowntime
                      ? "border-amber-500/40"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">
                          {metric.productionLineCode}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs border-slate-700 text-slate-300"
                        >
                          {metric.shiftCode}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {metric.productionLineName} • {metric.shiftName}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {metric.isOverloaded && (
                        <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs">
                          Overloaded
                        </Badge>
                      )}
                      {metric.hasActiveDowntime && (
                        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Outage Active
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3">
                    {/* Capacity Formula Breakdown */}
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Nominal Shift Target ({metric.shiftHours}h):</span>
                        <span className="font-mono font-semibold text-slate-200">
                          {Math.round(metric.nominalShiftCapacity).toLocaleString()} pcs
                        </span>
                      </div>
                      {metric.downtimeMinutes > 0 && (
                        <div className="flex justify-between text-red-400">
                          <span>Downtime Deduction ({metric.downtimeMinutes}m):</span>
                          <span className="font-mono font-semibold">
                            -
                            {Math.round(
                              metric.nominalShiftCapacity - metric.availableCapacity
                            ).toLocaleString()}{" "}
                            pcs
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-emerald-400 font-semibold pt-1 border-t border-slate-800">
                        <span>Available Net Capacity:</span>
                        <span className="font-mono">
                          {Math.round(metric.availableCapacity).toLocaleString()} pcs
                        </span>
                      </div>
                    </div>

                    {/* Scheduled Load & Utilization */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">
                          Scheduled:{" "}
                          <strong className="text-white font-mono">
                            {Math.round(metric.scheduledLoad).toLocaleString()} pcs
                          </strong>
                        </span>
                        <span className="font-bold text-xs font-mono text-slate-300">
                          {util}% Utilized
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${Math.min(100, util)}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span>Remaining: {Math.round(metric.remainingCapacity)} pcs</span>
                        <span>{metric.activeScheduleCount} scheduled run(s)</span>
                      </div>
                    </div>

                    {/* Active Schedules Pill List */}
                    {metric.schedules.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80 space-y-1">
                        <p className="text-[10px] uppercase font-semibold text-slate-400">
                          Active Scheduled Orders
                        </p>
                        <div className="space-y-1">
                          {metric.schedules.map((s) => (
                            <div
                              key={s.id}
                              className="px-2 py-1 rounded bg-slate-800/60 flex items-center justify-between text-xs"
                            >
                              <span className="font-mono font-bold text-white">
                                {s.orderNumber}
                              </span>
                              <span className="font-mono text-slate-300">
                                {Number(s.plannedQuantity).toLocaleString()} pcs
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
