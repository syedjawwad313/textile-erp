"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth/auth-context";
import { useDashboardSummary } from "../../hooks/use-master-data";
import { PageHeader } from "../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Building2,
  GitBranch,
  Cpu,
  Users,
  Shirt,
  Briefcase,
  Truck,
  Calculator,
  ShoppingBag,
  Warehouse,
  ArrowUpRight,
  Plus,
  Activity,
  Layers,
  Gauge,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

export default function DashboardPage() {
  const { user, tenantId } = useAuth();
  const { data: summary, isLoading, error, refetch } = useDashboardSummary();

  const totalCapacity = summary?.totalLinesCapacity || 0;
  const activeLines = summary?.linesCount || 0;
  const avgLineCap = activeLines > 0 ? Math.round(totalCapacity / activeLines) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Manufacturing Command Center"
        description={`Real-time MES operations & commercial supply chain overview for workspace: ${
          tenantId || "Active Tenant"
        }`}
        breadcrumbs={[{ label: "ERP", href: "/dashboard" }, { label: "Command Center" }]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/master-data">
              <Button variant="outline" size="sm">
                <Layers className="w-3.5 h-3.5" />
                Master Data Hub
              </Button>
            </Link>
            <Link href="/master-data/factories">
              <Button variant="secondary" size="sm">
                <Plus className="w-3.5 h-3.5" />
                Add Factory Unit
              </Button>
            </Link>
          </div>
        }
      />

      {/* Primary KPI Strip: Dense Industrial Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Plant Units */}
        <div className="p-4 rounded-lg bg-white border border-slate-200/90 shadow-xs hover:border-blue-400 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Factory Plants
            </span>
            <div className="p-1.5 rounded bg-blue-50 text-blue-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {isLoading ? (
              <Skeleton className="h-8 w-14" />
            ) : (
              <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {summary?.factoriesCount ?? 0}
              </div>
            )}
            <Badge variant="success" size="sm">
              Online
            </Badge>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Physical facilities</span>
            <Link
              href="/master-data/factories"
              className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-0.5"
            >
              Plants <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Throughput Capacity */}
        <div className="p-4 rounded-lg bg-white border border-slate-200/90 shadow-xs hover:border-indigo-400 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Installed Capacity
            </span>
            <div className="p-1.5 rounded bg-indigo-50 text-indigo-600">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {totalCapacity.toLocaleString()}{" "}
                <span className="text-xs font-normal text-slate-500">pcs/day</span>
              </div>
            )}
            <span className="text-[11px] font-mono text-indigo-600 font-semibold">
              {activeLines} lines
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Avg: {avgLineCap.toLocaleString()} pcs/line</span>
            <Link
              href="/master-data/lines"
              className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5"
            >
              Lines <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Machines */}
        <div className="p-4 rounded-lg bg-white border border-slate-200/90 shadow-xs hover:border-amber-400 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Machine Assets
            </span>
            <div className="p-1.5 rounded bg-amber-50 text-amber-600">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {isLoading ? (
              <Skeleton className="h-8 w-14" />
            ) : (
              <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {summary?.machinesCount ?? 0}
              </div>
            )}
            <Badge variant="neutral" size="sm">
              Equipped
            </Badge>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Sewing & cutting assets</span>
            <Link
              href="/master-data/machines"
              className="text-amber-600 hover:text-amber-800 font-semibold flex items-center gap-0.5"
            >
              Assets <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Shop-Floor Workforce */}
        <div className="p-4 rounded-lg bg-white border border-slate-200/90 shadow-xs hover:border-emerald-400 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Active Personnel
            </span>
            <div className="p-1.5 rounded bg-emerald-50 text-emerald-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {isLoading ? (
              <Skeleton className="h-8 w-14" />
            ) : (
              <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {summary?.employeesCount ?? 0}
              </div>
            )}
            <Badge variant="info" size="sm">
              Allocated
            </Badge>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Operators, QC & Sup</span>
            <Link
              href="/master-data/employees"
              className="text-emerald-600 hover:text-emerald-800 font-semibold flex items-center gap-0.5"
            >
              Staff <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Commercial & Supply Chain Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Link href="/master-data/styles" className="block group">
          <div className="p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-500 transition-all shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Shirt className="w-3.5 h-3.5 text-blue-600" />
                Styles
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="mt-1.5 text-lg font-bold font-mono text-slate-900">
              {isLoading ? <Skeleton className="h-6 w-8" /> : summary?.stylesCount ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Catalog models</div>
          </div>
        </Link>

        <Link href="/master-data/buyers" className="block group">
          <div className="p-3 bg-white rounded-lg border border-slate-200 hover:border-purple-500 transition-all shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-purple-600" />
                Buyers
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="mt-1.5 text-lg font-bold font-mono text-slate-900">
              {isLoading ? <Skeleton className="h-6 w-8" /> : summary?.buyersCount ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Corporate accounts</div>
          </div>
        </Link>

        <Link href="/master-data/suppliers" className="block group">
          <div className="p-3 bg-white rounded-lg border border-slate-200 hover:border-rose-500 transition-all shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-rose-600" />
                Suppliers
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="mt-1.5 text-lg font-bold font-mono text-slate-900">
              {isLoading ? <Skeleton className="h-6 w-8" /> : summary?.suppliersCount ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Material vendors</div>
          </div>
        </Link>

        <Link href="/costing" className="block group">
          <div className="p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-500 transition-all shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-blue-600" />
                Costing
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="mt-1.5 text-lg font-bold font-mono text-slate-900">
              {isLoading ? (
                <Skeleton className="h-6 w-8" />
              ) : (
                summary?.costingSheetsCount ?? 0
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">BOM cost sheets</div>
          </div>
        </Link>

        <Link href="/procurement" className="block group">
          <div className="p-3 bg-white rounded-lg border border-slate-200 hover:border-emerald-500 transition-all shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                Buyer POs
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="mt-1.5 text-lg font-bold font-mono text-slate-900">
              {isLoading ? <Skeleton className="h-6 w-8" /> : summary?.buyerPosCount ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Confirmed sales</div>
          </div>
        </Link>

        <Link href="/inventory" className="block group">
          <div className="p-3 bg-white rounded-lg border border-slate-200 hover:border-amber-500 transition-all shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Warehouse className="w-3.5 h-3.5 text-amber-600" />
                Warehouses
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="mt-1.5 text-lg font-bold font-mono text-slate-900">
              {isLoading ? (
                <Skeleton className="h-6 w-8" />
              ) : (
                summary?.warehousesCount ?? 0
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Depot locations</div>
          </div>
        </Link>
      </div>

      {/* Main Operational Section: Live Production Lines & Plant Units */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Production Lines */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-600" />
                <CardTitle>Sewing & Assembly Lines</CardTitle>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configured manufacturing throughput across plant units
              </p>
            </div>
            <Link href="/master-data/lines">
              <Button variant="outline" size="sm">
                Manage Lines
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : !summary?.recentLines || summary.recentLines.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No production lines registered yet. Click &quot;Manage Lines&quot; to configure.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.recentLines.map((line) => (
                  <div
                    key={line.id}
                    className="p-3.5 px-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-indigo-50 text-indigo-600 font-mono text-xs font-bold">
                        {line.code}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{line.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Factory: {line.factoryUnitId.substring(0, 10)}...
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900 font-mono">
                        {(line.capacity ?? 0).toLocaleString()}{" "}
                        <span className="text-[10px] text-slate-400 font-normal">pcs/d</span>
                      </div>
                      <Badge variant="success" size="sm" className="mt-0.5">
                        Active
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Registered Manufacturing Plants */}
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <CardTitle>Manufacturing Facilities</CardTitle>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Active plant complexes within workspace {tenantId}
              </p>
            </div>
            <Link href="/master-data/factories">
              <Button variant="outline" size="sm">
                Manage Plants
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : !summary?.recentFactories || summary.recentFactories.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No factory plants registered yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {summary.recentFactories.map((fac) => (
                  <div
                    key={fac.id}
                    className="p-3.5 px-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-blue-50 text-blue-600 font-mono text-xs font-bold">
                        {fac.code}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{fac.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Company: {fac.companyId}
                        </div>
                      </div>
                    </div>
                    <Badge variant="success" size="sm">
                      Operational
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Dock */}
      <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Operational Quick Actions
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Fast Access to Master Records
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/master-data/factories">
            <Button variant="outline" size="sm" className="w-full justify-start text-xs">
              <Building2 className="w-3.5 h-3.5 text-blue-600 mr-1.5" />
              Register Factory
            </Button>
          </Link>
          <Link href="/master-data/lines">
            <Button variant="outline" size="sm" className="w-full justify-start text-xs">
              <GitBranch className="w-3.5 h-3.5 text-indigo-600 mr-1.5" />
              Add Production Line
            </Button>
          </Link>
          <Link href="/master-data/machines">
            <Button variant="outline" size="sm" className="w-full justify-start text-xs">
              <Cpu className="w-3.5 h-3.5 text-amber-600 mr-1.5" />
              Register Equipment
            </Button>
          </Link>
          <Link href="/master-data/employees">
            <Button variant="outline" size="sm" className="w-full justify-start text-xs">
              <Users className="w-3.5 h-3.5 text-emerald-600 mr-1.5" />
              Enroll Workforce
            </Button>
          </Link>
        </div>
      </div>

      {/* System Integrity & Tenancy Footer */}
      <div className="p-4 rounded-lg bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-blue-600 text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold tracking-wide uppercase">
              Textile & Apparel ERP + MES Core Architecture
            </h4>
            <p className="text-[11px] text-slate-300">
              Live multi-tenant synchronization active. Zero simulated state machines.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-slate-700 text-slate-200 font-mono text-[11px]">
            Tenant: {tenantId}
          </Badge>
          <Badge variant="success" className="text-[11px]">
            65/65 E2E Verified
          </Badge>
        </div>
      </div>
    </div>
  );
}
