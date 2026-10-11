import { fetchFile, stopFile, watchFiles } from "@/index/sync";
import type { DownloadItem, FileProgress, FolderFile } from "@/types/domain";

// The Downloads list (12): the files that the user asked for in 08. TDLib does the chunks, the
// resume, and the retries (spec §4.3); this file only keeps the list, starts a few files at a
// time, and reads the progress from updateFile (spec §8.6). The list is in memory: a TDLib
// file id is valid in one TDLib instance only. After a restart, the parts on the device stay,
// and a new download continues from them.

/** Files that download at the same time (spec §8.4: 3–4 in parallel, TDLib runs them). */
export const MAX_PARALLEL_DOWNLOADS = 4;

/** The minimum time between two speed measures of one file. */
const SPEED_WINDOW_MS = 1000;

/** updateFile can come many times a second. A progress change goes to the screens this often. */
const EMIT_INTERVAL_MS = 250;

let items: readonly DownloadItem[] = [];
const listeners = new Set<() => void>();
/** A new token for each start. A result from an earlier start (before a pause) is ignored. */
const runs = new Map<number, number>();
let nextRun = 1;
/** The last speed measure of each file that downloads. */
const samples = new Map<number, { bytes: number; at: number }>();
let unwatch: (() => void) | null = null;
let emitTimer: ReturnType<typeof setTimeout> | null = null;

function emit(): void {
  if (emitTimer) {
    clearTimeout(emitTimer);
    emitTimer = null;
  }
  listeners.forEach((listener) => listener());
}

function emitSoon(): void {
  if (emitTimer) return;
  emitTimer = setTimeout(() => {
    emitTimer = null;
    listeners.forEach((listener) => listener());
  }, EMIT_INTERVAL_MS);
}

function update(fileId: number, change: Partial<DownloadItem>): void {
  items = items.map((i) => (i.fileId === fileId ? { ...i, ...change } : i));
}

/** Takes the file out of the list. */
function drop(fileId: number): void {
  items = items.filter((i) => i.fileId !== fileId);
  runs.delete(fileId);
  samples.delete(fileId);
}

/** Watches updateFile only while the list has a file. */
function syncWatch(): void {
  if (items.length > 0 && !unwatch) unwatch = watchFiles(onProgress);
  else if (items.length === 0 && unwatch) {
    unwatch();
    unwatch = null;
  }
}

function speedOf(item: DownloadItem, downloaded: number): number | null {
  const now = Date.now();
  const last = samples.get(item.fileId);
  if (!last) {
    samples.set(item.fileId, { bytes: downloaded, at: now });
    return item.bytesPerSecond;
  }
  if (now - last.at < SPEED_WINDOW_MS) return item.bytesPerSecond;
  samples.set(item.fileId, { bytes: downloaded, at: now });
  const rate = Math.max(
    0,
    ((downloaded - last.bytes) * 1000) / (now - last.at),
  );
  // The mean with the last value: the number does not jump at each measure.
  return item.bytesPerSecond === null ? rate : (item.bytesPerSecond + rate) / 2;
}

function onProgress(fileId: number, progress: FileProgress): void {
  const item = items.find((i) => i.fileId === fileId);
  if (!item) return;
  if (progress.localUri) {
    // Complete, also when another screen (the viewer) downloaded it.
    drop(fileId);
    pump();
    syncWatch();
    emit();
    return;
  }
  if (item.status !== "downloading") {
    if (progress.downloaded === item.downloaded) return;
    update(fileId, { downloaded: progress.downloaded });
  } else {
    update(fileId, {
      downloaded: progress.downloaded,
      size: progress.size || item.size,
      bytesPerSecond: speedOf(item, progress.downloaded),
    });
  }
  emitSoon();
}

function start(fileId: number): void {
  const run = nextRun++;
  runs.set(fileId, run);
  samples.delete(fileId);
  update(fileId, { status: "downloading", error: null, bytesPerSecond: null });
  void fetchFile(fileId).then((res) => {
    if (runs.get(fileId) !== run) return;
    if (res.ok) drop(fileId);
    else {
      runs.delete(fileId);
      update(fileId, {
        status: "failed",
        error: res.error,
        bytesPerSecond: null,
      });
    }
    pump();
    syncWatch();
    emit();
  });
}

/** Starts queued files, in list order, until MAX_PARALLEL_DOWNLOADS download. */
function pump(): void {
  let running = items.filter((i) => i.status === "downloading").length;
  for (const item of items) {
    if (running >= MAX_PARALLEL_DOWNLOADS) break;
    if (item.status !== "queued") continue;
    running++;
    start(item.fileId);
  }
}

/**
 * Adds files to the end of the list. A file that is on the device or in the list already is
 * not added. Returns the number of files added.
 */
export function addDownloads(files: readonly FolderFile[]): number {
  const known = new Set(items.map((i) => i.fileId));
  const added: DownloadItem[] = [];
  for (const f of files) {
    if (f.localUri || known.has(f.fileId)) continue;
    known.add(f.fileId);
    added.push({
      fileId: f.fileId,
      messageId: f.messageId,
      dirPath: f.dirPath,
      name: f.name,
      kind: f.kind,
      size: f.size,
      thumbnailUri: f.thumbnailUri,
      placeholderUri: f.placeholderUri,
      status: "queued",
      downloaded: 0,
      bytesPerSecond: null,
      error: null,
    });
  }
  if (added.length === 0) return 0;
  items = [...items, ...added];
  syncWatch();
  pump();
  emit();
  return added.length;
}

/** Stops a queued or running file. The parts on the device stay. */
export function pauseDownload(fileId: number): void {
  const item = items.find((i) => i.fileId === fileId);
  if (!item || (item.status !== "downloading" && item.status !== "queued"))
    return;
  runs.delete(fileId);
  update(fileId, { status: "paused", bytesPerSecond: null });
  if (item.status === "downloading") void stopFile(fileId);
  pump();
  emit();
}

/** Puts a paused or failed file back in the queue. */
export function resumeDownload(fileId: number): void {
  const item = items.find((i) => i.fileId === fileId);
  if (!item || (item.status !== "paused" && item.status !== "failed")) return;
  update(fileId, { status: "queued", error: null });
  pump();
  emit();
}

/** Stops the files and takes them out of the list (14 cancel). */
export function removeDownloads(fileIds: readonly number[]): void {
  for (const fileId of fileIds) {
    const item = items.find((i) => i.fileId === fileId);
    if (!item) continue;
    if (item.status === "downloading") void stopFile(fileId);
    drop(fileId);
  }
  pump();
  syncWatch();
  emit();
}

/** True when the file is in the list. The viewer does not cancel such a file when it closes. */
export function isInDownloads(fileId: number): boolean {
  return items.some((i) => i.fileId === fileId);
}

/** The list, in the order that the user added the files. A new array after each change. */
export function getDownloads(): readonly DownloadItem[] {
  return items;
}

export function subscribeDownloads(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetDownloadsForTests(): void {
  unwatch?.();
  unwatch = null;
  if (emitTimer) clearTimeout(emitTimer);
  emitTimer = null;
  items = [];
  runs.clear();
  samples.clear();
  listeners.clear();
}
