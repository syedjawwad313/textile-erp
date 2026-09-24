"use client";

import React, { useState } from "react";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { Skeleton } from "../../../components/ui/skeleton";
import { useProductionLines } from "../../../hooks/use-master-data";
import { useProductionOrders } from "../../../hooks/use-production";
import {
  useAnalyticsOverview,
  useOrderProgressAnalytics,
  useLinePerformanceAnalytics,
  useDowntimeAnalytics,
  useQualityAnalytics,
  useWipBottlenecks,
} from "../../../hooks/use-production-analytics";
import { useShifts } from "../../../hooks/use-shifts";
import { useLineCapacity, useScheduleConflicts } from "../../../hooks/use-production-schedules";
import Link from "next/link";
import {
  Activity,
  Layers,
  AlertTriangle,
  ShieldAlert,
  Clock,
  TrendingUp,
  Boxes,
  CheckCircle2,
  RefreshCw,
  Gauge,
  Sparkles,
  ChevronRight,
  Flame,
  PieChart,
} from "lucide-react";

export default function OperationsCommandCenterPage() {
  const [selectedLineId, setSelectedLineId] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");

  const filterParams = {
    productionLineId: selectedLineId || undefined,
    productionOrderId: selectedOrderId || undefined,
  };

  // Live queries backed by authoritative backend analytics
  const { data: overview, isLoading: isOverviewLoading, refetch: refetchOverview } = useAnalyticsOverview(filterParams);
  const { data: orderProgress = [], isLoading: isOrdersLoading, refetch: refetchOrders } = useOrderProgressAnalytics(filterParams);
  const { data: linePerformance = [], isLoading: isLinesLoading, refetch: refetchLines } = useLinePerformanceAnalytics(filterParams);
  const { data: downtimeData, isLoading: isDowntimeLoading, refetch: refetchDowntime } = useDowntimeAnalytics(filterParams);
  const { data: qualityData, isLoading: isQualityLoading, refetch: refetchQuality } = useQualityAnalytics(filterParams);
  const { data: wipBottlenecks = [], isLoading: isWipLoading, refetch: refetchWip } = useWipBottlenecks(filterParams);

  const { data: lines = [] } = useProductionLines();
  const { data: orders = [] } = useProductionOrders();

  // Phase 5.8 Shift, Capacity & Schedule telemetry
  const { data: activeShifts = [], refetch: refetchShifts } = useShifts({ active: true });
  const { data: capacityMetrics = [], refetch: refetchCapacity } = useLineCapacity({
    productionLineId: selectedLineId || undefined,
  });
  const { data: conflictReport, refetch: refetchConflicts } = useScheduleConflicts({
    productionLineId: selectedLineId || undefined,
  });

  const totalNominalCap = capacityMetrics.reduce((acc, c) => acc + c.nominalShiftCapacity, 0);
  const totalAvailableCap = capacityMetrics.reduce((acc, c) => acc + c.availableCapacity, 0);
  const totalScheduledCap = capacityMetrics.reduce((acc, c) => acc + c.scheduledLoad, 0);
  const totalDowntimeCapLost = Math.max(0, totalNominalCap - totalAvailableCap);
  const avgPlantUtil =
    totalAvailableCap > 0
      ? Math.min(100, Math.round((totalScheduledCap / totalAvailableCap) * 10000) / 100)
      : totalScheduledCap > 0
      ? 100
      : 0;

  const handleRefreshAll = () => {
    refetchOverview();
    refetchOrders();
    refetchLines();
    refetchDowntime();
    refetchQuality();
    refetchWip();
    refetchShifts();
    refetchCapacity();
    refetchConflicts();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="MES Operations Command Center"
          description="Authoritative, real-time shop-floor operational intelligence and production telemetry"
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleRefreshAll} className="h-9">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="bg-slate-900/90 text-white border-slate-800 shadow-md">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-64">
                <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Filter by Production Line
                </label>
                <Select
                  value={selectedLineId}
                  onChange={(e) => setSelectedLineId(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-xs h-8"
                >
                  <option value="">All Production Lines</option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} - {l.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-64">
                <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Filter by Production Order
                </label>
                <Select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-xs h-8"
                >
                  <option value="">All Active Orders</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} ({o.status})
                    </option>
                  ))}
                </Select>
              </div>

              {(selectedLineId || selectedOrderId) && (
                <div className="self-end pb-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedLineId("");
                      setSelectedOrderId("");
                    }}
                    className="text-xs text-slate-400 hover:text-white h-8"
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-300 font-mono">Live PostgreSQL Stream (10s sync)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 1. TOP KPI STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Active Orders */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Orders</span>
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2">
              {isOverviewLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-black text-slate-900">{overview?.activeOrdersCount ?? 0}</div>
              )}
              <span className="text-[11px] text-slate-400">In Released / Running</span>
            </div>
          </CardContent>
        </Card>

        {/* Today's Good Output */}
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today&apos;s Output</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2">
              {isOverviewLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-black text-slate-900">
                  {overview?.todayOutputQuantity.toLocaleString() ?? 0}
                </div>
              )}
              <span className="text-[11px] text-slate-400">Good units passed</span>
            </div>
          </CardContent>
        </Card>

        {/* Shop-Floor WIP */}
        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Shop-Floor WIP</span>
              <Boxes className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2">
              {isOverviewLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-black text-slate-900">
                  {overview?.wipQuantity.toLocaleString() ?? 0}
                </div>
              )}
              <span className="text-[11px] text-slate-400">Pcs queued in lines</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Downtime */}
        <Card
          className={`border-l-4 ${
            (overview?.activeDowntimeIncidents || 0) > 0
              ? "border-l-red-500 bg-red-50/20"
              : "border-l-slate-400"
          } shadow-sm`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Line Stoppages</span>
              <AlertTriangle
                className={`w-4 h-4 ${
                  (overview?.activeDowntimeIncidents || 0) > 0 ? "text-red-500 animate-pulse" : "text-slate-400"
                }`}
              />
            </div>
            <div className="mt-2">
              {isOverviewLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div
                  className={`text-2xl font-black ${
                    (overview?.activeDowntimeIncidents || 0) > 0 ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  {overview?.activeDowntimeIncidents ?? 0}
                </div>
              )}
              <span className="text-[11px] text-slate-400">Active incidents</span>
            </div>
          </CardContent>
        </Card>

        {/* Defect Rate */}
        <Card className="border-l-4 border-l-rose-500 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Defect Rate</span>
              <Gauge className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2">
              {isOverviewLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-black text-slate-900">{overview?.defectRate ?? 0}%</div>
              )}
              <span className="text-[11px] text-slate-400">Global rejection rate</span>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Orders */}
        <Card
          className={`border-l-4 ${
            (overview?.overdueOrdersCount || 0) > 0
              ? "border-l-orange-500 bg-orange-50/20"
              : "border-l-slate-400"
          } shadow-sm`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue Orders</span>
              <Clock
                className={`w-4 h-4 ${
                  (overview?.overdueOrdersCount || 0) > 0 ? "text-orange-500" : "text-slate-400"
                }`}
              />
            </div>
            <div className="mt-2">
              {isOverviewLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div
                  className={`text-2xl font-black ${
                    (overview?.overdueOrdersCount || 0) > 0 ? "text-orange-600" : "text-slate-900"
                  }`}
                >
                  {overview?.overdueOrdersCount ?? 0}
                </div>
              )}
              <span className="text-[11px] text-slate-400">Behind schedule</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PHASE 5.8: ACTIVE SHIFTS, LINE CAPACITY & SCHEDULING CONFLICTS */}
      <Card className="bg-slate-900 border-slate-800 text-white shadow-md overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Shift Operations & Capacity Control
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px]">
                    Phase 5.8
                  </Badge>
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time working capacity and shift adherence tracking
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/production/shifts">
                <Button size="sm" variant="outline" className="text-xs bg-slate-800 border-slate-700 text-slate-200 h-8">
                  Shift Roster
                </Button>
              </Link>
              <Link href="/production/scheduling">
                <Button size="sm" variant="outline" className="text-xs bg-slate-800 border-slate-700 text-slate-200 h-8">
                  Scheduling Board
                </Button>
              </Link>
              <Link href="/production/capacity">
                <Button size="sm" className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white h-8">
                  Capacity Center
                </Button>
              </Link>
            </div>
          </div>

          {/* Conflict Alert if any */}
          {conflictReport?.hasConflicts && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  <strong>{conflictReport.count} Scheduling Collision(s) Detected:</strong>{" "}
                  {conflictReport.conflicts[0]?.message}
                </span>
              </div>
              <Link href="/production/scheduling" className="underline text-red-200 font-semibold hover:text-white">
                Resolve &rarr;
              </Link>
            </div>
          )}

          {/* Shift Badges & Capacity Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
            {/* Active Shifts */}
            <div className="lg:col-span-6 space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Operating Shifts on Shop Floor
              </p>
              {activeShifts.length === 0 ? (
                <p className="text-xs text-slate-500">No active shifts configured.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeShifts.map((s) => (
                    <div
                      key={s.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 flex items-center gap-2.5 text-xs"
                    >
                      <span className="font-bold text-white">{s.name}</span>
                      <span className="font-mono text-slate-400">
                        {s.startTime} - {s.endTime}
                      </span>
                      <Badge variant="outline" className="text-[10px] border-slate-600 text-indigo-300">
                        {s.durationHours}h
                      </Badge>
                      {s.isOvernight && (
                        <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-300">
                          Overnight
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Capacity & Load Bar */}
            <div className="lg:col-span-6 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[11px]">
                  Plant Working Capacity Utilization
                </span>
                <span className="font-mono font-bold text-white">
                  {Math.round(totalScheduledCap).toLocaleString()} /{" "}
                  {Math.round(totalAvailableCap).toLocaleString()} pcs ({avgPlantUtil}%)
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    avgPlantUtil > 100
                      ? "bg-red-500"
                      : avgPlantUtil > 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, avgPlantUtil)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Rated: {Math.round(totalNominalCap).toLocaleString()} pcs</span>
                {totalDowntimeCapLost > 0 && (
                  <span className="text-red-400">
                    Downtime Loss: -{Math.round(totalDowntimeCapLost).toLocaleString()} pcs
                  </span>
                )}
                <span>Remaining: {Math.max(0, Math.round(totalAvailableCap - totalScheduledCap)).toLocaleString()} pcs</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. PRODUCTION LINE STATUS BOARD */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Live Production Line Status Board
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time operational status derived strictly from active downtime, quality hold, and WIP records
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isLinesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-44 w-full" />
              ))}
            </div>
          ) : linePerformance.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No production lines configured.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {linePerformance.map((line) => {
                let badgeVariant: "success" | "danger" | "warning" | "outline" = "outline";
                let badgeColor = "bg-slate-100 text-slate-700 border-slate-300";
                if (line.status === "RUNNING") {
                  badgeVariant = "success";
                  badgeColor = "bg-emerald-500 text-white border-emerald-600";
                } else if (line.status === "STOPPED") {
                  badgeVariant = "danger";
                  badgeColor = "bg-rose-600 text-white border-rose-700";
                } else if (line.status === "QUALITY_HOLD") {
                  badgeVariant = "warning";
                  badgeColor = "bg-amber-500 text-white border-amber-600";
                }

                return (
                  <div
                    key={line.id}
                    className={`rounded-lg border p-4 flex flex-col justify-between transition-all ${
                      line.status === "STOPPED"
                        ? "border-rose-300 bg-rose-50/30"
                        : line.status === "QUALITY_HOLD"
                        ? "border-amber-300 bg-amber-50/30"
                        : line.status === "RUNNING"
                        ? "border-emerald-200 bg-emerald-50/20"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-slate-900">{line.code}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wide border uppercase ${badgeColor}`}
                        >
                          {line.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium mb-3">{line.name}</p>

                      <div className="space-y-1.5 text-xs text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Active Orders:</span>
                          <span className="font-semibold text-slate-800">{line.activeProductionOrders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Shop WIP:</span>
                          <span className="font-semibold text-slate-800">{line.currentWIPQuantity} pcs</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Daily Capacity:</span>
                          <span className="font-mono text-slate-700">{line.capacity} pcs</span>
                        </div>
                        {line.totalDowntimeMinutes > 0 && (
                          <div className="flex justify-between text-rose-600">
                            <span>Total Downtime:</span>
                            <span className="font-semibold">{line.totalDowntimeMinutes} mins</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{line.factoryUnit?.name || "Main Plant"}</span>
                      {line.activeDowntimeCount > 0 && (
                        <span className="text-rose-600 font-bold flex items-center gap-1">
                          <Flame className="w-3 h-3" /> Active Stoppage
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. PRODUCTION ORDER PROGRESS */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Production Order Progress & Adherence
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Target vs verified completed good output, defect tracking, and overdue status
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isOrdersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : orderProgress.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No production orders found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                    <th className="py-2.5 px-3">Order Number</th>
                    <th className="py-2.5 px-3">Line</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Target</th>
                    <th className="py-2.5 px-3 text-right">Completed</th>
                    <th className="py-2.5 px-3 text-right">Defective</th>
                    <th className="py-2.5 px-3 text-right">Remaining</th>
                    <th className="py-2.5 px-3 text-center w-48">Completion %</th>
                    <th className="py-2.5 px-3">Schedule Adherence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orderProgress.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{order.orderNumber}</td>
                      <td className="py-2.5 px-3 text-slate-600">{order.productionLine?.code || "Unassigned"}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px]">
                          {order.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{order.targetQuantity.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                        {order.completedQuantity.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                        {order.defectiveQuantity.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {order.remainingQuantity.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-2.5 rounded-full transition-all ${
                                order.completionPercentage >= 100
                                  ? "bg-emerald-500"
                                  : order.completionPercentage > 50
                                  ? "bg-blue-500"
                                  : "bg-amber-500"
                              }`}
                              style={{ width: `${order.completionPercentage}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono font-bold text-slate-700 w-10 text-right">
                            {order.completionPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {order.isOverdue ? (
                          <Badge variant="danger" className="text-[10px] whitespace-nowrap">
                            Overdue by {order.daysOverdue}d
                          </Badge>
                        ) : order.status === "COMPLETED" ? (
                          <Badge variant="success" className="text-[10px]">
                            Completed
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-medium">On Schedule</span>
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

      {/* 4. DOWNTIME & QUALITY PARALLEL PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Downtime Analysis */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Downtime Incidents & Loss Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {isDowntimeLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 text-center">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Total Outage Time</span>
                    <span className="text-lg font-black text-slate-900">
                      {downtimeData?.totalDowntimeMinutes || 0} mins
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Active Incidents</span>
                    <span className="text-lg font-black text-rose-600">
                      {downtimeData?.activeIncidentsCount || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Resolved Incidents</span>
                    <span className="text-lg font-black text-emerald-600">
                      {downtimeData?.resolvedIncidentsCount || 0}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Downtime by Reason (Pareto)
                  </h4>
                  {downtimeData?.byReason?.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">Zero downtime incidents recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {downtimeData?.byReason?.map((r) => {
                        const total = downtimeData.totalDowntimeMinutes || 1;
                        const pct = Math.round((r.minutes / total) * 100);
                        return (
                          <div key={r.reasonCode} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-semibold text-slate-800">{r.reasonCode}</span>
                              <span className="text-slate-500 font-mono">
                                {r.minutes} mins ({r.count}x) — {pct}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="h-1.5 bg-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Quality & Defect Pareto */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              Quality Defect Pareto & Holds
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {isQualityLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-slate-50 text-center">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Total Good Output</span>
                    <span className="text-lg font-black text-emerald-600">
                      {qualityData?.totalGood?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Total Defects</span>
                    <span className="text-lg font-black text-rose-600">
                      {qualityData?.totalDefective?.toLocaleString() || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Active Holds</span>
                    <span className="text-lg font-black text-amber-600">
                      {qualityData?.activeQualityHoldsCount || 0}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Top Defect Codes (Pareto)
                  </h4>
                  {qualityData?.topDefects?.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">Zero defect reports registered.</p>
                  ) : (
                    <div className="space-y-2">
                      {qualityData?.topDefects?.map((d) => (
                        <div key={d.defectCode} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-800">{d.defectCode}</span>
                            <span className="text-slate-500 font-mono">
                              {d.quantity} pcs ({d.percentageOfDefects}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 bg-amber-500 rounded-full"
                              style={{ width: `${d.percentageOfDefects}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 5. WIP BOTTLENECK ANALYSIS */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-blue-600" />
            WIP Flow & Workstation Bottleneck Analysis
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time bundle queues and in-transit piece counts per operation sequence
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          {isWipLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : wipBottlenecks.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">No active WIP residing on the shop-floor.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {wipBottlenecks.map((op) => (
                <div
                  key={op.operationId}
                  className={`p-3.5 rounded-lg border transition-all ${
                    op.quantityWaiting > 100
                      ? "border-amber-400 bg-amber-50/40"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-600">
                      Step #{op.sequence}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{op.orderNumber}</span>
                  </div>

                  <h5 className="font-bold text-xs text-slate-900 mb-2 truncate" title={op.operationName}>
                    {op.operationName}
                  </h5>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bundles Queued:</span>
                      <span className="font-bold text-slate-800">{op.bundleCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Waiting Quantity:</span>
                      <span className="font-black text-amber-700 font-mono">{op.quantityWaiting} pcs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Processed Output:</span>
                      <span className="font-semibold text-emerald-700 font-mono">{op.quantityProcessed} pcs</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
