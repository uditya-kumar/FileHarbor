import { useCallback, useState } from "react";

import {
  getReadAccess,
  getSaveAccess,
  requestReadAccess,
  requestSaveAccess,
} from "@/media/gallery";
import type { MediaAccess } from "@/types/domain";

// Gallery access for the 08 Download and the viewer Save. Android asks only after a tap of the
// user (spec §6.5), never when a screen opens. On Android 11+ a save needs no prompt, so most
// users never see one. The 07 upload asks for read access, so it can read the real file name.

/** The text when the app cannot save. null: it can, or it did not ask yet. */
function noticeOf(access: MediaAccess | null, action: string): string | null {
  switch (access) {
    case "denied":
      return `No access to the gallery. Tap ${action} again, then allow it.`;
    case "blocked":
      return "No access to the gallery. Allow it for FileHarbor in Android Settings.";
    default:
      return null;
  }
}

/** @param action The button that saves, for the notice: "Download" (08) or "Save" (viewer). */
export function useMediaPermissions(action: string) {
  const [access, setAccess] = useState<MediaAccess | null>(null);

  /** Asks for access if the app does not have it. True: the app can save. */
  const ensureSave = useCallback(async (): Promise<boolean> => {
    let next = await getSaveAccess();
    if (next === "undetermined" || next === "denied")
      next = await requestSaveAccess();
    setAccess(next);
    return next === "granted";
  }, []);

  /**
   * Asks for read access before the upload picker opens. True: the app can read the real file
   * name. With no access the upload still works, with the picker name, so there is no notice.
   */
  const ensureRead = useCallback(async (): Promise<boolean> => {
    let next = await getReadAccess();
    if (next === "undetermined" || next === "denied")
      next = await requestReadAccess();
    return next === "granted";
  }, []);

  return { access, notice: noticeOf(access, action), ensureSave, ensureRead };
}
