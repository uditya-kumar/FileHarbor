import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { dirSegments } from "@/format/caption";
import { formatBytes, plural } from "@/format/units";
import { loadFolderFiles, loadThumbnail, syncIndex } from "@/index/sync";
import type {
  FolderFile,
  MediaKind,
  ServiceError,
  ServiceResult,
} from "@/types/domain";

// Screen state for 07. The file list comes from dir_index; the file data and the thumbnails
// come from TDLib. A thumbnail downloads only when its cell is on screen (spec §8.1).

export type FolderCell = {
  /** The message id as a string: it is the list key and the expo-image recyclingKey. */
  key: string;
  title: string;
  imageUri: string | null;
  placeholderUri: string | null;
  isVideo: boolean;
  accessibilityLabel: string;
  /** Set only during selection (08). */
  selected?: boolean;
};

/** 08 text for the selected files that are still in this folder. */
export type FolderSelection = {
  count: number;
  /** Header title, "6 selected". */
  title: string;
  /** "412 MB selected", in place of the 07 summary. */
  summary: string;
  downloadLabel: string;
  allSelected: boolean;
  /** The files to act on, in grid order. */
  files: FolderFile[];
};

export type FolderContentsNotice = {
  kind: "rate_limited" | "failed";
  text: string;
};

export type FolderContentsStatus =
  | "loading"
  | "grid"
  /** The folder has no file yet (a new folder, spec §1). */
  | "empty"
  /** The first load failed, so there is nothing to show. */
  | "error";

const KIND_LABEL: Record<MediaKind, string> = {
  photo: "Photo",
  video: "Video",
  other: "File",
};

function noticeFor(error: ServiceError): FolderContentsNotice {
  switch (error.kind) {
    case "rate_limited":
      return {
        kind: "rate_limited",
        text: `Telegram asks the app to wait ${error.retryAfter ?? 0} s. Then try again.`,
      };
    case "unavailable":
      return { kind: "failed", text: "Telegram is not connected." };
    case "failed":
      return {
        kind: "failed",
        text: `The files did not load (${error.code}).`,
      };
  }
}

function toCell(
  file: FolderFile,
  thumbs: ReadonlyMap<number, string>,
  selected: ReadonlySet<string> | null,
): FolderCell {
  const key = String(file.messageId);
  // A video file cannot show in expo-image, so a video without a thumbnail shows the
  // minithumbnail or the file name only.
  const imageUri =
    thumbs.get(file.messageId) ??
    file.thumbnailUri ??
    (file.kind === "photo" ? file.localUri : null);
  return {
    key,
    title: file.name,
    imageUri,
    placeholderUri: file.placeholderUri,
    isVideo: file.kind === "video",
    accessibilityLabel: `${KIND_LABEL[file.kind]}, ${file.name}`,
    selected: selected ? selected.has(key) : undefined,
  };
}

function selectionOf(
  files: readonly FolderFile[],
  selected: ReadonlySet<string>,
): FolderSelection {
  // A refresh can remove a selected file, so count only the files that are still here.
  const chosen = files.filter((f) => selected.has(String(f.messageId)));
  const size = chosen.reduce((sum, f) => sum + f.size, 0);
  return {
    count: chosen.length,
    title: `${chosen.length} selected`,
    summary: `${formatBytes(size)} selected`,
    downloadLabel:
      chosen.length === 0
        ? "Download"
        : `Download ${plural(chosen.length, "item", "items")}`,
    allSelected: files.length > 0 && chosen.length === files.length,
    files: chosen,
  };
}

/**
 * @param selected The selected cell keys during selection (08), or null.
 */
export function useFolderContents(
  dirPath: string,
  selected: ReadonlySet<string> | null = null,
) {
  const [files, setFiles] = useState<FolderFile[] | null>(null);
  const [thumbs, setThumbs] = useState<ReadonlyMap<number, string>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [pulled, setPulled] = useState(false);
  const [notice, setNotice] = useState<FolderContentsNotice | null>(null);
  const mounted = useRef(true);
  /** Thumbnails asked for once. A failed one is not asked for again until a refresh. */
  const requested = useRef(new Set<number>());

  /** Shows the result of a folder read. */
  const apply = useCallback((result: ServiceResult<FolderFile[]>): void => {
    if (!mounted.current) return;
    if (result.ok) {
      setFiles(result.value);
      setNotice(null);
    } else {
      setNotice(noticeFor(result.error));
    }
    setLoading(false);
    setPulled(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadFolderFiles(dirPath).then(apply);
    return () => {
      mounted.current = false;
    };
  }, [dirPath, apply]);

  const byKey = useMemo(
    () => new Map((files ?? []).map((f) => [String(f.messageId), f])),
    [files],
  );

  const onVisible = useCallback(
    (keys: string[]): void => {
      for (const key of keys) {
        const file = byKey.get(key);
        if (
          !file ||
          file.thumbnailUri ||
          file.thumbnailFileId === null ||
          requested.current.has(file.messageId)
        )
          continue;
        requested.current.add(file.messageId);
        void loadThumbnail(file.thumbnailFileId).then((res) => {
          if (!mounted.current || !res.ok) return;
          setThumbs((prev) => new Map(prev).set(file.messageId, res.value));
        });
      }
    },
    [byKey],
  );

  /** Reads all captions again (a file may have moved here), then this folder. */
  const refresh = useCallback((): void => {
    setPulled(true);
    requested.current.clear();
    void syncIndex().then(async (report) => {
      if (!mounted.current) return;
      if (!report.ok) {
        setNotice(noticeFor(report.error));
        setPulled(false);
        return;
      }
      apply(await loadFolderFiles(dirPath));
    });
  }, [dirPath, apply]);

  const all = files ?? [];
  const totalSize = all.reduce((sum, f) => sum + f.size, 0);
  const status: FolderContentsStatus =
    all.length > 0
      ? "grid"
      : loading
        ? "loading"
        : files === null
          ? "error"
          : "empty";

  return {
    status,
    /** 07 header: the last folder name of the path. */
    title: dirSegments(dirPath).at(-1) ?? "Files",
    cells: all.map((f) => toCell(f, thumbs, selected)),
    keys: all.map((f) => String(f.messageId)),
    selection: selected ? selectionOf(all, selected) : null,
    /** 07 "148 items · 2.4 GB". */
    summary: `${plural(all.length, "item", "items")} · ${formatBytes(totalSize)}`,
    notice,
    refreshing: pulled,
    onVisible,
    refresh,
  };
}
