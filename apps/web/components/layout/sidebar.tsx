"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils/cn";
import {
  LayoutDashboard,
  Database,
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
  Boxes,
  CalendarRange,
  Scissors,
  Package,
  ScanLine,
  AlertTriangle,
  ClipboardCheck,
  CheckCheck,
  AlertOctagon,
  Activity,
  Clock,
  Calendar,
  Gauge,
  ShieldCheck,
  ShieldAlert,
  ListChecks,
  BookOpen,
  Layers,
  FileText,
  Upload,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

const NAVIGATION_GROUPS: NavGroup[] = [
  {
    groupTitle: "COMMAND CENTER",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: <LayoutDashboard className="w-4 h-4" />,
      },
    ],
  },
  {
    groupTitle: "MASTER DATA",
    items: [
      {
        title: "Overview",
        href: "/master-data",
        icon: <Database className="w-4 h-4" />,
      },
      {
        title: "Factory Units",
        href: "/master-data/factories",
        icon: <Building2 className="w-4 h-4" />,
      },
      {
        title: "Production Lines",
        href: "/master-data/lines",
        icon: <GitBranch className="w-4 h-4" />,
      },
      {
        title: "Machines",
        href: "/master-data/machines",
        icon: <Cpu className="w-4 h-4" />,
      },
      {
        title: "Employees",
        href: "/master-data/employees",
        icon: <Users className="w-4 h-4" />,
      },
      {
        title: "Styles",
        href: "/master-data/styles",
        icon: <Shirt className="w-4 h-4" />,
      },
      {
        title: "Buyers",
        href: "/master-data/buyers",
        icon: <Briefcase className="w-4 h-4" />,
      },
      {
        title: "Suppliers",
        href: "/master-data/suppliers",
        icon: <Truck className="w-4 h-4" />,
      },
    ],
  },
  {
    groupTitle: "COMMERCIAL",
    items: [
      {
        title: "Costing",
        href: "/costing",
        icon: <Calculator className="w-4 h-4" />,
      },
    ],
  },
  {
    groupTitle: "MANUFACTURING (MES)",
    items: [
      {
        title: "Operations Center",
        href: "/production/operations",
        icon: <Activity className="w-4 h-4" />,
      },
      {
        title: "Shift Management",
        href: "/production/shifts",
        icon: <Clock className="w-4 h-4" />,
      },
      {
        title: "Production Scheduling",
        href: "/production/scheduling",
        icon: <Calendar className="w-4 h-4" />,
      },
      {
        title: "Line Capacity",
        href: "/production/capacity",
        icon: <Gauge className="w-4 h-4" />,
      },
      {
        title: "Line Planning",
        href: "/production/planning",
        icon: <CalendarRange className="w-4 h-4" />,
      },
      {
        title: "Cutting Room",
        href: "/production/cutting",
        icon: <Scissors className="w-4 h-4" />,
      },
      {
        title: "Bundle Tracking",
        href: "/production/bundles",
        icon: <Package className="w-4 h-4" />,
      },
      {
        title: "Shop-Floor Scanning",
        href: "/production/scanning",
        icon: <ScanLine className="w-4 h-4" />,
      },
      {
        title: "Downtime Tracking",
        href: "/production/downtime",
        icon: <AlertTriangle className="w-4 h-4" />,
      },
      {
        title: "Production Output",
        href: "/production/output",
        icon: <CheckCheck className="w-4 h-4" />,
      },
      {
        title: "Defect Register",
        href: "/production/defects",
        icon: <AlertOctagon className="w-4 h-4" />,
      },
      {
        title: "Quality Inspection",
        href: "/production/quality",
        icon: <ClipboardCheck className="w-4 h-4" />,
      },
    ],
  },
  {
    groupTitle: "QUALITY CONTROL",
    items: [
      {
        title: "AQL Lot Audits",
        href: "/quality/aql",
        icon: <ShieldCheck className="w-4 h-4" />,
      },
      {
        title: "Non-Conformance (NCR)",
        href: "/quality/ncr",
        icon: <ShieldAlert className="w-4 h-4" />,
      },
      {
        title: "Inspection Plans",
        href: "/quality/plans",
        icon: <ListChecks className="w-4 h-4" />,
      },
      {
        title: "Defect Catalog",
        href: "/quality/catalog",
        icon: <BookOpen className="w-4 h-4" />,
      },
      {
        title: "Inline Terminal",
        href: "/production/quality",
        icon: <ClipboardCheck className="w-4 h-4" />,
      },
    ],
  },
  {
    groupTitle: "MATERIALS & WAREHOUSE",
    items: [
      {
        title: "Procurement",
        href: "/procurement",
        icon: <ShoppingBag className="w-4 h-4" />,
      },
      {
        title: "Stock Ledger",
        href: "/inventory/stock",
        icon: <Warehouse className="w-4 h-4" />,
      },
      {
        title: "Goods Receipt (GRN)",
        href: "/inventory/grn",
        icon: <Truck className="w-4 h-4" />,
      },
      {
        title: "Fabric Rolls & ASTM",
        href: "/inventory/rolls",
        icon: <Layers className="w-4 h-4" />,
      },
      {
        title: "Material Reservations",
        href: "/inventory/reservations",
        icon: <Boxes className="w-4 h-4" />,
      },
      {
        title: "Stores & Requisitions",
        href: "/inventory/issues",
        icon: <Package className="w-4 h-4" />,
      },
    ],
  },
  {
    groupTitle: "PACKAGING & FINISHED GOODS",
    items: [
      {
        title: "Carton Packaging",
        href: "/packing/cartons",
        icon: <Boxes className="w-4 h-4" />,
      },
      {
        title: "Packing Lists",
        href: "/packing/lists",
        icon: <ClipboardCheck className="w-4 h-4" />,
      },
      {
        title: "FG Warehouse & Staging",
        href: "/packing/warehouse",
        icon: <Warehouse className="w-4 h-4" />,
      },
    ],
  },
  {
    groupTitle: "OUTBOUND LOGISTICS",
    items: [
      {
        title: "Shipments",
        href: "/shipping/shipments",
        icon: <Truck className="w-4 h-4" />,
      },
      {
        title: "Commercial Invoices",
        href: "/shipping/invoices",
        icon: <FileText className="w-4 h-4" />,
      },
      {
        title: "Gate Pass Terminal",
        href: "/shipping/gate-pass",
        icon: <ShieldCheck className="w-4 h-4" />,
      },
    ],
  },
  {
    groupTitle: "ENTERPRISE DATA",
    items: [
      {
        title: "Bulk Import / Export",
        href: "/data-import",
        icon: <Upload className="w-4 h-4" />,
      },
    ],
  },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full shrink-0 select-none border-r border-slate-800">
      {/* Brand Header */}
      <div className="px-6 py-5 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-600 text-white font-bold shadow-md shadow-blue-900/30">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wider uppercase">
              Textile ERP
            </h1>
            <span className="text-[10px] font-semibold text-blue-400 tracking-widest uppercase block">
              MES / Operations
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAVIGATION_GROUPS.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              {group.groupTitle}
            </div>
            {group.items.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard" || pathname === "/"
                  : item.href === "/master-data"
                  ? pathname === "/master-data"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all group",
                    isActive
                      ? "bg-blue-600 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "transition-colors",
                        isActive
                          ? "text-white"
                          : "text-slate-400 group-hover:text-slate-200"
                      )}
                    >
                      {item.icon}
                    </span>
                    <span>{item.title}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase",
                        isActive
                          ? "bg-blue-700 text-white"
                          : "bg-slate-800 text-slate-300"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / System Status */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/20 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          MES Online
        </span>
        <span className="font-mono text-[10px] text-slate-400">v5.1-F2</span>
      </div>
    </aside>
  );
}
