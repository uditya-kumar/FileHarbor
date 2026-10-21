import { sendMessageTracked } from "./client";
import type {
  TdFile,
  TdMessage,
  TdMessageDocument,
  TdObject,
  TdResult,
} from "./types";

// Document uploads (spec §4.2). TDLib does the parts, the resume, and the flood waits; this
// file only builds the send. The wrapped sendMessage is text-only (spec §3.2.1), so the send
// goes through the raw hatch, and client.ts correlates it from the update stream (§3.2.3).

/** A 320 px JPEG on the device. Telegram shows it in the grid (spec §8.1). */
export type DocumentThumbnail = { path: string; width: number; height: number };

export type DocumentUpload = {
  chatId: number;
  /** An absolute path on the device (see `localPathOf`). */
  path: string;
  caption: string;
  thumbnail: DocumentThumbnail | null;
};

/**
 * The path that `inputFileLocal` reads, or null when TDLib cannot read the URI. TDLib opens
 * a plain file path; a `content://` URI must be copied to a file first (spec §12.3).
 */
export function localPathOf(uri: string): string | null {
  if (uri.startsWith("/")) return uri;
  if (!uri.startsWith("file://")) return null;
  const path = uri.slice("file://".length);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function captionOf(message: TdMessage): string | null {
  if (message.content["@type"] !== "messageDocument") return null;
  return (
    (message.content as unknown as TdMessageDocument).caption?.text ?? null
  );
}

/** The document file of a message: the file that uploads while the message is pending. */
export function documentFileOf(message: TdMessage): TdFile | null {
  if (message.content["@type"] !== "messageDocument") return null;
  return (
    (message.content as unknown as TdMessageDocument).document?.document ?? null
  );
}

/**
 * Sends one file as a document and resolves when Telegram has it. The native send is never
 * awaited: the bridge stalls on large files (spec §4.2). `onPending` gives the temporary
 * message, so the caller can read the upload progress from updateFile.
 *
 * The pending message is matched by chat and caption. Two sends with the same caption at the
 * same time cannot be told apart; the queue does not start a file that is already sending.
 */
export function sendDocument(
  upload: DocumentUpload,
  onPending?: (pending: TdMessage) => void,
): Promise<TdResult<TdMessage>> {
  const content: TdObject & Record<string, unknown> = {
    "@type": "inputMessageDocument",
    document: { "@type": "inputFileLocal", path: upload.path },
    caption: { "@type": "formattedText", text: upload.caption },
    // Without it, Telegram can treat the file as a photo or a video and re-encode it
    // (spec §4.2, §10). The app stores the bytes as they are (spec §1 order 4).
    disable_content_type_detection: true,
  };
  if (upload.thumbnail) {
    content.thumbnail = {
      "@type": "inputThumbnail",
      thumbnail: { "@type": "inputFileLocal", path: upload.thumbnail.path },
      width: upload.thumbnail.width,
      height: upload.thumbnail.height,
    };
  }
  return sendMessageTracked(
    {
      "@type": "sendMessage",
      chat_id: upload.chatId,
      input_message_content: content,
    },
    (pending) =>
      pending.chat_id === upload.chatId &&
      captionOf(pending) === upload.caption,
    onPending,
  );
}
