import { parseCaption } from "@/format/caption";
import { getFilesInDir, replaceDirIndex } from "@/index/db";
import { minithumbnailUri } from "@/media/minithumbnail";
import { toServiceError } from "@/telegram/auth";
import {
  cancelDownload,
  downloadFile,
  getFile,
  onFileUpdate,
  startPriorityDownload,
} from "@/telegram/download";
import { getSavedMessagesChatId } from "@/telegram/savedMessages";
import { getFullHistory, getMessages } from "@/telegram/search";
import type { TdFile, TdMessage, TdMessageDocument } from "@/telegram/types";
import type {
  FileProgress,
  FolderFile,
  IndexedFile,
  MediaKind,
  ServiceError,
  ServiceResult,
  SyncReport,
  SyncSkip,
} from "@/types/domain";

// Full scan of Saved Messages into dir_index (spec §1 order 3, §5). The tree comes from the
// captions only; there is no manifest. Only this file maps TDLib messages to IndexedFile.

type Classified =
  | { kind: "file"; file: IndexedFile }
  | { kind: "skip"; skip: SyncSkip }
  | { kind: "other" };

function captionOf(message: TdMessage): string | null {
  const caption = (message.content as { caption?: { text?: unknown } }).caption;
  return typeof caption?.text === "string" ? caption.text : null;
}

export function classifyMessage(message: TdMessage): Classified {
  // A message that is still sending has a temporary id. The next scan gets the real one.
  if (message.sending_state) return { kind: "other" };
  const caption = captionOf(message);
  if (caption === null) return { kind: "other" };

  const parsed = parseCaption(caption);
  if (!parsed.ok) {
    // A FileHarbor caption that does not parse is recorded, so the sync report shows it.
    return parsed.error === "bad_caption"
      ? {
          kind: "skip",
          skip: { messageId: message.id, caption, reason: "bad_caption" },
        }
      : { kind: "other" };
  }
  // The app uploads documents only (spec §1 order 4). A photo or a video is re-encoded.
  if (message.content["@type"] !== "messageDocument") {
    return {
      kind: "skip",
      skip: { messageId: message.id, caption, reason: "not_document" },
    };
  }
  const document = (message.content as unknown as TdMessageDocument).document;
  const file = document?.document;
  // The caption name, not the document file name: a rename edits the caption only.
  return {
    kind: "file",
    file: {
      messageId: message.id,
      dirPath: parsed.value.dirPath,
      name: parsed.value.name,
      date: message.date,
      // size is 0 when TDLib does not know it; expected_size is then the best value.
      size: file?.size || file?.expected_size || 0,
      mimeType:
        typeof document?.mime_type === "string" ? document.mime_type : "",
    },
  };
}

let running: Promise<ServiceResult<SyncReport>> | null = null;

async function scan(
  onProgress?: (loaded: number) => void,
): Promise<ServiceResult<SyncReport>> {
  const chat = await getSavedMessagesChatId();
  if (!chat.ok) return { ok: false, error: toServiceError(chat.error) };

  const history = await getFullHistory(chat.value, onProgress);
  if (!history.ok) return { ok: false, error: toServiceError(history.error) };

  const files: IndexedFile[] = [];
  const report: SyncReport = {
    scanned: history.value.length,
    indexed: 0,
    other: 0,
    skipped: [],
  };
  for (const message of history.value) {
    const c = classifyMessage(message);
    if (c.kind === "file") files.push(c.file);
    else if (c.kind === "skip") report.skipped.push(c.skip);
    else report.other++;
  }
  report.indexed = files.length;

  const saved = await replaceDirIndex(files);
  if (!saved.ok)
    return { ok: false, error: { kind: "failed", code: saved.message } };
  return { ok: true, value: report };
}

/** Rebuilds dir_index from all captions. A call during a running sync gets the same result. */
export function syncIndex(
  onProgress?: (loaded: number) => void,
): Promise<ServiceResult<SyncReport>> {
  running ??= scan(onProgress).finally(() => {
    running = null;
  });
  return running;
}

// ---------- Read path (spec §8): one folder, with the current file data ----------

// spec §8.5 names .jpeg, .png, .heic, and .mp4. The others also decode on Android (Glide,
// ExoPlayer). The extension is the fallback when Telegram gives no useful MIME type.
const PHOTO_EXT = ["jpg", "jpeg", "png", "heic", "heif", "webp", "gif"];
const VIDEO_EXT = ["mp4", "mov", "m4v", "webm", "3gp", "mkv"];
const PHOTO_MIME = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "image/gif",
];
const VIDEO_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
  "video/x-matroska",
];

