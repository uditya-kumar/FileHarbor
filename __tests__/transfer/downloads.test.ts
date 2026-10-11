import { fetchFile, stopFile, watchFiles } from "@/index/sync";
import {
  addDownloads,
  getDownloads,
  isInDownloads,
  MAX_PARALLEL_DOWNLOADS,
  pauseDownload,
  removeDownloads,
  resetDownloadsForTests,
  resumeDownload,
  subscribeDownloads,
} from "@/transfer/downloads";
import type { FileProgress, FolderFile, ServiceResult } from "@/types/domain";

jest.mock("@/index/sync", () => ({
  fetchFile: jest.fn(),
  stopFile: jest.fn(),
  watchFiles: jest.fn(),
}));

const fetch = fetchFile as jest.Mock;
const stop = stopFile as jest.Mock;
const watch = watchFiles as jest.Mock;

const MB = 1024 ** 2;
const file = (fileId: number, over: Partial<FolderFile> = {}): FolderFile => ({
  messageId: fileId * 10,
  dirPath: "Goa 2024",
  name: `IMG_${fileId}.jpg`,
  date: 1,
  size: 10 * MB,
  mimeType: "image/jpeg",
  kind: "photo",
  fileId,
  localUri: null,
  thumbnailFileId: null,
  thumbnailUri: null,
  placeholderUri: null,
  ...over,
});

/** The open fetchFile calls. resolve() ends one, as TDLib does when the file is complete. */
const pending = new Map<number, (r: ServiceResult<string>) => void>();
let push: (fileId: number, progress: FileProgress) => void;
const unwatch = jest.fn();
const flush = () => new Promise((r) => setImmediate(r));

const statusOf = () =>
  Object.fromEntries(getDownloads().map((i) => [i.fileId, i.status]));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  resetDownloadsForTests();
  pending.clear();
  fetch.mockImplementation(
    (fileId: number) =>
      new Promise<ServiceResult<string>>((resolve) => {
        pending.set(fileId, resolve);
      }),
  );
  stop.mockResolvedValue({ ok: true, value: undefined });
  watch.mockImplementation((h: typeof push) => {
    push = h;
    return unwatch;
  });
});

describe("downloads — queue", () => {
  it(`downloads ${MAX_PARALLEL_DOWNLOADS} files at the same time, in order`, () => {
    expect(addDownloads([1, 2, 3, 4, 5, 6].map((id) => file(id)))).toBe(6);
    expect(fetch.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4]);
    expect(statusOf()).toEqual({
      1: "downloading",
      2: "downloading",
      3: "downloading",
      4: "downloading",
      5: "queued",
      6: "queued",
    });
    expect(watch).toHaveBeenCalledTimes(1);
  });

  it("does not add a file on the device or a file in the list", () => {
    addDownloads([file(1)]);
    expect(
      addDownloads([file(1), file(2, { localUri: "file:///td/2.jpg" })]),
    ).toBe(0);
    expect(getDownloads()).toHaveLength(1);
    expect(isInDownloads(1)).toBe(true);
    expect(isInDownloads(2)).toBe(false);
  });

  it("takes a complete file out and starts the next one", async () => {
    addDownloads([1, 2, 3, 4, 5].map((id) => file(id)));
    pending.get(2)?.({ ok: true, value: "file:///td/2.jpg" });
    await flush();
    expect(isInDownloads(2)).toBe(false);
    expect(fetch).toHaveBeenLastCalledWith(5);
    expect(statusOf()[5]).toBe("downloading");
  });

  it("takes a file out when updateFile says it is complete (the viewer downloaded it)", () => {
    addDownloads([file(1), file(2)]);
    push(1, { downloaded: 10 * MB, size: 10 * MB, localUri: "file:///td/1" });
    expect(isInDownloads(1)).toBe(false);
    expect(isInDownloads(2)).toBe(true);
  });

  it("stops watching updateFile when the list is empty", async () => {
    addDownloads([file(1)]);
    pending.get(1)?.({ ok: true, value: "file:///td/1.jpg" });
    await flush();
    expect(getDownloads()).toHaveLength(0);
    expect(unwatch).toHaveBeenCalled();
  });

  it("keeps a failed file with its error, and starts the next one", async () => {
    addDownloads([1, 2, 3, 4, 5].map((id) => file(id)));
    pending.get(1)?.({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_30", retryAfter: 30 },
    });
    await flush();
    const failed = getDownloads().find((i) => i.fileId === 1);
    expect(failed?.status).toBe("failed");
    expect(failed?.error?.kind).toBe("rate_limited");
    expect(statusOf()[5]).toBe("downloading");
  });
});

describe("downloads — pause, resume, remove", () => {
  it("pauses a running file, cancels it in TDLib, and starts the next one", () => {
    addDownloads([1, 2, 3, 4, 5].map((id) => file(id)));
    pauseDownload(1);
    expect(stop).toHaveBeenCalledWith(1);
    expect(statusOf()[1]).toBe("paused");
    expect(statusOf()[5]).toBe("downloading");
  });

  it("ignores the result of a paused download", async () => {
    addDownloads([file(1)]);
    pauseDownload(1);
    pending.get(1)?.({
      ok: false,
      error: { kind: "failed", code: "DOWNLOAD_INCOMPLETE" },
    });
    await flush();
    expect(statusOf()[1]).toBe("paused");
  });

  it("pauses a queued file without a TDLib call", () => {
    addDownloads([1, 2, 3, 4, 5].map((id) => file(id)));
    pauseDownload(5);
    expect(stop).not.toHaveBeenCalled();
    expect(statusOf()[5]).toBe("paused");
  });

  it("resumes a paused file when a place is free", async () => {
    addDownloads([1, 2, 3, 4, 5].map((id) => file(id)));
    pauseDownload(5);
    resumeDownload(5);
    expect(statusOf()[5]).toBe("queued");
    pending.get(1)?.({ ok: true, value: "file:///td/1.jpg" });
    await flush();
    expect(statusOf()[5]).toBe("downloading");
  });

  it("starts a failed file again", async () => {
    addDownloads([file(1)]);
    pending.get(1)?.({ ok: false, error: { kind: "failed", code: "X" } });
    await flush();
    resumeDownload(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(getDownloads()[0]?.error).toBeNull();
    expect(statusOf()[1]).toBe("downloading");
  });

  it("removes files: it cancels the running ones only", () => {
    addDownloads([1, 2, 3, 4, 5].map((id) => file(id)));
    removeDownloads([1, 5]);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith(1);
    expect(getDownloads().map((i) => i.fileId)).toEqual([2, 3, 4]);
  });
});

describe("downloads — progress", () => {
  it("measures the speed and tells the listeners not more than 4 times a second", () => {
    jest.useFakeTimers({ now: 0 });
    const listener = jest.fn();
    subscribeDownloads(listener);
    addDownloads([file(1)]);
    expect(listener).toHaveBeenCalledTimes(1);

    push(1, { downloaded: 1 * MB, size: 10 * MB, localUri: null });
    jest.setSystemTime(500);
    push(1, { downloaded: 2 * MB, size: 10 * MB, localUri: null });
    expect(listener).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(250);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getDownloads()[0]?.downloaded).toBe(2 * MB);
    // The first measure needs 1 s.
    expect(getDownloads()[0]?.bytesPerSecond).toBeNull();

    jest.setSystemTime(1000);
    push(1, { downloaded: 3 * MB, size: 10 * MB, localUri: null });
    expect(getDownloads()[0]?.bytesPerSecond).toBe(2 * MB);
  });
});
