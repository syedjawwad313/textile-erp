"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 mb-6 border-b border-slate-200">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                {b.href ? (
                  <Link
                    href={b.href}
                    className="hover:text-slate-800 transition-colors"
                  >
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-slate-800 font-medium">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {description && (
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">{description}</p>
        )}
      </div>

      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
