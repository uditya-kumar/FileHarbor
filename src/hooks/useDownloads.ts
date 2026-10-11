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

// The Downloads list (12, 14) and the Downloads tab badge. The list is in
// src/transfer/downloads.ts; this hook makes its display text.

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
    case "failed": {
      const error = item.error;
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

function toRow(item: DownloadItem): DownloadRow {
  return {
    key: String(item.fileId),
    fileId: item.fileId,
    name: item.name,
    kind: item.kind,
    thumbnailUri: item.thumbnailUri,
    placeholderUri: item.placeholderUri,
    status: item.status,
    ...detailOf(item),
  };
}

const ORDER: readonly DownloadStatus[] = [
  "downloading",
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

function downloadingCount(): number {
  return getDownloads().filter((i) => i.status === "downloading").length;
}

export function useDownloads() {
  const items = useSyncExternalStore(subscribeDownloads, getDownloads);
  const rows = useMemo(() => items.map(toRow), [items]);
  const summary = useMemo(() => summaryOf(items), [items]);

  return {
    rows,
    summary,
    hint: `${MAX_PARALLEL_DOWNLOADS} files download in parallel`,
    empty: items.length === 0,
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
