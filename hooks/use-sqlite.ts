"use client";

import { useState, useCallback } from "react";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

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

let sqlJsInstance: SqlJsStatic | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsInstance) return sqlJsInstance;
  sqlJsInstance = await initSqlJs({
    locateFile: () => "/sql-wasm.wasm",
  });
  return sqlJsInstance;
}

export function useSqlite() {
  const [db, setDb] = useState<Database | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const SQL = await getSqlJs();
      const buffer = await file.arrayBuffer();
      const database = new SQL.Database(new Uint8Array(buffer));

      // Get all user tables
      const tablesResult = database.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );

      const tableNames: string[] =
        tablesResult.length > 0
          ? (tablesResult[0].values.map((r) => r[0]) as string[])
          : [];

      const tableInfos: TableInfo[] = tableNames.map((name) => {
        const colResult = database.exec(`PRAGMA table_info("${name}")`);
        const columns: ColumnInfo[] =
          colResult.length > 0
            ? colResult[0].values.map((row) => ({
                cid: row[0] as number,
                name: row[1] as string,
                type: row[2] as string,
                notnull: row[3] as number,
                dflt_value: row[4] as string | null,
                pk: row[5] as number,
              }))
            : [];

        const countResult = database.exec(`SELECT COUNT(*) FROM "${name}"`);
        const rowCount =
          countResult.length > 0
            ? (countResult[0].values[0][0] as number)
            : 0;

        return { name, rowCount, columns };
      });

      setDb(database);
      setTables(tableInfos);
      setFileName(file.name);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load SQLite file"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const queryTable = useCallback(
    (
      tableName: string,
      page: number = 0,
      pageSize: number = 100,
      search: string = ""
    ): QueryResult | null => {
      if (!db) return null;
      try {
        const offset = page * pageSize;
        let sql = `SELECT * FROM "${tableName}"`;
        if (search.trim()) {
          const tableInfo = tables.find((t) => t.name === tableName);
          if (tableInfo && tableInfo.columns.length > 0) {
            const conditions = tableInfo.columns
              .map((c) => `CAST("${c.name}" AS TEXT) LIKE '%${search.replace(/'/g, "''")}%'`)
              .join(" OR ");
            sql += ` WHERE ${conditions}`;
          }
        }
        sql += ` LIMIT ${pageSize} OFFSET ${offset}`;
        const result = db.exec(sql);
        if (result.length === 0) return { columns: [], rows: [] };
        return {
          columns: result[0].columns,
          rows: result[0].values as QueryResult["rows"],
        };
      } catch (err) {
        return null;
      }
    },
    [db, tables]
  );

  const runQuery = useCallback(
    (sql: string): QueryResult | { error: string } => {
      if (!db) return { error: "No database loaded" };
      try {
        const result = db.exec(sql);
        if (result.length === 0) return { columns: [], rows: [] };
        return {
          columns: result[0].columns,
          rows: result[0].values as QueryResult["rows"],
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "Query failed",
        };
      }
    },
    [db]
  );

  const closeDb = useCallback(() => {
    if (db) db.close();
    setDb(null);
    setTables([]);
    setFileName("");
    setError(null);
  }, [db]);

  return { db, tables, fileName, loading, error, loadFile, queryTable, runQuery, closeDb };
}
