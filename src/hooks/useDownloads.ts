import { useMemo, useSyncExternalStore } from "react";

import { formatBytes } from "@/format/units";
import {
  getDownloads,
  MAX_PARALLEL_DOWNLOADS,
  pauseDownload,
  removeDownloads,
  resumeDownload,
  subscribeDownloads,
} from "@/transfer/downloads";
import type { DownloadItem, DownloadStatus, MediaKind } from "@/types/domain";

// The Downloads list (12, 14), the Downloads tab badge, and the item of one file (the viewer
// Save). The list is in src/transfer/downloads.ts; this hook makes its display text.

/** One row of 12. */
export type DownloadRow = {
  key: string;
  fileId: number;
  name: string;
  kind: MediaKind;
  thumbnailUri: string | null;
  placeholderUri: string | null;
  status: DownloadStatus;
  /** E.g. "12.4 MB of 51.8 MB · 2.1 MB/s", "Paused · 24.1 MB of 88.2 MB", "Queued · 1.2 MB". */
  detail: string;
  /** A rate limit shows with warn tones, never danger (CLAUDE.md §6). */
  detailTone: "normal" | "warn" | "danger";
  /** In the 14 selection. A new value makes the list draw the row again. */
  selected: boolean;
};

function amount(item: DownloadItem): string {
  return item.size > 0
    ? `${formatBytes(item.downloaded)} of ${formatBytes(item.size)}`
    : formatBytes(item.downloaded);
}

function detailOf(
  item: DownloadItem,
): Pick<DownloadRow, "detail" | "detailTone"> {
  switch (item.status) {
    case "downloading":
      return {
        detail:
          item.bytesPerSecond === null
            ? amount(item)
            : `${amount(item)} · ${formatBytes(item.bytesPerSecond)}/s`,
        detailTone: "normal",
      };
    case "paused":
      return { detail: `Paused · ${amount(item)}`, detailTone: "normal" };
    case "queued":
      return {
        detail: item.size > 0 ? `Queued · ${formatBytes(item.size)}` : "Queued",
        detailTone: "normal",
      };
    case "saving":
      return { detail: "Saving to the gallery", detailTone: "normal" };
    case "failed": {
      const error = item.error;
      if (item.errorStep === "save")
        return {
          detail: `Not saved to the gallery (${error?.code ?? "UNKNOWN"}). Try again.`,
          detailTone: "danger",
        };
      if (error?.kind === "rate_limited")
        return {
          detail: `Telegram asks the app to wait ${error.retryAfter ?? 0} s. Then try again.`,
          detailTone: "warn",
        };
      if (error?.kind === "unavailable")
        return { detail: "Telegram is not connected.", detailTone: "danger" };
      return {
        detail: `Not downloaded (${error?.code ?? "UNKNOWN"}). Try again.`,
        detailTone: "danger",
      };
    }
  }
}

function toRow(
  item: DownloadItem,
  selected: ReadonlySet<string> | null,
): DownloadRow {
  return {
    key: String(item.fileId),
    fileId: item.fileId,
    name: item.name,
    kind: item.kind,
    thumbnailUri: item.thumbnailUri,
    placeholderUri: item.placeholderUri,
    status: item.status,
    ...detailOf(item),
    selected: selected?.has(String(item.fileId)) ?? false,
  };
}

const ORDER: readonly DownloadStatus[] = [
  "downloading",
  "saving",
  "queued",
  "paused",
  "failed",
];

/** "3 downloading · 2 queued". The statuses with no file are not in the text. */
function summaryOf(items: readonly DownloadItem[]): string {
  return ORDER.map((status) => {
    const n = items.filter((i) => i.status === status).length;
    return n > 0 ? `${n} ${status}` : null;
  })
    .filter((part) => part !== null)
    .join(" · ");
}

/** The 14 header and summary for the selected rows. */
export type DownloadSelection = {
  /** "2 selected" */
  title: string;
  /** "5 transfers · 2 selected" */
  summary: string;
  hint: string;
  /** The selected files that are still in the list. A completed file leaves the selection. */
  fileIds: readonly number[];
};

function selectionOf(rows: readonly DownloadRow[]): DownloadSelection {
  const fileIds = rows.filter((r) => r.selected).map((r) => r.fileId);
  const transfers =
    rows.length === 1 ? "1 transfer" : `${rows.length} transfers`;
  return {
    title: `${fileIds.length} selected`,
    summary: `${transfers} · ${fileIds.length} selected`,
    // The design deletes from Telegram. That is a Telegram write, so it waits for the trash
    // (Phase 8). Remove stops the download only.
    hint: "Tap to toggle · Remove stops the download. The file stays in Telegram.",
    fileIds,
  };
}

function downloadingCount(): number {
  return getDownloads().filter((i) => i.status === "downloading").length;
}

/** `selected`: the selected row keys in 14, or null when 12 is not in selection mode. */
export function useDownloads(selected: ReadonlySet<string> | null = null) {
  const items = useSyncExternalStore(subscribeDownloads, getDownloads);
  const rows = useMemo(
    () => items.map((item) => toRow(item, selected)),
    [items, selected],
  );
  const summary = useMemo(() => summaryOf(items), [items]);
  const selection = useMemo(
    () => (selected ? selectionOf(rows) : null),
    [rows, selected],
  );

  return {
    rows,
    summary,
    hint: `${MAX_PARALLEL_DOWNLOADS} files download in parallel · Long-press a file to select it`,
    empty: items.length === 0,
    selection,
    pause: pauseDownload,
    resume: resumeDownload,
    remove: removeDownloads,
  };
}

/**
 * The Downloads tab badge: the files that download now (the design shows "3" for
 * "3 downloading · 2 queued"). 0 hides the badge. A progress change does not re-render.
 */
export function useDownloadBadge(): number {
  return useSyncExternalStore(subscribeDownloads, downloadingCount);
}

/**
 * The Downloads item of one file, or null when the file is not in the list. The item keeps
 * its object while another file changes, so only a change of this file re-renders.
 */
export function useDownloadItem(fileId: number | null): DownloadItem | null {
  return useSyncExternalStore(subscribeDownloads, () =>
    fileId === null
      ? null
      : (getDownloads().find((i) => i.fileId === fileId) ?? null),
  );
}
