import { Directory, File, FileMode } from "expo-file-system";

import type { SaveFolder, ServiceError, ServiceResult } from "@/types/domain";

// Saves a downloaded file in a folder that the user picks (sheet 11). A document that is not a
// photo or a video cannot go into the media library, so it goes through the Android folder
// picker (Storage Access Framework). The file is already on the device in the TDLib cache
// (spec §4.3): this is a local copy, not a Telegram transfer.

/** Bytes for each read and write. Small enough to keep the JS thread free between parts. */
const COPY_PART = 1024 * 1024;

/** expo-modules-core gives this code to its PickerCancelledException. */
const PICKER_CANCELLED = "ERR_PICKER_CANCELLED";

function codeOf(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" && code) return code;
  }
  return fallback;
}

const failed = (code: string): ServiceError => ({ kind: "failed", code });

/** Opens the folder picker. null: the user closed it. */
export async function pickSaveFolder(): Promise<
  ServiceResult<SaveFolder | null>
> {
  try {
    const dir = await Directory.pickDirectoryAsync();
    return { ok: true, value: { uri: dir.uri, name: dir.name } };
  } catch (error) {
    const code = codeOf(error, "PICK_FAILED");
    return code === PICKER_CANCELLED
      ? { ok: true, value: null }
      : { ok: false, error: failed(code) };
  }
}

/**
 * Copies a file:// file into the picked folder with the caption name. The folder gives a new
 * name ("Notes (1).pdf") when that name is in use, so no file is overwritten.
 */
export async function copyToFolder(
  localUri: string,
  folder: SaveFolder,
  name: string,
  mimeType: string,
): Promise<ServiceResult<void>> {
  let target: File | null = null;
  try {
    target = new Directory(folder.uri).createFile(name, mimeType || null);
    // File.copy() into a picked folder takes the TDLib file name, not the caption name. A copy
    // onto `target` with overwrite deletes it first. So copy the bytes.
    const from = new File(localUri).open(FileMode.ReadOnly);
    const to = target.open(FileMode.WriteOnly);
    try {
      for (;;) {
        const part = from.readBytes(COPY_PART);
        if (part.length === 0) break;
        to.writeBytes(part);
        // Let the sheet render its state between parts.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      from.close();
      to.close();
    }
    return { ok: true, value: undefined };
  } catch (error) {
    // Do not leave a part file in the user's folder.
    try {
      target?.delete();
    } catch {
      // The copy error is the one to show.
    }
    return { ok: false, error: failed(codeOf(error, "SAVE_FAILED")) };
  }
}
