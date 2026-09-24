'use client';

import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { dataManagementClient } from '@/lib/api/client';

export interface ExportButtonProps {
  entity: string;
  filters?: Record<string, any>;
  label?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  entity,
  filters,
  label = 'Export CSV',
  className = '',
  variant = 'outline',
  size = 'sm',
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExporting(true);
    setError(null);

    try {
      await dataManagementClient.downloadExport(entity, filters);
    } catch (err: any) {
      console.error('Export failed:', err);
      setError(err?.message || 'Export failed');
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3.5 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  }[size];

  const variantClasses = {
    primary:
      'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-sm border border-transparent',
    secondary:
      'bg-slate-700 text-slate-100 hover:bg-slate-650 active:bg-slate-800 border border-slate-600',
    outline:
      'bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 hover:text-white border border-slate-700/80 shadow-sm',
  }[variant];

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        title={`Export ${entity} to CSV`}
        className={`inline-flex items-center gap-1.5 font-medium rounded-md transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
      >
        {isExporting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
        ) : (
          <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" />
        )}
        <span>{isExporting ? 'Exporting...' : label}</span>
      </button>
      {error && (
        <div className="absolute top-full mt-1 left-0 z-50 px-2 py-1 bg-rose-950 border border-rose-800 text-rose-300 text-xs rounded shadow-lg whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
};

export default ExportButton;
