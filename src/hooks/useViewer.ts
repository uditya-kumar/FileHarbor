import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatBytes, formatDate } from "@/format/units";
import { useDownloadItem } from "@/hooks/useDownloads";
import { noticeFor } from "@/hooks/useFolderContents";
import { loadFolderFiles, loadThumbnail, viewFile } from "@/index/sync";
import {
  addDownloads,
  isInDownloads,
  resumeDownload,
} from "@/transfer/downloads";
import type {
  DownloadItem,
  FileProgress,
  FolderFile,
  ServiceError,
} from "@/types/domain";

// Screen state for the viewer (09 photo, 10 video). It pages through the photos and videos of
// one folder, in the 07 order. The open file downloads at the highest priority; the pages near
// it show their thumbnails until then (spec §8.1). Save puts the open file in the Downloads
// list, the same path as the 08 Download: the list saves it in the gallery (task 7.16).

export type ViewerPageData = {
  /** The message id as a string. */
  key: string;
  kind: "photo" | "video";
  /** The full photo when it is on the device, else the thumbnail. A video: its poster. */
  imageUri: string | null;
  placeholderUri: string | null;
  accessibilityLabel: string;
};

export type ViewerStripItem = {
  key: string;
  imageUri: string | null;
  placeholderUri: string | null;
  accessibilityLabel: string;
};

/** The open file. */
export type ViewerOpen = {
  key: string;
  kind: "photo" | "video";
  name: string;
  /**
   * 09 "12 Aug 2024 · 8.4 MB", with the download progress while the full photo loads, or the
   * save state ("… · Saving… 42%", "… · Saved to the gallery").
   */
  meta: string;
  /** The video poster (10). */
  posterUri: string | null;
  /** The video file, when the whole file is on the device. null for a photo. */
  videoUri: string | null;
  /** 10 line over the scrubber while the video downloads or saves. */
  downloadText?: string;
};

/** The open file in the gallery save: not asked, in the Downloads list, done, or failed. */
type SaveState =
  | { step: "none" }
  | { step: "saving" | "paused"; item: DownloadItem }
  | { step: "failed"; item: DownloadItem }
  | { step: "saved" };

export type ViewerStatus =
  | "loading"
  | "ready"
  /** The file is not in this folder now (deleted, moved, or not a photo or video). */
  | "missing"
  | "error";

type ViewerMedia = FolderFile & { kind: "photo" | "video" };

/** Thumbnails load for the open page and this many on each side: the filmstrip shows them. */
const NEAR = 4;

const isMedia = (f: FolderFile): f is ViewerMedia =>
  f.kind === "photo" || f.kind === "video";

const percentOf = (p: FileProgress): number =>
  p.size > 0 ? Math.min(100, Math.floor((p.downloaded / p.size) * 100)) : 0;

/** The 07 text, but for one file. */
function noticeText(error: ServiceError): string {
  return error.kind === "failed"
    ? `The file did not load (${error.code}).`
    : noticeFor(error).text;
}

function saveStateOf(item: DownloadItem | null, asked: boolean): SaveState {
  if (item?.status === "failed") return { step: "failed", item };
  if (item?.status === "paused") return { step: "paused", item };
  if (item) return { step: "saving", item };
  // A file that leaves the list with no error is in the gallery.
  return asked ? { step: "saved" } : { step: "none" };
}

/** The save line, or null when the user did not save the file. */
function saveText(save: SaveState, percent: number | null): string | null {
  switch (save.step) {
    case "none":
      return null;
    case "saved":
      return "Saved to the gallery";
    case "paused":
      return "Paused in Downloads";
    case "saving":
      return percent !== null && save.item.status === "downloading"
        ? `Saving… ${percent}%`
        : "Saving…";
    case "failed": {
      const error = save.item.error;
      if (error?.kind === "rate_limited") return noticeFor(error).text;
      return `Not saved (${error?.code ?? "UNKNOWN"}). Tap Save again.`;
    }
  }
}

function labelOf(f: ViewerMedia): string {
  return `${f.kind === "photo" ? "Photo" : "Video"}, ${f.name}`;
}

/**
 * @param dirPath The folder from the route, e.g. "Holiday/Beach".
 * @param messageId The file that the user opened in 07.
 */
