"use client";

import { useRef, useState, useCallback } from "react";
import { Database, FileArchive } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";

interface DropZoneProps {
  onFile: (file: File) => void;
  loading: boolean;
}

export function DropZone({ onFile, loading }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const name = file.name.toLowerCase();
      if (
        name.endsWith(".sqlite") ||
        name.endsWith(".db") ||
        name.endsWith(".sqlite3") ||
        name.endsWith(".parquet")
      ) {
        onFile(file);
      }
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8 relative">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-12">
        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground font-mono tracking-tight">SQLite Viewer</h1>
          <p className="text-xs text-muted-foreground">Explore your database files</p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
        className={`
          relative w-full max-w-lg h-64 rounded-xl border-2 border-dashed cursor-pointer
          flex flex-col items-center justify-center gap-4 transition-all duration-200
          ${dragging
            ? "border-primary bg-primary/10 scale-[1.02]"
            : "border-border bg-card hover:border-primary/50 hover:bg-card/80"
          }
          ${loading ? "opacity-60 cursor-not-allowed" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".sqlite,.db,.sqlite3,.parquet"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-mono">Parsing on worker threads…</p>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center">
              <FileArchive className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {dragging ? "Drop it here" : "Drop your database file"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or <span className="text-primary">click to browse</span>
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {[".sqlite", ".db", ".sqlite3", ".parquet"].map((ext) => (
                <span
                  key={ext}
                  className="px-2 py-0.5 rounded-md bg-secondary border border-border text-xs font-mono text-muted-foreground"
                >
                  {ext}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-muted-foreground text-center max-w-sm leading-relaxed">
        Files are processed entirely in your browser using{" "}
        <span className="text-primary font-mono">sql.js</span> and{" "}
        <span className="text-primary font-mono">hyparquet</span> running inside{" "}
        <span className="text-primary font-mono">Web Workers</span>. Nothing is uploaded to any server.
      </p>
    </div>
  );
}
