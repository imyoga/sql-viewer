"use client";

import { useState, useCallback, useRef, useEffect } from "react";

function mapParquetType(physicalType?: string): string {
  switch (physicalType) {
    case "BOOLEAN":
    case "INT32":
    case "INT64":
    case "INT96":
      return "INTEGER";
    case "FLOAT":
    case "DOUBLE":
      return "REAL";
    default:
      return "TEXT";
  }
}

// ─── Shared types (identical surface to use-sqlite.ts) ───────────────────────

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface TableInfo {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
}

export interface QueryResult {
  columns: string[];
  rows: (string | number | null | Uint8Array)[][];
}

// ─── Worker message types ────────────────────────────────────────────────────

interface WorkerOk<T = unknown> {
  id: string;
  ok: true;
  data: T;
}
interface WorkerErr {
  id: string;
  ok: false;
  error: string;
}
type WorkerResult<T = unknown> = WorkerOk<T> | WorkerErr;

// ─── Pending-promise registry ────────────────────────────────────────────────

type Resolver = { resolve: (v: unknown) => void; reject: (e: Error) => void };

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Wrap a Worker so every postMessage returns a typed Promise.
 * Each in-flight message is tracked by a UUID in a Map.
 */
function createWorkerBridge(worker: Worker) {
  const pending = new Map<string, Resolver>();

  worker.onmessage = (evt: MessageEvent<WorkerResult>) => {
    const { id, ok } = evt.data;
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (ok) {
      entry.resolve((evt.data as WorkerOk).data);
    } else {
      entry.reject(new Error((evt.data as WorkerErr).error));
    }
  };

  worker.onerror = (evt) => {
    // Reject all pending on unrecoverable worker error
    const err = new Error(evt.message ?? "Worker error");
    for (const [, entry] of pending) entry.reject(err);
    pending.clear();
  };

  function send<T = unknown>(message: Record<string, unknown>): Promise<T> {
    const id = makeId();
    return new Promise<T>((resolve, reject) => {
      pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      worker.postMessage({ ...message, id });
    });
  }

  function terminate() {
    worker.terminate();
    const err = new Error("Worker terminated");
    for (const [, entry] of pending) entry.reject(err);
    pending.clear();
  }

  return { send, terminate };
}

