import { syncIndex } from "@/index/sync";
import { deleteThumbnail, makeThumbnail } from "@/media/thumbnail";
import type { TdFile, TdMessage, TdResult } from "@/telegram/types";
import { onFileUpdate } from "@/telegram/download";
import { getSavedMessagesChatId } from "@/telegram/savedMessages";
import { sendDocument } from "@/telegram/upload";
import { uploadFile } from "@/transfer/queue";
import type { UploadSource } from "@/types/domain";

const mockDeleted: string[] = [];
jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(path: string) {
      this.uri = path;
    }
    delete(): void {
      mockDeleted.push(this.uri);
    }
  },
}));
jest.mock("@/index/sync", () => ({ syncIndex: jest.fn() }));
jest.mock("@/media/thumbnail", () => ({
  makeThumbnail: jest.fn(),
  deleteThumbnail: jest.fn(),
}));
jest.mock("@/telegram/download", () => ({ onFileUpdate: jest.fn() }));
jest.mock("@/telegram/savedMessages", () => ({
  getSavedMessagesChatId: jest.fn(),
}));
jest.mock("@/telegram/upload", () => ({
  ...jest.requireActual("@/telegram/upload"),
  sendDocument: jest.fn(),
}));

const send = sendDocument as jest.Mock;
const thumb = makeThumbnail as jest.Mock;
const dropThumb = deleteThumbnail as jest.Mock;
const chat = getSavedMessagesChatId as jest.Mock;
const sync = syncIndex as jest.Mock;
const watch = onFileUpdate as jest.Mock;

const source = (over: Partial<UploadSource> = {}): UploadSource => ({
  uri: "file:///data/cache/ImagePicker/a.jpg",
  name: "IMG_1.jpg",
  mimeType: "image/jpeg",
  size: 100,
  kind: "photo",
  temporary: true,
  ...over,
});

const pendingMessage: TdMessage = {
  "@type": "message",
  id: -1,
  chat_id: 42,
  date: 0,
  sending_state: { "@type": "messageSendingStatePending" },
  content: {
    "@type": "messageDocument",
    document: { document: { "@type": "file", id: 7, size: 100 } },
  },
};

let pushFile: (file: TdFile) => void;
const unwatch = jest.fn();
let finish: (r: TdResult<TdMessage>) => void;

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleted.length = 0;
  chat.mockResolvedValue({ ok: true, value: 42 });
  thumb.mockResolvedValue({
    uri: "file:///cache/t.jpg",
    width: 320,
    height: 240,
  });
  sync.mockResolvedValue({ ok: true, value: {} });
  watch.mockImplementation((h: typeof pushFile) => {
    pushFile = h;
    return unwatch;
  });
  send.mockImplementation(
    (_: unknown, onPending: (m: TdMessage) => void) =>
      new Promise((resolve) => {
        onPending(pendingMessage);
        finish = resolve;
      }),
  );
});

const flush = () => new Promise((r) => setImmediate(r));

describe("uploadFile", () => {
  it("sends the file with the v1 caption, the thumbnail, and the plain paths", async () => {
    const done = uploadFile(source(), "Goa 2024");
    await flush();
    expect(send).toHaveBeenCalledWith(
      {
        chatId: 42,
        path: "/data/cache/ImagePicker/a.jpg",
        caption: 'fileharbor:1:{"path":["Goa 2024"],"name":"IMG_1.jpg"}',
        thumbnail: { path: "/cache/t.jpg", width: 320, height: 240 },
      },
      expect.any(Function),
    );
    finish({
      ok: true,
      value: { ...pendingMessage, id: 100, sending_state: null },
    });
    await expect(done).resolves.toEqual({ ok: true, value: undefined });
    // The folder shows the new file, and the cache copy and the thumbnail are deleted.
    expect(sync).toHaveBeenCalled();
    expect(mockDeleted).toEqual(["file:///data/cache/ImagePicker/a.jpg"]);
    expect(dropThumb).toHaveBeenCalled();
    expect(unwatch).toHaveBeenCalled();
  });

  it("reports the upload progress of the pending file only", async () => {
    const progress = jest.fn();
    const done = uploadFile(source(), "", progress);
    await flush();
    expect(progress).toHaveBeenLastCalledWith({ uploaded: 0, size: 100 });
    const file = (id: number, uploaded: number): TdFile => ({
      "@type": "file",
      id,
      size: 100,
      expected_size: 100,
      remote: {
        is_uploading_active: true,
        is_uploading_completed: false,
        uploaded_size: uploaded,
      },
    });
    pushFile(file(8, 90));
    pushFile(file(7, 40));
    expect(progress).toHaveBeenLastCalledWith({ uploaded: 40, size: 100 });
    expect(progress).toHaveBeenCalledTimes(2);
    finish({ ok: true, value: pendingMessage });
    await done;
  });

  it("keeps the picked copy when the send fails, and gives the error", async () => {
    const done = uploadFile(source(), "Goa 2024");
    await flush();
    finish({
      ok: false,
      error: { kind: "flood_wait", message: "FLOOD_WAIT_30", retryAfter: 30 },
    });
    await expect(done).resolves.toEqual({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_30", retryAfter: 30 },
    });
    expect(mockDeleted).toEqual([]);
    expect(sync).not.toHaveBeenCalled();
    expect(dropThumb).toHaveBeenCalled();
  });

  it("sends nothing for a bad name, a content URI, or a second send of one caption", async () => {
    await expect(uploadFile(source({ name: "a/b.jpg" }), "")).resolves.toEqual({
      ok: false,
      error: { kind: "failed", code: "BAD_NAME" },
    });
    await expect(
      uploadFile(source({ uri: "content://media/1" }), ""),
    ).resolves.toEqual({
      ok: false,
      error: { kind: "failed", code: "NOT_LOCAL_FILE" },
    });
    const first = uploadFile(source(), "");
    await flush();
    await expect(uploadFile(source(), "")).resolves.toEqual({
      ok: false,
      error: { kind: "failed", code: "ALREADY_SENDING" },
    });
    expect(send).toHaveBeenCalledTimes(1);
    finish({ ok: true, value: pendingMessage });
    await first;
  });

  it("does not delete a file that is not a cache copy", async () => {
    const done = uploadFile(source({ temporary: false }), "");
    await flush();
    finish({ ok: true, value: pendingMessage });
    await done;
    expect(mockDeleted).toEqual([]);
  });

  it("sends with no thumbnail when none can be made", async () => {
    thumb.mockResolvedValue(null);
    const done = uploadFile(source({ kind: "other", name: "a.pdf" }), "");
    await flush();
    expect(send.mock.calls[0][0]).toMatchObject({ thumbnail: null });
    finish({ ok: true, value: pendingMessage });
    await done;
    expect(dropThumb).not.toHaveBeenCalled();
  });

  it("gives the chat error when Saved Messages cannot be read", async () => {
    chat.mockResolvedValue({
      ok: false,
      error: { kind: "not_ready", message: "TdLibModule not linked" },
    });
    await expect(uploadFile(source(), "")).resolves.toEqual({
      ok: false,
      error: { kind: "unavailable", code: "TdLibModule not linked" },
    });
    expect(send).not.toHaveBeenCalled();
  });
});
