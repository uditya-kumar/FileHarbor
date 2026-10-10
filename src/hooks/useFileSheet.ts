import { useCallback, useEffect, useRef, useState } from "react";

import { formatBytes, formatDate } from "@/format/units";
import { noticeFor } from "@/hooks/useFolderContents";
import { loadFolderFiles, viewFile } from "@/index/sync";
import { copyToFolder, pickSaveFolder } from "@/media/saveToDevice";
import type {
  FileProgress,
  FolderFile,
  ServiceError,
  ServiceResult,
} from "@/types/domain";

// Screen state for sheet 11: a file that the app cannot show (spec §8.5). "Download to device"
// asks for a folder, downloads the file from Telegram if it is not on the device, and copies it
// into the folder. Then the user opens it with another app.

export type FileSheetNotice = {
  /**
   * "note": the 11 note. "progress": a step that runs. "saved": the copy is in the folder.
   * "rate_limited": warn tones, never danger (CLAUDE.md §6).
   */
  kind: "note" | "progress" | "saved" | "rate_limited" | "failed";
  text: string;
};

export type FileSheetStatus =
  | "loading"
  | "ready"
  /** The file is not in this folder now (deleted or moved). */
  | "missing"
  | "error";

type Phase =
  | { step: "idle" }
  | { step: "picking" }
  | { step: "downloading"; percent: number }
  | { step: "saving"; folder: string }
  | { step: "saved"; folder: string }
  | { step: "failed"; during: "download" | "save"; error: ServiceError };

const NOTE =
  "This type can't be previewed in the app. Download it, then open it with another app.";

const percentOf = (p: FileProgress): number =>
  p.size > 0 ? Math.min(100, Math.floor((p.downloaded / p.size) * 100)) : 0;

/** "PDF" from "Q3_Report_final.pdf". */
function typeOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1
    ? name.slice(dot + 1).toUpperCase()
    : "File";
}

/** 11 "4.2 MB · PDF · 12 Aug 2024". */
function detailsOf(file: FolderFile): string {
  const parts = [typeOf(file.name), formatDate(file.date)];
  if (file.size > 0) parts.unshift(formatBytes(file.size));
  return parts.join(" · ");
}

function failedText(error: ServiceError, action: string): string {
  return error.kind === "failed"
    ? `The file ${action} (${error.code}).`
    : noticeFor(error).text;
}

function noticeOf(
  status: FileSheetStatus,
  phase: Phase,
  loadError: ServiceError | null,
): FileSheetNotice {
  if (status === "loading")
    return { kind: "progress", text: "Loading the file." };
  if (status === "missing")
    return { kind: "failed", text: "This file is not here now." };
  if (loadError)
    return {
      kind: loadError.kind === "rate_limited" ? "rate_limited" : "failed",
      text: failedText(loadError, "did not load"),
    };
  switch (phase.step) {
    case "idle":
    case "picking":
      return { kind: "note", text: NOTE };
    case "downloading":
      return {
        kind: "progress",
        text: `Downloading ${phase.percent}% from Telegram.`,
      };
    case "saving":
      return { kind: "progress", text: `Saving in "${phase.folder}".` };
    case "saved":
      return {
        kind: "saved",
        text: `Saved in "${phase.folder}". Open it with another app.`,
      };
    case "failed":
      return {
        kind: phase.error.kind === "rate_limited" ? "rate_limited" : "failed",
        text: failedText(
          phase.error,
          phase.during === "download" ? "did not download" : "was not saved",
        ),
      };
  }
}

/**
 * @param dirPath The folder from the route, e.g. "Holiday/Beach".
 * @param messageId The file that the user tapped in 07.
 */
export function useFileSheet(dirPath: string, messageId: number) {
  const [file, setFile] = useState<FolderFile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<ServiceError | null>(null);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  /** The file:// URI after a download in this sheet: a second save does not download again. */
  const downloaded = useRef<string | null>(null);
  const stopDownload = useRef<(() => void) | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void loadFolderFiles(dirPath).then((res) => {
      if (!mounted.current) return;
      if (res.ok)
        setFile(res.value.find((f) => f.messageId === messageId) ?? null);
      else setLoadError(res.error);
      setLoaded(true);
    });
    return () => {
      mounted.current = false;
      // Closing the sheet stops a download that it started. The parts on the device stay.
      stopDownload.current?.();
      stopDownload.current = null;
    };
  }, [dirPath, messageId]);

  /** Downloads the whole file (spec §4.3) and gives its file:// URI. */
  const download = useCallback(
    (f: FolderFile): Promise<ServiceResult<string>> =>
      new Promise((resolve) => {
        let done = false;
        let stop: (() => void) | null = null;
        const finish = (result: ServiceResult<string>): void => {
          if (done) return;
          done = true;
          stop?.();
          stopDownload.current = null;
          resolve(result);
        };
        setPhase({ step: "downloading", percent: 0 });
        stop = viewFile(
          f.fileId,
          (progress) => {
            if (progress.localUri)
              finish({ ok: true, value: progress.localUri });
            else if (mounted.current)
              setPhase({ step: "downloading", percent: percentOf(progress) });
          },
          (error) => finish({ ok: false, error }),
        );
        stopDownload.current = stop;
      }),
    [],
  );

  const busy =
    phase.step === "picking" ||
    phase.step === "downloading" ||
    phase.step === "saving";

  const save = useCallback(async (): Promise<void> => {
    if (!file || busy) return;
    setPhase({ step: "picking" });
    const picked = await pickSaveFolder();
    if (!mounted.current) return;
    if (!picked.ok) {
      setPhase({ step: "failed", during: "save", error: picked.error });
      return;
    }
    const folder = picked.value;
    if (!folder) {
      setPhase({ step: "idle" });
      return;
    }

    let localUri = downloaded.current ?? file.localUri;
    if (!localUri) {
      const res = await download(file);
      if (!mounted.current) return;
      if (!res.ok) {
        setPhase({ step: "failed", during: "download", error: res.error });
        return;
      }
      localUri = res.value;
      downloaded.current = localUri;
    }

    setPhase({ step: "saving", folder: folder.name });
    const copied = await copyToFolder(
      localUri,
      folder,
      file.name,
      file.mimeType,
    );
    if (!mounted.current) return;
    setPhase(
      copied.ok
        ? { step: "saved", folder: folder.name }
        : { step: "failed", during: "save", error: copied.error },
    );
  }, [file, busy, download]);

  const status: FileSheetStatus = loadError
    ? "error"
    : !loaded
      ? "loading"
      : file
        ? "ready"
        : "missing";

  return {
    status,
    /** The file row: the caption name and "4.2 MB · PDF · 12 Aug 2024". */
    file: file ? { name: file.name, details: detailsOf(file) } : null,
    notice: noticeOf(status, phase, loadError),
    /** True while the picker is open, the file downloads, or the copy runs. */
    busy,
    canSave: status === "ready",
    /** "Done" after a save: the sheet has nothing more to do. */
    closeLabel: phase.step === "saved" ? "Done" : "Cancel",
    save,
  };
}
