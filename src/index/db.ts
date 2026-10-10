import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import { childDirPath, dirSegments } from "@/format/caption";
import type { DirSummary, FolderSummary, IndexedFile } from "@/types/domain";

// Local cache of the folder tree (spec §5). Saved Messages is the source of truth, so a
// rescan (index/sync.ts) can rebuild dir_index. TDLib keeps the messages and files.
//
// local_dir is the one table that a rescan cannot rebuild: a folder with no file yet (06).
// No caption has its name until its first upload. A sync removes the row when it finds a file
// in the folder, so a folder with files is recorded in captions only (spec §1 order 2).

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
  `ALTER TABLE dir_index ADD COLUMN size INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE dir_index ADD COLUMN mime_type TEXT NOT NULL DEFAULT '';
   CREATE TABLE local_dir (
     dir_path   TEXT PRIMARY KEY,
     created_at INTEGER NOT NULL
   );`,
];

// True when the dir_index row `d` is in the folder `dirPath` or in a folder inside it.
// substr, not LIKE: a folder name can hold "%" and "_".
function inFolder(dirPath: string): string {
  return `(d.dir_path = ${dirPath} OR substr(d.dir_path, 1, length(${dirPath}) + 1) = ${dirPath} || '/')`;
}

export type DbResult<T> =
  { ok: true; value: T } | { ok: false; message: string };

type DirIndexRow = {
  message_id: number;
  dir_path: string;
  name: string;
  date: number;
  size: number;
  mime_type: string;
};

type DirSummaryRow = {
  dir_path: string;
  file_count: number;
  total_size: number;
  media_count: number;
};

let opening: Promise<SQLiteDatabase> | null = null;

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL");
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
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

async function run<T>(
  fn: (db: SQLiteDatabase) => Promise<T>,
): Promise<DbResult<T>> {
  try {
    return { ok: true, value: await fn(await open()) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Replaces all of dir_index in one transaction, so a reader never sees half a scan. Then it
 * removes each local_dir row that now has files, because the captions record that folder.
 */
export function replaceDirIndex(
  files: readonly IndexedFile[],
): Promise<DbResult<void>> {
  return run((db) =>
    db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync("DELETE FROM dir_index");
      const insert = await tx.prepareAsync(
        "INSERT INTO dir_index (message_id, dir_path, name, date, size, mime_type) VALUES (?, ?, ?, ?, ?, ?)",
      );
      try {
        for (const f of files) {
          await insert.executeAsync(
            f.messageId,
            f.dirPath,
            f.name,
            f.date,
            f.size,
            f.mimeType,
          );
        }
      } finally {
        await insert.finalizeAsync();
      }
      await tx.runAsync(
        `DELETE FROM local_dir WHERE EXISTS (SELECT 1 FROM dir_index d WHERE ${inFolder("local_dir.dir_path")})`,
      );
    }),
  );
}

/** The files in one folder, newest first. */
export function getFilesInDir(
  dirPath: string,
): Promise<DbResult<IndexedFile[]>> {
  return run(async (db) => {
    const rows = await db.getAllAsync<DirIndexRow>(
      "SELECT message_id, dir_path, name, date, size, mime_type FROM dir_index WHERE dir_path = ? ORDER BY date DESC",
      dirPath,
    );
    return rows.map((r) => ({
      messageId: r.message_id,
      dirPath: r.dir_path,
      name: r.name,
      date: r.date,
      size: r.size,
      mimeType: r.mime_type,
    }));
  });
}

async function readDirSummaries(db: SQLiteDatabase): Promise<DirSummary[]> {
  const rows = await db.getAllAsync<DirSummaryRow>(
    `SELECT dir_path, COUNT(*) AS file_count, SUM(size) AS total_size,
       SUM(CASE WHEN mime_type LIKE 'image/%' OR mime_type LIKE 'video/%' THEN 1 ELSE 0 END)
         AS media_count
     FROM dir_index GROUP BY dir_path ORDER BY dir_path`,
  );
  return rows.map((r) => ({
    dirPath: r.dir_path,
    fileCount: r.file_count,
    totalSize: r.total_size,
    mediaCount: r.media_count,
  }));
}

/** Each folder path that holds files, with the counts of the files directly in it. */
export function getDirSummaries(): Promise<DbResult<DirSummary[]>> {
  return run(readDirSummaries);
}

/** The name of the folder directly in `parent` that holds `dirPath`, or null. */
function childName(parent: readonly string[], dirPath: string): string | null {
  const segments = dirSegments(dirPath);
  if (segments.length <= parent.length) return null;
  return parent.every((s, i) => segments[i] === s)
    ? segments[parent.length]
    : null;
}

/**
 * The folders directly in `parent`, sorted by name. The counts of a folder include all the
 * folders inside it. A local_dir folder with no file has zero counts.
 */
export function getChildFolders(
  parent: string,
): Promise<DbResult<FolderSummary[]>> {
  return run(async (db) => {
    const summaries = await readDirSummaries(db);
    const local = await db.getAllAsync<{ dir_path: string }>(
      "SELECT dir_path FROM local_dir",
    );
    const parentSegments = dirSegments(parent);
    const folders = new Map<string, FolderSummary>();

    const folderFor = (dirPath: string): FolderSummary | null => {
      const name = childName(parentSegments, dirPath);
      const path = name === null ? null : childDirPath(parent, name);
      if (name === null || path === null) return null;
      let folder = folders.get(name);
      if (!folder) {
        folder = {
          dirPath: path,
          name,
          fileCount: 0,
          totalSize: 0,
          mediaCount: 0,
        };
        folders.set(name, folder);
      }
      return folder;
    };

    for (const s of summaries) {
      const folder = folderFor(s.dirPath);
      if (!folder) continue;
      folder.fileCount += s.fileCount;
      folder.totalSize += s.totalSize;
      folder.mediaCount += s.mediaCount;
    }
    for (const l of local) folderFor(l.dir_path);
    return [...folders.values()].sort((a, b) => a.name.localeCompare(b.name));
  });
}

/**
 * Records a new empty folder on this device (06). Gives "exists" when a file or a local folder
 * already has the path. Make `dirPath` with childDirPath, so it is valid.
 */
export function addLocalDir(
  dirPath: string,
): Promise<DbResult<"added" | "exists">> {
  return run(async (db) => {
    let result: "added" | "exists" = "exists";
    await db.withExclusiveTransactionAsync(async (tx) => {
      // inFolder("?") has three placeholders, all for the same path.
      const file = await tx.getFirstAsync(
        `SELECT 1 FROM dir_index d WHERE ${inFolder("?")} LIMIT 1`,
        [dirPath, dirPath, dirPath],
      );
      const local = await tx.getFirstAsync(
        "SELECT 1 FROM local_dir WHERE dir_path = ?",
        dirPath,
      );
      if (file || local) return;
      await tx.runAsync(
        "INSERT INTO local_dir (dir_path, created_at) VALUES (?, ?)",
        dirPath,
        Math.floor(Date.now() / 1000),
      );
      result = "added";
    });
    return result;
  });
}

/** Removes every row. Call it on log-out, so the next account starts empty. */
export function clearIndex(): Promise<DbResult<void>> {
  return run((db) =>
    db.execAsync("DELETE FROM dir_index; DELETE FROM local_dir;"),
  );
}
