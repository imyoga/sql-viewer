"use client";

import { useState, useRef } from "react";
import { Play, AlertCircle, ChevronDown } from "lucide-react";
import type { QueryResult } from "@/hooks/use-sqlite-worker";
import { cn } from "@/lib/utils";

interface QueryEditorProps {
  onRun: (sql: string) => Promise<QueryResult | { error: string }>;
  tables: string[];
}

function CellValue({ value }: { value: string | number | null | Uint8Array }) {
  if (value === null) return <span className="text-muted-foreground/50 italic text-[11px]">NULL</span>;
  if (value instanceof Uint8Array)
    return <span className="text-chart-4 font-mono text-[11px]">BLOB({value.length}B)</span>;
  return <span>{String(value)}</span>;
}

export function QueryEditor({ onRun, tables }: QueryEditorProps) {
  const [sql, setSql] = useState(`SELECT * FROM "${tables[0] ?? "your_table"}" LIMIT 50;`);
  const [result, setResult] = useState<QueryResult | { error: string } | null>(null);
  const [running, setRunning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const run = async () => {
    if (!sql.trim()) return;
    setRunning(true);
    try {
      const r = await onRun(sql);
      setResult(r);
    } finally {
      setRunning(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  };

  const isError = result && "error" in result;
  const isSuccess = result && "columns" in result;

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div>
          <h2 className="text-sm font-mono font-semibold text-foreground">Query Editor</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Press{" "}
            <kbd className="px-1 py-0.5 rounded text-[10px] bg-secondary border border-border font-mono">
              ⌘ Enter
            </kbd>{" "}
            to run
          </p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Play className="w-3 h-3" />
          {running ? "Running…" : "Run Query"}
        </button>
      </div>

      {/* Textarea */}
      <div className="relative border-b border-border bg-secondary/50 shrink-0">
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={onKeyDown}
          rows={6}
          spellCheck={false}
          className="w-full p-4 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none resize-none leading-relaxed"
          placeholder="SELECT * FROM table_name LIMIT 100;"
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {!result && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-xs text-muted-foreground font-mono">Run a query to see results</p>
          </div>
        )}

        {isError && (
          <div className="m-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive-foreground shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-destructive-foreground leading-relaxed">
              {(result as { error: string }).error}
            </p>
          </div>
        )}

        {isSuccess && (result as QueryResult).columns.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-xs text-muted-foreground font-mono">Query executed. No rows returned.</p>
          </div>
        )}

        {isSuccess && (result as QueryResult).columns.length > 0 && (
          <div className="overflow-auto">
            <div className="px-4 py-2 border-b border-border bg-card/50 flex items-center gap-2 sticky top-0">
              <span className="text-[11px] text-muted-foreground font-mono">
                {(result as QueryResult).rows.length} row{(result as QueryResult).rows.length !== 1 ? "s" : ""} returned
              </span>
            </div>
            <table className="w-full text-xs font-mono border-collapse">
              <thead className="sticky top-[33px] z-10 bg-table-header">
                <tr>
                  <th className="px-3 py-2.5 text-right text-muted-foreground/50 font-medium border-b border-border w-10">#</th>
                  {(result as QueryResult).columns.map((col) => (
                    <th key={col} className="px-3 py-2.5 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(result as QueryResult).rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={cn(
                      "border-b border-border/40 hover:bg-row-highlight transition-colors",
                      ri % 2 === 1 && "bg-table-row-alt"
                    )}
                  >
                    <td className="px-3 py-2 text-right text-muted-foreground/40 select-none tabular-nums">{ri + 1}</td>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-foreground/85 max-w-xs whitespace-nowrap overflow-hidden text-ellipsis">
                        <CellValue value={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
