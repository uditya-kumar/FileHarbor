import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ROOT_DIR_PATH } from "@/format/caption";
import { formatBytes, plural } from "@/format/units";
import { getChildFolders } from "@/index/db";
import { syncIndex } from "@/index/sync";
import type { FolderSummary, ServiceError } from "@/types/domain";

// Screen state for 04 / 05. The list comes from the local dir_index first, so it shows at
// once. Then a full sync reads the captions again and the list updates (spec §5).

export type FolderRow = {
  dirPath: string;
  title: string;
  subtitle: string;
  /** A folder with files and no photo or video shows a document icon (04 "Work Docs"). */
  kind: "media" | "documents";
};

export type FolderListNotice = {
  kind: "rate_limited" | "failed";
  text: string;
};

export type FolderListStatus =
  /** The first sync runs and there is nothing in the cache yet. */
  | "loading"
  | "list"
  /** 05: the account has no folder. */
  | "empty"
  /** The first sync failed and there is nothing in the cache to show. */
  | "error";

function toRow(f: FolderSummary): FolderRow {
  return {
    dirPath: f.dirPath,
    title: f.name,
    // A folder with no file is on this device only, until its first upload (spec §1).
    subtitle:
      f.fileCount === 0
        ? "No files yet"
        : `${plural(f.fileCount, "item", "items")} · ${formatBytes(f.totalSize)}`,
    kind: f.fileCount > 0 && f.mediaCount === 0 ? "documents" : "media",
  };
}

function noticeFor(error: ServiceError): FolderListNotice {
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
        text: `The folders did not update (${error.code}).`,
      };
  }
}

export function useFolderList() {
  const [folders, setFolders] = useState<FolderSummary[] | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [pulled, setPulled] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [notice, setNotice] = useState<FolderListNotice | null>(null);
  const [query, setQuery] = useState("");
  const mounted = useRef(true);

  /** Reads the cache only, e.g. after the 06 sheet adds a folder. */
  const reload = useCallback(async (): Promise<void> => {
    const result = await getChildFolders(ROOT_DIR_PATH);
    if (!mounted.current) return;
    if (result.ok) setFolders(result.value);
    else
      setNotice({
        kind: "failed",
        text: `The folders did not load (${result.message}).`,
      });
  }, []);

  /** Reads all captions again, then the cache. The caller sets `syncing` first. */
  const sync = useCallback(async (): Promise<void> => {
    const report = await syncIndex((n) => {
      if (mounted.current) setLoaded(n);
    });
    if (!mounted.current) return;
    if (report.ok) {
      setNotice(null);
      await reload();
    } else {
      setNotice(noticeFor(report.error));
    }
    if (!mounted.current) return;
    setSyncing(false);
    setPulled(false);
  }, [reload]);

  // The cache shows first: the focus effect reads it on mount, and again when the 06 sheet
  // closes after it adds a folder. The caption scan starts once, on mount.
  const reloadNow = useCallback((): void => void reload(), [reload]);
  useFocusEffect(reloadNow);
  useEffect(() => {
    mounted.current = true;
    void sync();
    return () => {
      mounted.current = false;
    };
  }, [sync]);

  const all = useMemo(() => folders ?? [], [folders]);
  const needle = query.trim().toLocaleLowerCase();
  const shown = useMemo(
    () =>
      needle
        ? all.filter((f) => f.name.toLocaleLowerCase().includes(needle))
        : all,
    [all, needle],
  );

  const status: FolderListStatus =
    all.length > 0 ? "list" : syncing ? "loading" : notice ? "error" : "empty";

  const totalSize = shown.reduce((sum, f) => sum + f.totalSize, 0);

  const refresh = useCallback((): void => {
    setPulled(true);
    setSyncing(true);
    void sync();
  }, [sync]);

  return {
    status,
    rows: shown.map(toRow),
    /** 04 "4 Folders · 14.2 GB": the folders that the search shows. */
    summary: `${plural(shown.length, "Folder", "Folders")} · ${formatBytes(totalSize)}`,
    noMatchText:
      needle && shown.length === 0
        ? `No folder name has "${query.trim()}".`
        : null,
    loadingText: `${plural(loaded, "message", "messages")} read`,
    notice,
    /** True during a sync that the user started with a pull. */
    refreshing: pulled,
    query,
    setQuery,
    refresh,
  };
}
