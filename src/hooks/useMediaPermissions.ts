import { useCallback, useState } from "react";

import { getSaveAccess, requestSaveAccess } from "@/media/gallery";
import type { MediaAccess } from "@/types/domain";

// Gallery access for the 08 Download and the viewer Save. Android asks only after a tap of the
// user (spec §6.5), never when a screen opens. On Android 11+ a save needs no prompt, so most
// users never see one. The upload picker (Phase 9) adds read access here.

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

  return { access, notice: noticeOf(access, action), ensureSave };
}
