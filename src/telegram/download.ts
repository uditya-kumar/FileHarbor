import { call, onUpdate, parseRaw, sendRaw } from "./client";
import type { TdFile, TdResult } from "./types";

// File downloads (spec §4.3). TDLib does the chunking, the resume, and the retries; this file
// only starts, cancels, and watches. The binding resolves most file calls with a TDLib error
// object, so every result goes through parseRaw.

/** TDLib's highest download priority (range 1–32). For the file that the user looks at. */
export const PRIORITY_VIEWING = 32;

/**
 * Downloads the whole file and resolves when it is on the device (spec §3.2.5). The binding
 * uses priority 1, TDLib's lowest. An already downloaded file resolves at once.
 */
export async function downloadFile(fileId: number): Promise<TdResult<TdFile>> {
  const res = await call((td) => td.downloadFile(fileId));
  if (!res.ok) return res;
  return parseRaw<TdFile>(res.value.raw, "file");
}

/**
 * Starts a download at a higher priority, or raises the priority of a running one. The raw
 * call returns nothing (spec §3.2.3): read the progress from `onFileUpdate`.
 */
export function startPriorityDownload(
  fileId: number,
  priority: number = PRIORITY_VIEWING,
): Promise<TdResult<void>> {
  return sendRaw({
    "@type": "downloadFile",
    file_id: fileId,
    priority,
    offset: 0,
    limit: 0,
    synchronous: false,
  });
}

/** Stops a download. The parts on the device stay, so a new download continues from them. */
export async function cancelDownload(fileId: number): Promise<TdResult<void>> {
  const res = await call((td) => td.cancelDownloadFile(fileId, false));
  if (!res.ok) return res;
  const ok = parseRaw(res.value.raw, "ok");
  return ok.ok ? { ok: true, value: undefined } : ok;
}

/** The current state of a file, e.g. to read its path after a restart. */
export async function getFile(fileId: number): Promise<TdResult<TdFile>> {
  const res = await call((td) => td.getFile(fileId));
  if (!res.ok) return res;
  return parseRaw<TdFile>(res.value.raw, "file");
}

/** Each change to any file: download and upload progress (spec §8.6). */
export function onFileUpdate(handler: (file: TdFile) => void): () => void {
  return onUpdate("updateFile", (u) => handler(u.file));
}
