"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertCircle,
  Hash,
  Type,
  Binary,
  Key,
} from "lucide-react";
import type { TableInfo, QueryResult } from "@/hooks/use-sqlite-worker";
import { cn } from "@/lib/utils";

interface DataGridProps {
  tableName: string;
  tableInfo: TableInfo;
  onQuery: (
    table: string,
    page: number,
    pageSize: number,
    search: string
  ) => Promise<QueryResult | null>;
}

const PAGE_SIZE = 100;

function TypeIcon({ type }: { type: string }) {
  const t = type.toUpperCase();
  if (t.includes("INT") || t.includes("REAL") || t.includes("FLOAT") || t.includes("NUM"))
    return <Hash className="w-3 h-3 text-chart-2" />;
  if (t.includes("BLOB")) return <Binary className="w-3 h-3 text-chart-4" />;
  return <Type className="w-3 h-3 text-muted-foreground" />;
}

function CellValue({ value }: { value: string | number | null | Uint8Array }) {
  if (value === null) {
    return <span className="text-muted-foreground italic text-[11px]">NULL</span>;
  }
  if (value instanceof Uint8Array) {
    return (
      <span className="text-chart-4 font-mono text-[11px]">
        BLOB({value.length}B)
      </span>
    );
  }
  const str = String(value);
  return (
    <span className="truncate max-w-[240px] inline-block align-middle" title={str}>
      {str}
    </span>
  );
}

export function DataGrid({ tableName, tableInfo, onQuery }: DataGridProps) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Reset page when search or table changes
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, tableName]);

  useEffect(() => {
    let cancelled = false;
    setQueryLoading(true);
    onQuery(tableName, page, PAGE_SIZE, debouncedSearch).then((r) => {
      if (!cancelled) {
        setResult(r);
        setQueryLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [tableName, page, PAGE_SIZE, debouncedSearch, onQuery]);

  const columns = result?.columns ?? tableInfo.columns.map((c) => c.name);
  const rows = result?.rows ?? [];
  const hasNext = rows.length === PAGE_SIZE;
  const hasPrev = page > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex-1">
          <h2 className="text-sm font-mono font-semibold text-foreground">{tableName}</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {tableInfo.columns.length} columns · {tableInfo.rowCount.toLocaleString()} rows
          </p>
        </div>

        {/* Search */}
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter rows…"
            className="w-full h-8 pl-8 pr-8 rounded-md bg-secondary border border-border text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto relative">
        {queryLoading && (
          <div className="absolute inset-0 z-20 bg-background/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        )}
        {columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No data found</p>
          </div>
        ) : (
          <table className="w-full text-xs font-mono border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-table-header">
                {/* Row number header */}
                <th className="px-3 py-2.5 text-right text-muted-foreground font-medium border-b border-border w-12 select-none">
                  #
                </th>
                {columns.map((col, i) => {
                  const colInfo = tableInfo.columns.find((c) => c.name === col);
                  return (
                    <th
                      key={col}
                      className="px-3 py-2.5 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5">
                        {colInfo?.pk ? (
                          <Key className="w-3 h-3 text-primary shrink-0" />
                        ) : (
                          <TypeIcon type={colInfo?.type ?? ""} />
                        )}
                        <span className="text-foreground">{col}</span>
                        {colInfo?.type && (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {colInfo.type}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={cn(
                    "group border-b border-border/40 hover:bg-row-highlight transition-colors",
                    ri % 2 === 1 && "bg-table-row-alt"
                  )}
                >
                  {/* Row number */}
                  <td className="px-3 py-2 text-right text-muted-foreground select-none tabular-nums">
                    {page * PAGE_SIZE + ri + 1}
                  </td>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-3 py-2 text-foreground max-w-xs whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      <CellValue value={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-card shrink-0">
        <span className="text-[11px] text-muted-foreground font-mono">
          Rows {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + rows.length}
          {debouncedSearch && " (filtered)"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev}
            className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-muted-foreground px-2 tabular-nums">
            Page {page + 1}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