export function useViewer(dirPath: string, messageId: number) {
  const [files, setFiles] = useState<ViewerMedia[] | null>(null);
  const [loadError, setLoadError] = useState<ServiceError | null>(null);
  const [index, setIndex] = useState(0);
  const [thumbs, setThumbs] = useState<ReadonlyMap<number, string>>(
    () => new Map(),
  );
  /** Files that downloaded while the viewer is open: message id → file:// URI. */
  const [local, setLocal] = useState<ReadonlyMap<number, string>>(
    () => new Map(),
  );
  /** The open download. The file id keeps a value from showing on the next page. */
  const [download, setDownload] = useState<{
    fileId: number;
    progress: FileProgress | null;
    error: ServiceError | null;
  } | null>(null);
  /** Files that the user saved from this viewer: file ids. */
  const [saveAsked, setSaveAsked] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [chromeVisible, setChromeVisible] = useState(true);
  const mounted = useRef(true);
  const requested = useRef(new Set<number>());

  useEffect(() => {
    mounted.current = true;
    void loadFolderFiles(dirPath).then((res) => {
      if (!mounted.current) return;
      if (!res.ok) {
        setLoadError(res.error);
        return;
      }
      const media = res.value.filter(isMedia);
      setFiles(media);
      setIndex(
        Math.max(
          0,
          media.findIndex((f) => f.messageId === messageId),
        ),
      );
    });
    return () => {
      mounted.current = false;
    };
  }, [dirPath, messageId]);

  const all = useMemo(() => files ?? [], [files]);
  const open = all[index];
  const found = all.some((f) => f.messageId === messageId);

  // Thumbnails near the open page (spec §8.1: never the originals for these).
  useEffect(() => {
    for (let i = index - NEAR; i <= index + NEAR; i++) {
      const f = all[i];
      if (
        !f ||
        f.thumbnailUri ||
        f.thumbnailFileId === null ||
        requested.current.has(f.messageId)
      )
        continue;
      requested.current.add(f.messageId);
      const id = f.messageId;
      void loadThumbnail(f.thumbnailFileId).then((res) => {
        if (!mounted.current || !res.ok) return;
        setThumbs((prev) => new Map(prev).set(id, res.value));
      });
    }
  }, [all, index]);

  // The whole open file. Leaving the page stops a download that the viewer started, but not
  // a file in the Downloads tab.
  const openId = open?.messageId;
  const openFileId = open?.fileId;
  const openDone =
    open?.localUri != null || (openId != null && local.has(openId));
  useEffect(() => {
    if (openId == null || openFileId == null || openDone) return;
    return viewFile(
      openFileId,
      (progress) => {
        setDownload({ fileId: openFileId, progress, error: null });
        if (progress.localUri) {
          const uri = progress.localUri;
          setLocal((prev) => new Map(prev).set(openId, uri));
        }
      },
      (error) =>
        setDownload((prev) => ({
          fileId: openFileId,
          progress: prev?.fileId === openFileId ? prev.progress : null,
          error,
        })),
      isInDownloads,
    );
    // openDone is read once per file: a file that completes keeps its URI in `local`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, openFileId]);
  const openItem = useDownloadItem(openFileId ?? null);
  const save = saveStateOf(
    openItem,
    openFileId != null && saveAsked.has(openFileId),
  );
  const current = download?.fileId === openFileId ? download : null;
  const progress = current?.progress ?? null;
  const fileError = current?.error ?? null;

  const thumbOf = useCallback(
    (f: ViewerMedia): string | null =>
      thumbs.get(f.messageId) ?? f.thumbnailUri,
    [thumbs],
  );
  const localOf = useCallback(
    (f: ViewerMedia): string | null => local.get(f.messageId) ?? f.localUri,
    [local],
  );

  const pages: ViewerPageData[] = useMemo(
    () =>
      all.map((f) => ({
        key: String(f.messageId),
        kind: f.kind,
        imageUri: f.kind === "photo" ? (localOf(f) ?? thumbOf(f)) : thumbOf(f),
        placeholderUri: f.placeholderUri,
        accessibilityLabel: labelOf(f),
      })),
    [all, localOf, thumbOf],
  );

  const strip: ViewerStripItem[] = useMemo(
    () =>
      all.map((f) => ({
        key: String(f.messageId),
        imageUri: thumbOf(f),
        placeholderUri: f.placeholderUri,
        accessibilityLabel: labelOf(f),
      })),
    [all, thumbOf],
  );

  const notice = fileError ? noticeText(fileError) : null;

  let openInfo: ViewerOpen | null = null;
  if (open) {
    const uri = localOf(open);
    const percent = !uri && progress ? percentOf(progress) : null;
    const downloading = percent !== null ? `Downloading ${percent}%` : null;
    const saving = saveText(save, percent);
    const base = `${formatDate(open.date)} · ${formatBytes(open.size)}`;
    // A save error is long: it takes the whole line.
    let meta = base;
    if (saving) meta = save.step === "failed" ? saving : `${base} · ${saving}`;
    else if (downloading) meta = `${base} · ${downloading}`;
    openInfo = {
      key: String(open.messageId),
      kind: open.kind,
      name: open.name,
      meta: notice ?? meta,
      posterUri: thumbOf(open),
      videoUri: open.kind === "video" ? uri : null,
      downloadText:
        open.kind !== "video"
          ? undefined
          : (notice ??
            saving ??
            (uri
              ? undefined
              : `${downloading ?? "Downloading"} · from Telegram`)),
    };
  }

  /**
   * Saves the open file in the gallery. null: the file saves now or is saved (Save shows
   * disabled). A paused or failed file starts again in the Downloads list.
   */
  const saveOpen =
    open &&
    (save.step === "none" || save.step === "paused" || save.step === "failed")
      ? (): void => {
          setSaveAsked((prev) => new Set(prev).add(open.fileId));
          if (save.step === "none") addDownloads([open]);
          else resumeDownload(open.fileId);
        }
      : null;

  const status: ViewerStatus = loadError
    ? "error"
    : files === null
      ? "loading"
      : found
        ? "ready"
        : "missing";

  const select = useCallback(
    (key: string): void => {
      const i = all.findIndex((f) => String(f.messageId) === key);
      if (i >= 0) setIndex(i);
    },
    [all],
  );

  return {
    status,
    /** "The file did not load (…)" for the error state. */
    errorText: loadError ? noticeText(loadError) : null,
    /** 09/10 header: "3 of 148". */
    title: open ? `${index + 1} of ${all.length}` : "",
    pages,
    strip,
    index,
    open: openInfo,
    setIndex,
    select,
    save: saveOpen,
    chromeVisible,
    toggleChrome: useCallback(() => setChromeVisible((v) => !v), []),
  };
}
