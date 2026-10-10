import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import type { DirSummary, IndexedFile } from "@/types/domain";

// Local cache of the folder tree (spec §5). Saved Messages is the source of truth, so a
// rescan (index/sync.ts) can rebuild every table here. TDLib keeps the messages and files.

const DB_NAME = "fileharbor.db";

// Each entry moves the schema up one version. Never edit an entry that has shipped.
const MIGRATIONS = [
  `CREATE TABLE dir_index (
     message_id INTEGER PRIMARY KEY,
     dir_path   TEXT NOT NULL,
     name       TEXT NOT NULL,
     date       INTEGER NOT NULL
   );
   CREATE INDEX idx_dir ON dir_index(dir_path);`,
];

export type DbResult<T> = { ok: true; value: T } | { ok: false; message: string };

type DirIndexRow = { message_id: number; dir_path: string; name: string; date: number };

let opening: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL");
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  for (let v = row?.user_version ?? 0; v < MIGRATIONS.length; v++) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(MIGRATIONS[v]);
      await tx.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

function open(): Promise<SQLiteDatabase> {
  if (!opening) {
    const next = openDatabaseAsync(DB_NAME).then(async (db) => {
      await migrate(db);
      return db;
    });
    // A failed open is not kept, so the next call tries again.
    next.catch(() => {
      if (opening === next) opening = null;
    });
    opening = next;
  }
  return opening;
}

async function run<T>(fn: (db: SQLiteDatabase) => Promise<T>): Promise<DbResult<T>> {
  try {
    return { ok: true, value: await fn(await open()) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Replaces all of dir_index in one transaction, so a reader never sees half a scan. */
export function replaceDirIndex(files: readonly IndexedFile[]): Promise<DbResult<void>> {
  return run((db) =>
    db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync("DELETE FROM dir_index");
      const insert = await tx.prepareAsync(
        "INSERT INTO dir_index (message_id, dir_path, name, date) VALUES (?, ?, ?, ?)",
      );
      try {
        for (const f of files) await insert.executeAsync(f.messageId, f.dirPath, f.name, f.date);
      } finally {
        await insert.finalizeAsync();
      }
    }),
  );
}

/** The files in one folder, newest first. */
export function getFilesInDir(dirPath: string): Promise<DbResult<IndexedFile[]>> {
  return run(async (db) => {
    const rows = await db.getAllAsync<DirIndexRow>(
      "SELECT message_id, dir_path, name, date FROM dir_index WHERE dir_path = ? ORDER BY date DESC",
      dirPath,
    );
    return rows.map((r) => ({
      messageId: r.message_id,
      dirPath: r.dir_path,
      name: r.name,
      date: r.date,
    }));
  });
}

/** Each folder path that holds files, with its file count. */
export function getDirSummaries(): Promise<DbResult<DirSummary[]>> {
  return run(async (db) => {
    const rows = await db.getAllAsync<{ dir_path: string; file_count: number }>(
      "SELECT dir_path, COUNT(*) AS file_count FROM dir_index GROUP BY dir_path ORDER BY dir_path",
    );
    return rows.map((r) => ({ dirPath: r.dir_path, fileCount: r.file_count }));
  });
}

/** Removes every row. Call it on log-out, so the next account starts empty. */
export function clearIndex(): Promise<DbResult<void>> {
  return run((db) => db.execAsync("DELETE FROM dir_index"));
}