export function mediaKindOf(name: string, mimeType: string): MediaKind {
  const mime = mimeType.toLowerCase();
  if (PHOTO_MIME.includes(mime)) return "photo";
  if (VIDEO_MIME.includes(mime)) return "video";
  const dot = name.lastIndexOf(".");
  const ext = dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
  if (PHOTO_EXT.includes(ext)) return "photo";
  if (VIDEO_EXT.includes(ext)) return "video";
  return "other";
}

function completedUri(file: TdFile | undefined): string | null {
  const local = file?.local;
  return local?.is_downloading_completed && local.path
    ? `file://${local.path}`
    : null;
}

/** The current file data of one indexed row. null when the message is no longer a document. */
export function toFolderFile(
  row: IndexedFile,
  message: TdMessage,
): FolderFile | null {
  if (message.content["@type"] !== "messageDocument") return null;
  const document = (message.content as unknown as TdMessageDocument).document;
  if (!document?.document) return null;
  const thumbnail = document.thumbnail?.file;
  return {
    ...row,
    kind: mediaKindOf(row.name, row.mimeType),
    fileId: document.document.id,
    localUri: completedUri(document.document),
    thumbnailFileId: thumbnail?.id ?? null,
    thumbnailUri: completedUri(thumbnail),
    placeholderUri: minithumbnailUri(document.minithumbnail?.data),
  };
}

/**
 * The files of one folder, newest first. The list comes from dir_index; the file data comes
 * from TDLib, because a TDLib file id is valid in one TDLib instance only. A file deleted on
 * Telegram is left out; the next sync removes its row.
 */
export async function loadFolderFiles(
  dirPath: string,
): Promise<ServiceResult<FolderFile[]>> {
  const rows = await getFilesInDir(dirPath);
  if (!rows.ok)
    return { ok: false, error: { kind: "failed", code: rows.message } };
  if (rows.value.length === 0) return { ok: true, value: [] };

  const chat = await getSavedMessagesChatId();
  if (!chat.ok) return { ok: false, error: toServiceError(chat.error) };
  const messages = await getMessages(
    chat.value,
    rows.value.map((r) => r.messageId),
  );
  if (!messages.ok) return { ok: false, error: toServiceError(messages.error) };

  const files: FolderFile[] = [];
  rows.value.forEach((row, i) => {
    const message = messages.value[i];
    const file = message ? toFolderFile(row, message) : null;
    if (file) files.push(file);
  });
  return { ok: true, value: files };
}

/** Downloads a thumbnail (a few KB; TDLib caches it) and gives its file:// URI (spec §8.1). */
export async function loadThumbnail(
  fileId: number,
): Promise<ServiceResult<string>> {
  const res = await downloadFile(fileId);
  if (!res.ok) return { ok: false, error: toServiceError(res.error) };
  const uri = completedUri(res.value);
  return uri
    ? { ok: true, value: uri }
    : { ok: false, error: { kind: "failed", code: "NO_LOCAL_PATH" } };
}

function toProgress(file: TdFile): FileProgress {
  return {
    downloaded: file.local?.downloaded_size ?? 0,
    size: file.size || file.expected_size || 0,
    localUri: completedUri(file),
  };
}

/**
 * Downloads one file for the viewer (09, 10) at the highest priority (spec §4.3), and reports
 * its progress. The result of the start call does not get to JS (TaskList 5.0), so the
 * progress comes from updateFile. Call the returned function when the file is not on screen:
 * it stops the reports and cancels a download that this call started. The parts on the
 * device stay, so the next open continues from them.
 */
export function viewFile(
  fileId: number,
  onChange: (progress: FileProgress) => void,
  onError: (error: ServiceError) => void,
): () => void {
  let stopped = false;
  let started = false;
  let complete = false;
  const report = (file: TdFile): void => {
    const progress = toProgress(file);
    complete = progress.localUri !== null;
    if (!stopped) onChange(progress);
  };
  const unsubscribe = onFileUpdate((file) => {
    if (file.id === fileId) report(file);
  });

  void getFile(fileId).then(async (res) => {
    if (stopped) return;
    if (!res.ok) {
      onError(toServiceError(res.error));
      return;
    }
    report(res.value);
    if (complete) return;
    started = true;
    const start = await startPriorityDownload(fileId);
    if (!start.ok && !stopped) onError(toServiceError(start.error));
  });

  return () => {
    stopped = true;
    unsubscribe();
    if (started && !complete) void cancelDownload(fileId);
  };
}
