import { act, renderHook } from "@testing-library/react-native";

import { useDownloadBadge, useDownloads } from "@/hooks/useDownloads";
import { fetchFile, watchFiles } from "@/index/sync";
import {
  addDownloads,
  pauseDownload,
  resetDownloadsForTests,
} from "@/transfer/downloads";
import type { FileProgress, FolderFile, ServiceResult } from "@/types/domain";

jest.mock("@/index/sync", () => ({
  fetchFile: jest.fn(),
  stopFile: jest.fn(() => Promise.resolve({ ok: true, value: undefined })),
  watchFiles: jest.fn(),
}));

const fetch = fetchFile as jest.Mock;
const watch = watchFiles as jest.Mock;

const MB = 1024 ** 2;
const file = (fileId: number, size = 10 * MB): FolderFile => ({
  messageId: fileId * 10,
  dirPath: "Goa 2024",
  name: `IMG_${fileId}.jpg`,
  date: 1,
  size,
  mimeType: "image/jpeg",
  kind: "photo",
  fileId,
  localUri: null,
  thumbnailFileId: null,
  thumbnailUri: null,
  placeholderUri: null,
});

const pending = new Map<number, (r: ServiceResult<string>) => void>();
let push: (fileId: number, progress: FileProgress) => void;

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  resetDownloadsForTests();
  pending.clear();
  fetch.mockReset().mockImplementation(
    (fileId: number) =>
      new Promise<ServiceResult<string>>((resolve) => {
        pending.set(fileId, resolve);
      }),
  );
  watch.mockReset().mockImplementation((h: typeof push) => {
    push = h;
    return () => {};
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useDownloads", () => {
  it("is empty with no download", async () => {
    const { result } = await renderHook(() => useDownloads());
    expect(result.current.empty).toBe(true);
    expect(result.current.rows).toEqual([]);
    expect(result.current.summary).toBe("");
  });

  it("gives the 12 summary and the text of each row", async () => {
    const { result } = await renderHook(() => useDownloads());
    await act(() => {
      addDownloads([1, 2, 3, 4, 5, 6].map((id) => file(id)));
      pauseDownload(6);
    });
    expect(result.current.summary).toBe("4 downloading · 1 queued · 1 paused");
    const detail = (fileId: number) =>
      result.current.rows.find((r) => r.fileId === fileId)?.detail;
    expect(detail(1)).toBe("0 B of 10 MB");
    expect(detail(5)).toBe("Queued · 10 MB");
    expect(detail(6)).toBe("Paused · 0 B of 10 MB");

    await act(() => {
      push(1, { downloaded: 1 * MB, size: 10 * MB, localUri: null });
      jest.setSystemTime(1000);
      push(1, { downloaded: 3.1 * MB, size: 10 * MB, localUri: null });
      jest.advanceTimersByTime(250);
    });
    expect(detail(1)).toBe("3.1 MB of 10 MB · 2.1 MB/s");
    expect(result.current.hint).toBe("4 files download in parallel");
  });

  it("shows a rate limit with warn tones and the wait time", async () => {
    const { result } = await renderHook(() => useDownloads());
    await act(async () => {
      addDownloads([file(1)]);
      pending.get(1)?.({
        ok: false,
        error: { kind: "rate_limited", code: "FLOOD_WAIT_30", retryAfter: 30 },
      });
    });
    expect(result.current.summary).toBe("1 failed");
    expect(result.current.rows[0]).toMatchObject({
      status: "failed",
      detail: "Telegram asks the app to wait 30 s. Then try again.",
      detailTone: "warn",
    });
  });

  it("shows another error with danger tones", async () => {
    const { result } = await renderHook(() => useDownloads());
    await act(async () => {
      addDownloads([file(1, 0)]);
      pending.get(1)?.({
        ok: false,
        error: { kind: "failed", code: "FILE_ID_INVALID" },
      });
    });
    expect(result.current.rows[0]).toMatchObject({
      detail: "Not downloaded (FILE_ID_INVALID). Try again.",
      detailTone: "danger",
    });
  });
});

describe("useDownloadBadge", () => {
  it("counts the files that download now, and 0 when they are complete", async () => {
    const { result } = await renderHook(() => useDownloadBadge());
    expect(result.current).toBe(0);
    await act(() => {
      addDownloads([1, 2, 3, 4, 5].map((id) => file(id)));
    });
    // The fifth file is queued.
    expect(result.current).toBe(4);
    await act(() => pauseDownload(1));
    expect(result.current).toBe(4);
    await act(async () => {
      [2, 3, 4, 5].forEach((id) =>
        pending.get(id)?.({ ok: true, value: `file:///td/${id}` }),
      );
    });
    expect(result.current).toBe(0);
  });
});