type WorkerBridge = ReturnType<typeof createWorkerBridge>;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSqliteWorker() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Primary worker — used for all queries after the initial load
  const primaryRef = useRef<WorkerBridge | null>(null);
  // Pool of scan workers (terminated after load)
  const poolRef = useRef<WorkerBridge[]>([]);

  // Spawn or reuse the primary worker
  function getPrimary(): WorkerBridge {
    if (!primaryRef.current) {
      const w = new Worker("/sqlite-worker.js");
      primaryRef.current = createWorkerBridge(w);
    }
    return primaryRef.current;
  }

  // Terminate all workers in the scan pool
  function terminatePool() {
    for (const bridge of poolRef.current) bridge.terminate();
    poolRef.current = [];
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      primaryRef.current?.terminate();
      primaryRef.current = null;
      terminatePool();
    };
  }, []);

  // ── loadFile ──────────────────────────────────────────────────────────────

  const loadFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setTables([]);
    setFileName("");

    // Terminate any leftover scan pool from a previous load
    terminatePool();

    try {
      // ── Parquet path ─────────────────────────────────────────────────────
      if (file.name.toLowerCase().endsWith(".parquet")) {
        const { parquetRead, parquetMetadata } = await import("hyparquet");
        const { compressors } = await import("hyparquet-compressors");
        const buffer = await file.arrayBuffer();

        const metadata = parquetMetadata(buffer);
        // Leaf schema elements have a `type` property; group nodes do not
        const leafFields = metadata.schema.filter((s) => s.type !== undefined);

        const columns: ColumnInfo[] = leafFields.map((s, i) => ({
          cid: i,
          name: s.name,
          type: mapParquetType(s.type as string | undefined),
          notnull: 0,
          dflt_value: null,
          pk: 0,
        }));

        let parsedRows: Record<string, unknown>[] = [];
        await parquetRead({
          file: buffer,
          compressors,
          onComplete: (rows) => {
            parsedRows = rows as Record<string, unknown>[];
          },
        });

        const serializedRows = parsedRows.map((row) =>
          columns.map((col) => {
            const val = row[col.name];
            if (val === null || val === undefined) return null;
            if (val instanceof Date) return val.toISOString();
            if (typeof val === "bigint") return Number(val);
            if (typeof val === "object") return JSON.stringify(val);
            return val as string | number;
          })
        );

        const tableName = file.name.replace(/\.parquet$/i, "");
        const primary = getPrimary();
        await primary.send({
          type: "init_from_data",
          tableName,
          columns: columns.map((c) => ({ name: c.name, type: c.type })),
          rows: serializedRows,
        });

        setTables([{ name: tableName, rowCount: parsedRows.length, columns }]);
        setFileName(file.name);
        return;
      }

      // ── SQLite path ───────────────────────────────────────────────────────
      const buffer = await file.arrayBuffer();

      // ① Init the primary worker — it opens the DB and returns all table names
      const primary = getPrimary();
      const { tableNames } = await primary.send<{ tableNames: string[] }>({
        type: "init",
        buffer,
        // Transfer the buffer to the worker — zero-copy (ArrayBuffer is transferred)
      });

      if (tableNames.length === 0) {
        setFileName(file.name);
        setLoading(false);
        return;
      }

      // ② Determine how many additional scan workers to spawn
      //    We use (hardwareConcurrency - 1) so the main thread core stays free,
      //    capped at 4 workers and at most one per table.
      const coreCount =
        typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 2 : 2;
      const poolSize = Math.min(Math.max(1, coreCount - 1), 4, tableNames.length);

      // Split tables into equal slices — one slice per pool worker
      const slices: string[][] = Array.from({ length: poolSize }, () => []);
      tableNames.forEach((name, i) => slices[i % poolSize].push(name));

      // ③ Spawn pool workers and dispatch parallel table_scan jobs.
      //    Each worker gets its own copy of the ArrayBuffer (structuredClone
      //    implicitly copies when the buffer has already been transferred to
      //    the primary; we re-read from file for a fresh copy).
      const freshBuffer = await file.arrayBuffer();

      const pool: WorkerBridge[] = slices.map(() => {
        const w = new Worker("/sqlite-worker.js");
        return createWorkerBridge(w);
      });
      poolRef.current = pool;

      // Send each slice to its worker — transfer a fresh slice of the buffer
      const scanPromises = pool.map((bridge, i) =>
        bridge.send<TableInfo[]>({
          type: "table_scan",
          tableNames: slices[i],
          buffer: freshBuffer.slice(0), // each worker gets own copy
        })
      );

      // ④ Wait for all scan results in parallel (Promise.all = multi-core)
      const scanResults = await Promise.all(scanPromises);

      // ⑤ Flatten + restore original table order
      const infoMap = new Map<string, TableInfo>();
      for (const batch of scanResults) {
        for (const info of batch) infoMap.set(info.name, info);
      }
      const orderedTables = tableNames
        .map((name) => infoMap.get(name))
        .filter((t): t is TableInfo => t !== undefined);

      // Terminate scan-pool workers — they are no longer needed
      terminatePool();

      setTables(orderedTables);
      setFileName(file.name);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load file"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ── queryTable ────────────────────────────────────────────────────────────

  const queryTable = useCallback(
    async (
      tableName: string,
      page: number = 0,
      pageSize: number = 100,
      search: string = ""
    ): Promise<QueryResult | null> => {
      const primary = primaryRef.current;
      if (!primary) return null;
      try {
        const offset = page * pageSize;
        const tableInfo = tables.find((t) => t.name === tableName);
        let sql = `SELECT * FROM "${tableName}"`;
        if (search.trim() && tableInfo && tableInfo.columns.length > 0) {
          const conditions = tableInfo.columns
            .map(
              (c) =>
                `CAST("${c.name}" AS TEXT) LIKE '%${search.replace(/'/g, "''")}%'`
            )
            .join(" OR ");
          sql += ` WHERE ${conditions}`;
        }
        sql += ` LIMIT ${pageSize} OFFSET ${offset}`;

        const result = await primary.send<QueryResult>({ type: "query", sql });
        return result;
      } catch {
        return null;
      }
    },
    [tables]
  );

  // ── runQuery ──────────────────────────────────────────────────────────────

  const runQuery = useCallback(
    async (sql: string): Promise<QueryResult | { error: string }> => {
      const primary = primaryRef.current;
      if (!primary) return { error: "No database loaded" };
      try {
        const result = await primary.send<QueryResult>({ type: "query", sql });
        return result;
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "Query failed",
        };
      }
    },
    []
  );

  // ── closeDb ───────────────────────────────────────────────────────────────

  const closeDb = useCallback(() => {
    primaryRef.current?.terminate();
    primaryRef.current = null;
    terminatePool();
    setTables([]);
    setFileName("");
    setError(null);
  }, []);

  return {
    tables,
    fileName,
    loading,
    error,
    loadFile,
    queryTable,
    runQuery,
    closeDb,
  };
}
