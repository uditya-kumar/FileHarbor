import { startClient } from "@/telegram/client";
import {
  cancelDownload,
  downloadFile,
  getFile,
  onFileUpdate,
  PRIORITY_VIEWING,
  startPriorityDownload,
} from "@/telegram/download";

import { installFakeTdLib, removeFakeTdLib } from "./fakeTdLib";

const file = (id: number, done: boolean) => ({
  "@type": "file",
  id,
  size: 10,
  expected_size: 10,
  local: {
    path: done ? `/data/td/${id}.jpg` : "",
    is_downloading_active: !done,
    is_downloading_completed: done,
    downloaded_size: done ? 10 : 0,
  },
});

function install() {
  const { td, emit } = installFakeTdLib();
  const fake = td as typeof td & {
    downloadFile: jest.Mock;
    getFile: jest.Mock;
    cancelDownloadFile: jest.Mock;
  };
  fake.downloadFile = jest
    .fn()
    .mockResolvedValue({ raw: JSON.stringify(file(7, true)) });
  fake.getFile = jest
    .fn()
    .mockResolvedValue({ raw: JSON.stringify(file(7, false)) });
  fake.cancelDownloadFile = jest
    .fn()
    .mockResolvedValue({ raw: JSON.stringify({ "@type": "ok" }) });
  return { td: fake, emit };
}

afterEach(removeFakeTdLib);

describe("downloadFile", () => {
  it("gives the file when the download is complete", async () => {
    const { td } = install();
    const r = await downloadFile(7);
    expect(td.downloadFile).toHaveBeenCalledWith(7);
    expect(r.ok && r.value.local?.path).toBe("/data/td/7.jpg");
  });

  it("gives a TDLib error object as an error, with the flood wait", async () => {
    const { td } = install();
    td.downloadFile.mockResolvedValue({
      raw: JSON.stringify({
        "@type": "error",
        code: 429,
        message: "Too Many Requests: retry after 12",
      }),
    });
    expect(await downloadFile(7)).toEqual({
      ok: false,
      error: {
        kind: "flood_wait",
        message: "Too Many Requests: retry after 12",
        retryAfter: 12,
      },
    });
  });

  it("gives a missing binding as an error, not a throw", async () => {
    expect(await downloadFile(7)).toMatchObject({
      ok: false,
      error: { kind: "not_ready" },
    });
  });
});

describe("startPriorityDownload", () => {
  it("sends a raw request at priority 32 that does not wait", async () => {
    const { td } = install();
    expect(await startPriorityDownload(9)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(td.td_json_client_send).toHaveBeenCalledWith({
      "@type": "downloadFile",
      file_id: 9,
      priority: PRIORITY_VIEWING,
      offset: 0,
      limit: 0,
      synchronous: false,
    });
  });
});

describe("cancelDownload and getFile", () => {
  it("cancels the download and keeps the parts on the device", async () => {
    const { td } = install();
    expect(await cancelDownload(7)).toEqual({ ok: true, value: undefined });
    expect(td.cancelDownloadFile).toHaveBeenCalledWith(7, false);
  });

  it("gives the current file state", async () => {
    install();
    const r = await getFile(7);
    expect(r.ok && r.value.local?.is_downloading_active).toBe(true);
  });
});

describe("onFileUpdate", () => {
  it("gives the file of each updateFile until unsubscribed", async () => {
    const { emit } = install();
    // The one tdlib-update subscription starts with the client.
    await startClient({ apiId: 1, apiHash: "x" });
    const seen: number[] = [];
    const off = onFileUpdate((f) => seen.push(f.local?.downloaded_size ?? -1));
    emit({ "@type": "updateFile", file: file(7, false) });
    emit({ "@type": "updateFile", file: file(7, true) });
    off();
    emit({ "@type": "updateFile", file: file(7, true) });
    expect(seen).toEqual([0, 10]);
  });
});
