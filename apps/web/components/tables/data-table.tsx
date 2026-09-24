"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/table";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { EmptyState } from "../feedback/empty-state";
import { ErrorState } from "../feedback/error-state";
import { TableSkeleton } from "../ui/skeleton";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  searchKey?: keyof T;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  toolbarActions?: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data = [],
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  searchKey,
  searchPlaceholder = "Search records...",
  pageSize = 10,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  toolbarActions,
  title,
  subtitle,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Filtered data
  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase();
    return data.filter((item) => {
      if (searchKey && item[searchKey] !== undefined) {
        return String(item[searchKey]).toLowerCase().includes(query);
      }
      // Fallback: search across all string/number fields
      return Object.values(item).some((val) =>
        String(val).toLowerCase().includes(query)
      );
    });
  }, [data, searchQuery, searchKey]);

  // Paginated data
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header & Toolbar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
        <div>
          {title && (
            <h3 className="text-base font-semibold text-slate-900 leading-tight">
              {title}
            </h3>
          )}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            />
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              title="Refresh data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          )}
          {toolbarActions}
        </div>
      </div>

      {/* Main Content State Matrix */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={columns.length} />
      ) : isError ? (
        <div className="p-6">
          <ErrorState
            title="Failed to load records"
            message={errorMessage}
            onRetry={onRetry}
          />
        </div>
      ) : filteredData.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title={searchQuery ? "No matching records found" : emptyTitle}
            description={
              searchQuery
                ? `No results matched "${searchQuery}". Try modifying your filter.`
                : emptyDescription
            }
            actionLabel={searchQuery ? undefined : emptyActionLabel}
            onAction={searchQuery ? undefined : onEmptyAction}
          />
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col, idx) => (
                  <TableHead key={idx} className={col.className}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row, rowIndex) => (
                <TableRow key={row.id || rowIndex}>
                  {columns.map((col, colIndex) => (
                    <TableCell key={colIndex} className={col.className}>
                      {col.cell
                        ? col.cell(row)
                        : col.accessorKey
                        ? String(row[col.accessorKey] ?? "-")
                        : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {filteredData.length > pageSize && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40 text-xs text-slate-600">
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, filteredData.length)} of{" "}
                {filteredData.length} records
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>
                <span className="px-2 font-medium">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
