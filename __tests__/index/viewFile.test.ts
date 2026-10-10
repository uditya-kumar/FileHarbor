import { viewFile } from "@/index/sync";
import {
  cancelDownload,
  getFile,
  onFileUpdate,
  startPriorityDownload,
} from "@/telegram/download";
import type { TdFile } from "@/telegram/types";

jest.mock("@/index/db", () => ({}));
jest.mock("@/telegram/download", () => ({
  cancelDownload: jest.fn(),
  downloadFile: jest.fn(),
  getFile: jest.fn(),
  onFileUpdate: jest.fn(),
  startPriorityDownload: jest.fn(),
}));

const get = getFile as jest.Mock;
const start = startPriorityDownload as jest.Mock;
const cancel = cancelDownload as jest.Mock;
const watch = onFileUpdate as jest.Mock;

const td = (id: number, downloaded: number, path = ""): TdFile => ({
  "@type": "file",
  id,
  size: 100,
  expected_size: 0,
  local: {
    path,
    is_downloading_active: path === "",
    is_downloading_completed: path !== "",
    downloaded_size: downloaded,
  },
});

let push: (file: TdFile) => void;
const unsubscribe = jest.fn();
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.clearAllMocks();
  watch.mockImplementation((h: (file: TdFile) => void) => {
    push = h;
    return unsubscribe;
  });
  start.mockResolvedValue({ ok: true, value: undefined });
  cancel.mockResolvedValue({ ok: true, value: undefined });
});

describe("viewFile", () => {
  it("starts the download at the viewer priority and reports the progress of that file", async () => {
    get.mockResolvedValue({ ok: true, value: td(7, 0) });
    const onChange = jest.fn();
    viewFile(7, onChange, jest.fn());
    await flush();
    expect(start).toHaveBeenCalledWith(7);
    push(td(8, 50));
    push(td(7, 40));
    push(td(7, 100, "/td/7.jpg"));
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([
      { downloaded: 0, size: 100, localUri: null },
      { downloaded: 40, size: 100, localUri: null },
      { downloaded: 100, size: 100, localUri: "file:///td/7.jpg" },
    ]);
  });

  it("does not download a file that is on the device", async () => {
    get.mockResolvedValue({ ok: true, value: td(7, 100, "/td/7.jpg") });
    const onChange = jest.fn();
    const stop = viewFile(7, onChange, jest.fn());
    await flush();
    expect(start).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ localUri: "file:///td/7.jpg" }),
    );
    stop();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancels a download that it started when the page closes", async () => {
    get.mockResolvedValue({ ok: true, value: td(7, 10) });
    const onChange = jest.fn();
    const stop = viewFile(7, onChange, jest.fn());
    await flush();
    stop();
    expect(unsubscribe).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith(7);
    push(td(7, 20));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not cancel after the download completes", async () => {
    get.mockResolvedValue({ ok: true, value: td(7, 10) });
    const stop = viewFile(7, jest.fn(), jest.fn());
    await flush();
    push(td(7, 100, "/td/7.jpg"));
    stop();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("gives a flood wait as rate limited", async () => {
    get.mockResolvedValue({ ok: true, value: td(7, 0) });
    start.mockResolvedValue({
      ok: false,
      error: { kind: "flood_wait", message: "FLOOD_WAIT_9", retryAfter: 9 },
    });
    const onError = jest.fn();
    viewFile(7, jest.fn(), onError);
    await flush();
    expect(onError).toHaveBeenCalledWith({
      kind: "rate_limited",
      code: "FLOOD_WAIT_9",
      retryAfter: 9,
    });
  });

  it("gives an error when the file does not load, and starts no download", async () => {
    get.mockResolvedValue({
      ok: false,
      error: { kind: "tdlib", message: "FILE_ID_INVALID" },
    });
    const onError = jest.fn();
    viewFile(7, jest.fn(), onError);
    await flush();
    expect(onError).toHaveBeenCalledWith({
      kind: "failed",
      code: "FILE_ID_INVALID",
    });
    expect(start).not.toHaveBeenCalled();
  });
});
