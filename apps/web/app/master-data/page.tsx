"use client";

import React from "react";
import Link from "next/link";
import { PageHeader } from "../../components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import {
  Building2,
  GitBranch,
  Cpu,
  Users,
  Shirt,
  Briefcase,
  Truck,
  ArrowRight,
  Database,
} from "lucide-react";
import { useDashboardSummary } from "../../hooks/use-master-data";

export default function MasterDataLandingPage() {
  const { data: summary } = useDashboardSummary();

  const mesModules = [
    {
      title: "Factory Units",
      description: "Physical manufacturing plants, production complexes, and branch facilities.",
      href: "/master-data/factories",
      icon: <Building2 className="w-6 h-6 text-blue-600" />,
      count: summary?.factoriesCount,
      code: "FAC",
    },
    {
      title: "Production Lines",
      description: "Sewing, cutting, and assembly lines with daily piece capacity configurations.",
      href: "/master-data/lines",
      icon: <GitBranch className="w-6 h-6 text-indigo-600" />,
      count: summary?.linesCount,
      code: "LINE",
    },
    {
      title: "Machines & Assets",
      description: "Industrial equipment register (lockstitch, overlock, spreaders, fusing).",
      href: "/master-data/machines",
      icon: <Cpu className="w-6 h-6 text-amber-600" />,
      count: summary?.machinesCount,
      code: "MCH",
    },
    {
      title: "Personnel & Employees",
      description: "Shop-floor operators, line supervisors, and quality control (QC) inspectors.",
      href: "/master-data/employees",
      icon: <Users className="w-6 h-6 text-emerald-600" />,
      count: summary?.employeesCount,
      code: "EMP",
    },
  ];

  const commercialModules = [
    {
      title: "Garment Styles",
      description: "Apparel styles, SKUs, silhouettes, and style master records for BOM costing.",
      href: "/master-data/styles",
      icon: <Shirt className="w-6 h-6 text-cyan-600" />,
      count: summary?.stylesCount,
      code: "STY",
    },
    {
      title: "Buyers & Brands",
      description: "Commercial clients, retail brands, and global customer master directory.",
      href: "/master-data/buyers",
      icon: <Briefcase className="w-6 h-6 text-purple-600" />,
      count: summary?.buyersCount,
      code: "BYR",
    },
    {
      title: "Suppliers & Vendors",
      description: "Yarn, fabric, trim, and packaging raw material suppliers.",
      href: "/master-data/suppliers",
      icon: <Truck className="w-6 h-6 text-rose-600" />,
      count: summary?.suppliersCount,
      code: "SUP",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Master Data Management (MDM)"
        description="Centralized master directory for MES operational resources and commercial entities."
        breadcrumbs={[{ label: "ERP", href: "/dashboard" }, { label: "Master Data" }]}
      />

      {/* MES Master Data Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Database className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            MES / Shop-Floor Master Data
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mesModules.map((m) => (
            <Link key={m.href} href={m.href} className="group block">
              <Card className="h-full border-slate-200 group-hover:border-blue-500 group-hover:shadow-md transition-all">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-lg bg-slate-100 group-hover:bg-blue-50 transition-colors">
                      {m.icon}
                    </div>
                    <Badge variant="neutral" size="sm" className="font-mono">
                      {m.count !== undefined ? `${m.count} records` : m.code}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-3 group-hover:text-blue-600 transition-colors">
                    {m.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <CardDescription className="text-xs leading-relaxed text-slate-500">
                    {m.description}
                  </CardDescription>
                  <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 mt-4 group-hover:translate-x-1 transition-transform">
                    <span>Manage records</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Commercial Master Data Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <Database className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Commercial Master Data
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {commercialModules.map((m) => (
            <Link key={m.href} href={m.href} className="group block">
              <Card className="h-full border-slate-200 group-hover:border-purple-500 group-hover:shadow-md transition-all">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 rounded-lg bg-slate-100 group-hover:bg-purple-50 transition-colors">
                      {m.icon}
                    </div>
                    <Badge variant="neutral" size="sm" className="font-mono">
                      {m.count !== undefined ? `${m.count} records` : m.code}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-3 group-hover:text-purple-600 transition-colors">
                    {m.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <CardDescription className="text-xs leading-relaxed text-slate-500">
                    {m.description}
                  </CardDescription>
                  <div className="flex items-center gap-1 text-xs font-semibold text-purple-600 mt-4 group-hover:translate-x-1 transition-transform">
                    <span>Manage records</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
