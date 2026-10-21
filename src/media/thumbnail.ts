import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { getThumbnailAsync } from "expo-video-thumbnails";

import type { MediaKind } from "@/types/domain";

// The thumbnail that goes up with a photo or video (spec §4.2, §6 order 4). Telegram keeps it
// with the document, and the 07 grid shows it with no download of the original (spec §8.1).
// Telegram takes a JPEG of at most 320 px on each side.

/** The longest side of the thumbnail (spec §4.2). */
const MAX_SIDE = 320;
const JPEG_QUALITY = 0.8;
/** A frame after the start: the first frame of a video is often black. */
const VIDEO_FRAME_MS = 1000;

export type UploadThumbnail = { uri: string; width: number; height: number };

/** The size that fits in MAX_SIDE with the same ratio. null: the image is small already. */
function fitOf(
  width: number,
  height: number,
): { width: number; height: number } | null {
  const scale = MAX_SIDE / Math.max(width, height);
  if (!(scale < 1)) return null;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function fromImage(uri: string): Promise<UploadThumbnail> {
  const context = ImageManipulator.manipulate(uri);
  const original = await context.renderAsync();
  const fit = fitOf(original.width, original.height);
  const image = fit ? await context.resize(fit).renderAsync() : original;
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
  });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

async function videoFrame(uri: string): Promise<string> {
  try {
    return (await getThumbnailAsync(uri, { time: VIDEO_FRAME_MS })).uri;
  } catch {
    // A video shorter than VIDEO_FRAME_MS.
    return (await getThumbnailAsync(uri, { time: 0 })).uri;
  }
}

function remove(uri: string): void {
  try {
    new File(uri).delete();
  } catch {
    // A file in the cache folder. The system cleans it.
  }
}

/**
 * Makes the upload thumbnail. null for a document, or when the image cannot be read: the file
 * still uploads, and the grid shows its type icon. The caller deletes the file after the send.
 */
export async function makeThumbnail(
  uri: string,
  kind: MediaKind,
): Promise<UploadThumbnail | null> {
  if (kind === "other") return null;
  try {
    if (kind === "photo") return await fromImage(uri);
    const frame = await videoFrame(uri);
    try {
      return await fromImage(frame);
    } finally {
      remove(frame);
    }
  } catch {
    return null;
  }
}

/** Deletes a thumbnail after the send. */
export function deleteThumbnail(thumbnail: UploadThumbnail): void {
  remove(thumbnail.uri);
}
