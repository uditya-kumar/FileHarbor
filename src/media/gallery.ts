import { Directory, File, Paths } from "expo-file-system";
import {
  Asset,
  getPermissionsAsync,
  requestPermissionsAsync,
  type PermissionResponse,
} from "expo-media-library";

import type { MediaAccess, ServiceResult } from "@/types/domain";

// Saves a downloaded photo or video in the phone gallery (spec §4.3: hand the TDLib file to
// expo-media-library). The file is already on the device in the TDLib cache: this is a local
// copy, not a Telegram transfer. A document (PDF, ZIP) cannot go into the media library. It
// saves through the folder picker of sheet 11 (saveToDevice.ts).

/** Saving needs write access only. On Android 13+ it asks for nothing (spec §2). */
const WRITE_ONLY = true;
/** Read access: the upload reads the real file name (photo picker names are media ids). */
const READ_WRITE = false;
const GRANULAR = ["photo", "video"] as const;

/** A part folder for each save, so two files with one name do not collide. */
const STAGING = "gallery";

function codeOf(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" && code) return code;
  }
  return fallback;
}

function accessOf(response: PermissionResponse): MediaAccess {
  if (response.granted) return "granted";
  if (response.status === "undetermined") return "undetermined";
  return response.canAskAgain ? "denied" : "blocked";
}

export async function getSaveAccess(): Promise<MediaAccess> {
  try {
    return accessOf(await getPermissionsAsync(WRITE_ONLY, [...GRANULAR]));
  } catch {
    return "denied";
  }
}

/** Shows the Android prompt if the user can still answer it. */
export async function requestSaveAccess(): Promise<MediaAccess> {
  try {
    return accessOf(await requestPermissionsAsync(WRITE_ONLY, [...GRANULAR]));
  } catch {
    return "denied";
  }
}

export async function getReadAccess(): Promise<MediaAccess> {
  try {
    return accessOf(await getPermissionsAsync(READ_WRITE, [...GRANULAR]));
  } catch {
    return "denied";
  }
}

/** Shows the Android prompt for photos and videos (spec §6 order 5). */
export async function requestReadAccess(): Promise<MediaAccess> {
  try {
    return accessOf(await requestPermissionsAsync(READ_WRITE, [...GRANULAR]));
  } catch {
    return "denied";
  }
}

/**
 * The file name in the media store, e.g. "VID_20261021_103831.mp4", of the photo or video
 * with this media id. null with no read access, or with access to selected items only
 * (Android 14+) when this item is not one of them.
 */
export async function mediaFileName(
  mediaId: string,
  kind: "photo" | "video",
): Promise<string | null> {
  const collection = kind === "video" ? "video" : "images";
  try {
    const name = await new Asset(
      `content://media/external/${collection}/media/${mediaId}`,
    ).getFilename();
    return name || null;
  } catch {
    return null;
  }
}

/** The last part of a file:// URI, decoded. */
function baseName(uri: string): string {
  const last = uri.split("/").pop() ?? "";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/** A caption name can have any character. Android file names cannot have these. */
function safeName(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|]/g, "_").trim();
  return clean || "file";
}

/**
 * Adds the file to the gallery with the caption name. The media library names the new item
 * after the file it reads, and TDLib can name a file in its cache "IMG_4821_1.HEIC". In that
 * case the file goes through a short copy in the app cache, which is deleted after.
 */
export async function saveToGallery(
  localUri: string,
  name: string,
  fileId: number,
): Promise<ServiceResult<void>> {
  const wanted = safeName(name);
  let staging: Directory | null = null;
  try {
    let source = localUri;
    if (baseName(localUri) !== wanted) {
      staging = new Directory(Paths.cache, STAGING, String(fileId));
      if (staging.exists) staging.delete();
      staging.create({ intermediates: true });
      const copy = new File(staging, wanted);
      await new File(localUri).copy(copy);
      source = copy.uri;
    }
    await Asset.create(source);
    return { ok: true, value: undefined };
  } catch (error) {
    return {
      ok: false,
      error: { kind: "failed", code: codeOf(error, "SAVE_FAILED") },
    };
  } finally {
    try {
      if (staging?.exists) staging.delete();
    } catch {
      // The cache folder is the system's to clean. The save result is the one to show.
    }
  }
}
