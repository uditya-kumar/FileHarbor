import { parseCaption } from "@/format/caption";
import { replaceDirIndex } from "@/index/db";
import { toServiceError } from "@/telegram/auth";
import { getSavedMessagesChatId } from "@/telegram/savedMessages";
import { getFullHistory } from "@/telegram/search";
import type { TdMessage } from "@/telegram/types";
import type {
  IndexedFile,
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
  // The caption name, not the document file name: a rename edits the caption only.
  return {
    kind: "file",
    file: {
      messageId: message.id,
      dirPath: parsed.value.dirPath,
      name: parsed.value.name,
      date: message.date,
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
