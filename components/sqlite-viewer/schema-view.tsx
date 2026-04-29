"use client";

import { Key, Hash, Type, Binary, AlertCircle, CheckCircle2 } from "lucide-react";
import type { TableInfo } from "@/hooks/use-sqlite-worker";
import { cn } from "@/lib/utils";

interface SchemaViewProps {
  tableInfo: TableInfo;
}

function TypeBadge({ type }: { type: string }) {
  const t = type.toUpperCase();
  let color = "text-muted-foreground bg-secondary border-border";
  if (t.includes("INT") || t.includes("REAL") || t.includes("FLOAT") || t.includes("NUM")) {
    color = "text-chart-2 bg-chart-2/10 border-chart-2/20";
  } else if (t.includes("TEXT") || t.includes("CHAR") || t.includes("CLOB")) {
    color = "text-foreground/70 bg-secondary border-border";
  } else if (t.includes("BLOB")) {
    color = "text-chart-4 bg-chart-4/10 border-chart-4/20";
  }
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono border", color)}>
      {type || "NONE"}
    </span>
  );
}

export function SchemaView({ tableInfo }: SchemaViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card shrink-0">
        <h2 className="text-sm font-mono font-semibold text-foreground">{tableInfo.name}</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Schema · {tableInfo.columns.length} columns
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-xs font-mono border-collapse">
          <thead>
            <tr className="bg-table-header">
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground border border-border">Column</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground border border-border">Type</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground border border-border">PK</th>
              <th className="px-3 py-2.5 text-center font-medium text-muted-foreground border border-border">Not Null</th>
              <th className="px-3 py-2.5 text-left font-medium text-muted-foreground border border-border">Default</th>
            </tr>
          </thead>
          <tbody>
            {tableInfo.columns.map((col) => (
              <tr key={col.cid} className="border-b border-border/40 hover:bg-row-highlight transition-colors">
                <td className="px-3 py-2.5 border border-border/30">
                  <div className="flex items-center gap-2">
                    {col.pk ? (
                      <Key className="w-3.5 h-3.5 text-primary shrink-0" />
                    ) : col.type.toUpperCase().includes("INT") ? (
                      <Hash className="w-3.5 h-3.5 text-chart-2 shrink-0" />
                    ) : col.type.toUpperCase().includes("BLOB") ? (
                      <Binary className="w-3.5 h-3.5 text-chart-4 shrink-0" />
                    ) : (
                      <Type className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className={cn("font-medium", col.pk && "text-primary")}>
                      {col.name}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 border border-border/30">
                  <TypeBadge type={col.type} />
                </td>
                <td className="px-3 py-2.5 text-center border border-border/30">
                  {col.pk ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary inline" />
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center border border-border/30">
                  {col.notnull ? (
                    <AlertCircle className="w-3.5 h-3.5 text-chart-5 inline" />
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 border border-border/30">
                  {col.dflt_value !== null ? (
                    <span className="text-chart-3">{col.dflt_value}</span>
                  ) : (
                    <span className="text-muted-foreground/30">NULL</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
