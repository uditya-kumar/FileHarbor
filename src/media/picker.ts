import { launchImageLibraryAsync } from "expo-image-picker";

import { mediaFileName } from "@/media/gallery";
import type { ServiceResult, UploadSource } from "@/types/domain";

// The pick for a small upload (spec §2: expo-image-picker for small selections; the 600-file
// upload uses expo-media-library, spec §6). With quality 1 and no editing, the Android picker
// copies the original bytes into the app cache: no re-encode (RawImageExporter, and copyFile
// for a video, in expo-image-picker 57). TDLib reads that copy (spec §12.3).
//
// The Android photo picker hides the file name: its DISPLAY_NAME is "<media id>.<ext>"
// (device test, task 8.5). With read access, the real name comes from the media store. With
// no access, the upload keeps the picker name.

/** The last part of a URI, for a file that has no gallery name. */
function lastPart(uri: string): string {
  return decodeURIComponent(uri.split("/").pop() ?? "") || "file";
}

/** The media store id of a picked item: assetId, or the digits of a "1000159075.mp4" name. */
function mediaIdOf(
  assetId: string | null | undefined,
  fileName: string,
): string | null {
  if (assetId && /^\d+$/.test(assetId)) return assetId;
  return /^(\d+)\.[^.]+$/.exec(fileName)?.[1] ?? null;
}

/** Shows the system picker for one photo or video. null: the user closed it. */
export async function pickOneForUpload(): Promise<
  ServiceResult<UploadSource | null>
> {
  try {
    const result = await launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      // 1 keeps the original bytes. Any other value re-encodes the photo (spec §1 order 4).
      quality: 1,
      exif: false,
      base64: false,
    });
    if (result.canceled) return { ok: true, value: null };
    const asset = result.assets[0];
    if (!asset) return { ok: true, value: null };
    const kind = asset.type === "video" ? "video" : "photo";
    const pickerName = asset.fileName || lastPart(asset.uri);
    const mediaId = mediaIdOf(asset.assetId, pickerName);
    const realName = mediaId ? await mediaFileName(mediaId, kind) : null;
    return {
      ok: true,
      value: {
        uri: asset.uri,
        name: realName ?? pickerName,
        mimeType: asset.mimeType ?? "",
        size: asset.fileSize ?? 0,
        kind,
        temporary: true,
      },
    };
  } catch {
    return { ok: false, error: { kind: "failed", code: "PICK_FAILED" } };
  }
}
