"use client";

import { useState } from "react";
import { TableSidebar } from "./table-sidebar";
import { DataGrid } from "./data-grid";
import { SchemaView } from "./schema-view";
import { QueryEditor } from "./query-editor";
import { useSqliteWorker } from "@/hooks/use-sqlite-worker";
import { DropZone } from "./drop-zone";
import { Table2, AlignLeft, Code2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "data" | "schema" | "query";

export function SqliteViewer() {
  const { tables, fileName, loading, error, loadFile, queryTable, runQuery, closeDb } = useSqliteWorker();
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("data");

  const isLoaded = tables.length > 0 || (fileName && !loading);

  // Auto-select first table
  const handleTableSelect = (name: string) => {
    setActiveTable(name);
    if (viewMode === "query") setViewMode("data");
  };

  const selectedTableInfo = tables.find((t) => t.name === activeTable);

  if (!isLoaded && !error) {
    return <DropZone onFile={loadFile} loading={loading} />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <TableSidebar
        tables={tables}
        activeTable={activeTable}
        onSelectTable={handleTableSelect}
        fileName={fileName}
        onClose={() => {
          closeDb();
          setActiveTable(null);
          setViewMode("data");
        }}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Tab Bar */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-border bg-card shrink-0">
          {(["data", "schema", "query"] as ViewMode[]).map((mode) => {
            const icons = {
              data: Table2,
              schema: AlignLeft,
              query: Code2,
            };
            const labels = {
              data: "Data",
              schema: "Schema",
              query: "SQL Editor",
            };
            const Icon = icons[mode];
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                disabled={mode !== "query" && !activeTable}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md border border-transparent transition-colors -mb-px",
                  viewMode === mode
                    ? "bg-background border-border border-b-background text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {labels[mode]}
              </button>
            );
          })}

          {activeTable && (
            <span className="ml-2 text-[11px] font-mono text-muted-foreground">
              → <span className="text-foreground/70">{activeTable}</span>
            </span>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive-foreground shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-destructive-foreground">{error}</p>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {viewMode === "query" ? (
            <QueryEditor
              onRun={runQuery}
              tables={tables.map((t) => t.name)}
            />
          ) : !activeTable ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Table2 className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Select a table from the sidebar</p>
            </div>
          ) : viewMode === "data" && selectedTableInfo ? (
            <DataGrid
              tableName={activeTable}
              tableInfo={selectedTableInfo}
              onQuery={queryTable}
            />
          ) : viewMode === "schema" && selectedTableInfo ? (
            <SchemaView tableInfo={selectedTableInfo} />
          ) : null}
        </div>
      </main>
    </div>
  );
}
