import { useCallback, useEffect, useRef, useState } from "react";

import { formatBytes } from "@/format/units";
import { pickOneForUpload } from "@/media/picker";
import { uploadFile } from "@/transfer/queue";
import type { ServiceError, UploadProgress } from "@/types/domain";

// The 07 upload button: pick one photo or video, upload it to this folder, and show the state
// in a banner (spec §11 step 5: one file). Phase 9 replaces this with useUploadQueue, which
// reads the persistent queue (spec §5), and screen 13 shows the files.

export type UploadNotice = {
  text: string;
  tone: "info" | "warn" | "danger" | "success";
  icon: "upload" | "timer" | "triangle-alert" | "check";
};

type State =
  | { step: "idle" }
  | { step: "picking" }
  | { step: "uploading"; name: string; progress: UploadProgress | null }
  | { step: "done"; name: string }
  | { step: "failed"; name: string; error: ServiceError };

function errorText(error: ServiceError): string {
  switch (error.code) {
    case "BAD_NAME":
      return "This file name cannot be used. Rename the file, then upload it.";
    case "NAME_TOO_LONG":
      return "This file name is too long. Rename the file, then upload it.";
    case "PICK_FAILED":
      return "The gallery did not open. Try again.";
    default:
      return error.kind === "unavailable"
        ? "Telegram is not connected. Try again."
        : `Not uploaded (${error.code}). Try again.`;
  }
}

function noticeOf(state: State): UploadNotice | null {
  switch (state.step) {
    case "idle":
    case "picking":
      return null;
    case "uploading": {
      const p = state.progress;
      const amount =
        p && p.size > 0
          ? ` · ${formatBytes(p.uploaded)} of ${formatBytes(p.size)}`
          : "";
      return {
        text: `Uploading ${state.name}${amount}`,
        tone: "info",
        icon: "upload",
      };
    }
    case "done":
      return {
        text: `${state.name} is uploaded.`,
        tone: "success",
        icon: "check",
      };
    case "failed":
      // flood_wait uses warn, never danger: red makes users retry (CLAUDE.md §6).
      return state.error.kind === "rate_limited"
        ? {
            text: `Telegram asks the app to wait ${state.error.retryAfter ?? 0} s. Then try again.`,
            tone: "warn",
            icon: "timer",
          }
        : {
            text: errorText(state.error),
            tone: "danger",
            icon: "triangle-alert",
          };
  }
}

/**
 * @param dirPath The folder of the screen. The file goes there.
 * @param onUploaded Called when the file is in the index, so the screen reads the folder again.
 *   Pass a stable function (useCallback).
 */
export function useUpload(dirPath: string, onUploaded: () => void) {
  const [state, setState] = useState<State>({ step: "idle" });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const busy = state.step === "picking" || state.step === "uploading";

  const start = useCallback(async (): Promise<void> => {
    setState({ step: "picking" });
    const picked = await pickOneForUpload();
    if (!mounted.current) return;
    if (!picked.ok) {
      setState({ step: "failed", name: "", error: picked.error });
      return;
    }
    const source = picked.value;
    if (!source) {
      setState({ step: "idle" });
      return;
    }
    setState({ step: "uploading", name: source.name, progress: null });
    // The upload goes on when the user leaves the screen. Only the banner stops.
    const result = await uploadFile(source, dirPath, (progress) => {
      if (mounted.current)
        setState({ step: "uploading", name: source.name, progress });
    });
    if (!mounted.current) return;
    if (result.ok) {
      setState({ step: "done", name: source.name });
      onUploaded();
    } else {
      setState({ step: "failed", name: source.name, error: result.error });
    }
  }, [dirPath, onUploaded]);

  return {
    /** True while the picker is open or a file uploads: the upload button is off. */
    busy,
    notice: noticeOf(state),
    start,
  };
}
