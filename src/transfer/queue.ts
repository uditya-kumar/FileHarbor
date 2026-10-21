import { File } from "expo-file-system";

import { serialiseCaption } from "@/format/caption";
import { syncIndex } from "@/index/sync";
import { deleteThumbnail, makeThumbnail } from "@/media/thumbnail";
import { toServiceError } from "@/telegram/auth";
import { onFileUpdate } from "@/telegram/download";
import { getSavedMessagesChatId } from "@/telegram/savedMessages";
import { documentFileOf, localPathOf, sendDocument } from "@/telegram/upload";
import type {
  ServiceResult,
  UploadProgress,
  UploadSource,
} from "@/types/domain";

// The write path for one file (spec §11 step 5): the caption, the thumbnail, the send, and the
// progress. TDLib does the parts, the resume, and the flood waits (spec §4.2). Phase 9 makes
// this a persistent queue in SQLite (spec §5), with a search before each retry (§5 order 3).
// Only this file maps the upload messages and files of TDLib to domain types.

/** The captions that send now. A second send of one caption could not be matched (upload.ts). */
const sending = new Set<string>();

function fail(code: string): ServiceResult<void> {
  return { ok: false, error: { kind: "failed", code } };
}

function removeCopy(source: UploadSource): void {
  if (!source.temporary) return;
  try {
    new File(source.uri).delete();
  } catch {
    // A file in the app cache. The system cleans it.
  }
}

/**
 * Uploads one file to the folder `dirPath` of Saved Messages, and rebuilds the index so the
 * folder shows it. It resolves when Telegram has the file. A failed upload keeps the picked
 * copy, so the caller can start it again.
 */
export async function uploadFile(
  source: UploadSource,
  dirPath: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<ServiceResult<void>> {
  // The caption is the only record of the folder (spec §1). A bad name sends nothing.
  const caption = serialiseCaption({ dirPath, name: source.name });
  if (!caption.ok)
    return fail(caption.error === "too_long" ? "NAME_TOO_LONG" : "BAD_NAME");
  const path = localPathOf(source.uri);
  if (!path) return fail("NOT_LOCAL_FILE");
  if (sending.has(caption.caption)) return fail("ALREADY_SENDING");

  const chat = await getSavedMessagesChatId();
  if (!chat.ok) return { ok: false, error: toServiceError(chat.error) };

  sending.add(caption.caption);
  const thumbnail = await makeThumbnail(source.uri, source.kind);
  let fileId: number | null = null;
  // updateFile gives the upload progress of the pending message's file (spec §4.2).
  const unwatch = onFileUpdate((file) => {
    if (file.id !== fileId) return;
    onProgress?.({
      uploaded: file.remote?.uploaded_size ?? 0,
      size: file.size || file.expected_size || source.size,
    });
  });
  try {
    const sent = await sendDocument(
      {
        chatId: chat.value,
        path,
        caption: caption.caption,
        thumbnail: thumbnail
          ? {
              path: localPathOf(thumbnail.uri) ?? thumbnail.uri,
              width: thumbnail.width,
              height: thumbnail.height,
            }
          : null,
      },
      (pending) => {
        fileId = documentFileOf(pending)?.id ?? null;
        onProgress?.({ uploaded: 0, size: source.size });
      },
    );
    if (!sent.ok) return { ok: false, error: toServiceError(sent.error) };
    removeCopy(source);
    // The new file shows in its folder. A failed sync is not an upload error: the file is on
    // Telegram, and the next refresh shows it.
    await syncIndex();
    return { ok: true, value: undefined };
  } finally {
    unwatch();
    sending.delete(caption.caption);
    if (thumbnail) deleteThumbnail(thumbnail);
  }
}
