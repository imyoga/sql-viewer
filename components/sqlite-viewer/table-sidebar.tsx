"use client";

import { Database, Table2, X, ChevronRight } from "lucide-react";
import type { TableInfo } from "@/hooks/use-sqlite-worker";
import { cn } from "@/lib/utils";

interface TableSidebarProps {
  tables: TableInfo[];
  activeTable: string | null;
  onSelectTable: (name: string) => void;
  fileName: string;
  onClose: () => void;
}

export function TableSidebar({
  tables,
  activeTable,
  onSelectTable,
  fileName,
  onClose,
}: TableSidebarProps) {
  return (
    <aside className="w-64 shrink-0 flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* File Header */}
      <div className="px-4 py-3 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-mono font-medium text-sidebar-foreground truncate" title={fileName}>
            {fileName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors shrink-0"
          aria-label="Close database"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tables Label */}
      <div className="px-4 pt-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Tables ({tables.length})
        </span>
      </div>

      {/* Table List */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {tables.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No tables found</p>
        ) : (
          <ul className="space-y-0.5">
            {tables.map((table) => (
              <li key={table.name}>
                <button
                  onClick={() => onSelectTable(table.name)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors group",
                    activeTable === table.name
                      ? "bg-primary/15 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Table2
                    className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      activeTable === table.name ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                    )}
                  />
                  <span className="text-xs font-mono font-medium truncate flex-1">{table.name}</span>
                  <span
                    className={cn(
                      "text-[10px] font-mono shrink-0 tabular-nums",
                      activeTable === table.name ? "text-primary/70" : "text-muted-foreground"
                    )}
                  >
                    {table.rowCount.toLocaleString()}
                  </span>
                  {activeTable === table.name && (
                    <ChevronRight className="w-3 h-3 text-primary shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-[10px] text-muted-foreground font-mono">
          {tables.reduce((a, t) => a + t.rowCount, 0).toLocaleString()} total rows
        </p>
      </div>
    </aside>
  );
}
