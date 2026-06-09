/**
 * sqlite-worker.js
 *
 * A self-contained Web Worker that runs sql.js (SQLite compiled to WASM).
 * All heavy database work happens here, off the main thread.
 *
 * Message protocol
 * ─────────────────
 * Main → Worker  (WorkerCommand):
 *   { id, type: "init",       buffer: ArrayBuffer }
 *   { id, type: "query",      sql: string, params?: unknown[] }
 *   { id, type: "table_info", tableName: string }
 *   { id, type: "table_scan", tableName: string }   ← used by scan-pool workers
 *
 * Worker → Main  (WorkerResult):
 *   { id, ok: true,  data: unknown }
 *   { id, ok: false, error: string }
 */

// Load sql.js synchronously (WASM init is still async inside it).
importScripts("/sql-wasm.js");

/** @type {import('sql.js').Database | null} */
let db = null;

/**
 * Initialise sql.js and open the database from an ArrayBuffer.
 * @param {ArrayBuffer} buffer
 */
async function initDb(buffer) {
  const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  db = new SQL.Database(new Uint8Array(buffer));
}

/**
 * Run a SQL string and return columns + rows.
 * @param {string} sql
 * @param {unknown[]} [params]
 * @returns {{ columns: string[], rows: unknown[][] }}
 */
function execQuery(sql, params) {
  if (!db) throw new Error("Database not initialised");
  const results = db.exec(sql, params);
  if (results.length === 0) return { columns: [], rows: [] };
  return { columns: results[0].columns, rows: results[0].values };
}

/**
 * Return schema info for one table: columns + row count.
 * Used both internally and as the "table_scan" command for pool workers.
 * @param {string} tableName
 */
function scanTable(tableName) {
  if (!db) throw new Error("Database not initialised");

  const colResult = db.exec(`PRAGMA table_info("${tableName}")`);
  const columns =
    colResult.length > 0
      ? colResult[0].values.map((row) => ({
          cid: row[0],
          name: row[1],
          type: row[2],
          notnull: row[3],
          dflt_value: row[4],
          pk: row[5],
        }))
      : [];

  const countResult = db.exec(`SELECT COUNT(*) FROM "${tableName}"`);
  const rowCount =
    countResult.length > 0 ? countResult[0].values[0][0] : 0;

  return { name: tableName, rowCount, columns };
}

/**
 * List all user tables in the database.
 * @returns {string[]}
 */
function listTables() {
  if (!db) throw new Error("Database not initialised");
  const result = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return result.length > 0 ? result[0].values.map((r) => r[0]) : [];
}

// ─── Message handler ─────────────────────────────────────────────────────────

self.onmessage = async (event) => {
  const { id, type } = event.data;

  try {
    switch (type) {
      case "init": {
        const { buffer } = event.data;
        await initDb(buffer);
        const tableNames = listTables();
        self.postMessage({ id, ok: true, data: { tableNames } });
        break;
      }

      case "query": {
        const { sql, params } = event.data;
        const data = execQuery(sql, params);
        self.postMessage({ id, ok: true, data });
        break;
      }

      case "table_info": {
        const { tableName } = event.data;
        const data = scanTable(tableName);
        self.postMessage({ id, ok: true, data });
        break;
      }

      // Pool workers receive the buffer + a slice of table names to scan
      case "table_scan": {
        const { buffer, tableNames } = event.data;
        // Initialise own db from buffer copy if not already done
        if (!db) await initDb(buffer);
        const results = tableNames.map((name) => scanTable(name));
        self.postMessage({ id, ok: true, data: results });
        break;
      }

      // Parquet (or any tabular) data: build an in-memory SQLite DB from pre-parsed rows
      case "init_from_data": {
        const { tableName, columns, rows } = event.data;
        const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
        db = new SQL.Database();

        const colDefs = columns.map((c) => `"${c.name}" ${c.type}`).join(", ");
        db.run(`CREATE TABLE "${tableName}" (${colDefs})`);

        if (rows.length > 0) {
          const placeholders = columns.map(() => "?").join(", ");
          const stmt = db.prepare(`INSERT INTO "${tableName}" VALUES (${placeholders})`);
          for (const row of rows) {
            stmt.run(row);
          }
          stmt.free();
        }

        self.postMessage({ id, ok: true, data: { tableNames: [tableName] } });
        break;
      }

      default:
        self.postMessage({ id, ok: false, error: `Unknown command: ${type}` });
    }
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
