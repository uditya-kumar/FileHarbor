import { getFilesInDir, replaceDirIndex } from "@/index/db";
import {
  classifyMessage,
  loadFolderFiles,
  loadThumbnail,
  mediaKindOf,
  syncIndex,
  toFolderFile,
} from "@/index/sync";
import { resetSavedMessages } from "@/telegram/savedMessages";
import type { TdMessage } from "@/telegram/types";

import { installFakeTdLib, removeFakeTdLib } from "../telegram/fakeTdLib";

jest.mock("@/index/db", () => ({
  replaceDirIndex: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
  getFilesInDir: jest.fn(),
}));

const replace = replaceDirIndex as jest.Mock;
const filesInDir = getFilesInDir as jest.Mock;

// The caption that format/caption.ts writes for a file.
const fh = (path: string[], name: string): string =>
  `fileharbor:1:${JSON.stringify({ path, name })}`;

const doc = (
  id: number,
  caption: string,
  fileName = `file${id}.jpg`,
): TdMessage => ({
  "@type": "message",
  id,
  chat_id: 777,
  date: 1700000000 + id,
  content: {
    "@type": "messageDocument",
    document: {
      "@type": "document",
      file_name: fileName,
      mime_type: "image/jpeg",
      document: { "@type": "file", id, size: 1000 + id, expected_size: 0 },
    },
    caption: { "@type": "formattedText", text: caption },
  },
});

const withContent = (id: number, content: TdMessage["content"]): TdMessage => ({
  "@type": "message",
  id,
  chat_id: 777,
  date: 1,
  content,
});

function install(messages: TdMessage[]) {
  const { td } = installFakeTdLib();
  const fake = td as typeof td & {
    getProfile: jest.Mock;
    createPrivateChat: jest.Mock;
    getChatHistory: jest.Mock;
  };
  fake.getProfile = jest
    .fn()
    .mockResolvedValue(JSON.stringify({ "@type": "user", id: 777 }));
  fake.createPrivateChat = jest
    .fn()
    .mockResolvedValue(JSON.stringify({ "@type": "chat", id: 777 }));
  fake.getChatHistory = jest
    .fn()
    .mockResolvedValueOnce(
      messages.map((m) => ({ raw_json: JSON.stringify(m) })),
    )
    .mockResolvedValue([]);
  return fake;
}

afterEach(() => {
  resetSavedMessages();
  removeFakeTdLib();
  replace.mockClear();
});

describe("classifyMessage", () => {
  it("indexes a document with a FileHarbor caption, with the name from the caption", () => {
    expect(
      classifyMessage(
        doc(5, fh(["Holiday", "Beach"], "a.heic"), "upload-tmp.heic"),
      ),
    ).toEqual({
      kind: "file",
      file: {
        messageId: 5,
        dirPath: "Holiday/Beach",
        name: "a.heic",
        date: 1700000005,
        size: 1005,
        mimeType: "image/jpeg",
      },
    });
  });

  it('uses expected_size when the size is not known, and 0 and "" with no document data', () => {
    const partial = doc(14, fh(["X"], "a.bin"));
    const content = partial.content as unknown as {
      document: { document: { size: number; expected_size: number } };
    };
    content.document.document.size = 0;
    content.document.document.expected_size = 777;
    expect(classifyMessage(partial)).toMatchObject({ file: { size: 777 } });

    const bare = withContent(15, {
      "@type": "messageDocument",
      caption: { "@type": "formattedText", text: fh(["X"], "a.bin") },
    });
    expect(classifyMessage(bare)).toMatchObject({
      file: { size: 0, mimeType: "" },
    });
  });

  it("indexes a file in the root", () => {
    expect(classifyMessage(doc(4, fh([], "a.pdf")))).toMatchObject({
      kind: "file",
      file: { dirPath: "", name: "a.pdf" },
    });
  });

  it("records a bad FileHarbor caption", () => {
    expect(classifyMessage(doc(6, "fileharbor:1:{"))).toEqual({
      kind: "skip",
      skip: { messageId: 6, caption: "fileharbor:1:{", reason: "bad_caption" },
    });
    expect(classifyMessage(doc(7, fh([""], "a.jpg")))).toMatchObject({
      kind: "skip",
      skip: { reason: "bad_caption" },
    });
  });

  it("records a FileHarbor caption on a photo", () => {
    const text = fh(["X"], "a.jpg");
    const photo = withContent(8, {
      "@type": "messagePhoto",
      caption: { "@type": "formattedText", text },
    });
    expect(classifyMessage(photo)).toEqual({
      kind: "skip",
      skip: { messageId: 8, caption: text, reason: "not_document" },
    });
  });

  it("counts notes, other captions, old web app captions, and a pending send as other", () => {
    const text = withContent(9, {
      "@type": "messageText",
      text: { text: fh([], "a") },
    });
    expect(classifyMessage(text)).toEqual({ kind: "other" });
    expect(classifyMessage(doc(10, ""))).toEqual({ kind: "other" });
    expect(classifyMessage(doc(11, "holiday"))).toEqual({ kind: "other" });
    expect(
      classifyMessage(doc(12, "dir--0/-OfbIM-MZ14I7p79snqB--/dir")),
    ).toEqual({ kind: "other" });
    const pending = {
      ...doc(13, fh([], "a")),
      sending_state: { "@type": "pending" },
    };
    expect(classifyMessage(pending)).toEqual({ kind: "other" });
  });
});

describe("syncIndex", () => {
  it("scans Saved Messages and replaces dir_index", async () => {
    const td = install([
      doc(3, fh(["A"], "x.jpg")),
      doc(2, "hello"),
      doc(1, "fileharbor:1:{"),
    ]);
    const r = await syncIndex();
    expect(td.getChatHistory.mock.calls[0][0]).toBe(777);
    expect(r).toEqual({
      ok: true,
      value: {
        scanned: 3,
        indexed: 1,
        other: 1,
        skipped: [
          { messageId: 1, caption: "fileharbor:1:{", reason: "bad_caption" },
        ],
      },
    });
    expect(replace).toHaveBeenCalledWith([
      {
        messageId: 3,
        dirPath: "A",
        name: "x.jpg",
        date: 1700000003,
        size: 1003,
        mimeType: "image/jpeg",
      },
    ]);
  });

  it("runs one scan for two calls at the same time", async () => {
    const td = install([doc(1, fh([], "a"))]);
    const [a, b] = await Promise.all([syncIndex(), syncIndex()]);
    expect(a).toBe(b);
    expect(td.getProfile).toHaveBeenCalledTimes(1);
  });

  it("does not touch dir_index when the history fails", async () => {
    const td = install([]);
    td.getChatHistory
      .mockReset()
      .mockRejectedValue(new Error("Too Many Requests: retry after 12"));
    expect(await syncIndex()).toEqual({
      ok: false,
      error: {
        kind: "rate_limited",
        code: "Too Many Requests: retry after 12",
        retryAfter: 12,
      },
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("gives a database error as failed", async () => {
    install([doc(1, fh([], "a"))]);
    replace.mockResolvedValueOnce({ ok: false, message: "disk full" });
    expect(await syncIndex()).toEqual({
      ok: false,
      error: { kind: "failed", code: "disk full" },
    });
  });

  it("is unavailable when TdLib is not linked", async () => {
    const r = await syncIndex();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("unavailable");
  });
});

// ---------- Read path ----------

const tdFile = (id: number, path = "") => ({
  "@type": "file",
  id,
  size: 10,
  expected_size: 10,
  local: {
    path,
    is_downloading_active: false,
    is_downloading_completed: path !== "",
    downloaded_size: path ? 10 : 0,
  },
});

const indexed = (messageId: number, name = `f${messageId}.jpg`) => ({
  messageId,
  dirPath: "Goa",
  name,
  date: 1,
  size: 100,
  mimeType: "image/jpeg",
});

/** A document message with a thumbnail and a minithumbnail. */
const mediaDoc = (id: number, thumbPath = ""): TdMessage => {
  const m = doc(id, fh(["Goa"], `f${id}.jpg`));
  const content = m.content as unknown as { document: Record<string, unknown> };
  content.document.document = tdFile(id);
  content.document.thumbnail = {
    width: 320,
    height: 240,
    file: tdFile(id + 1000, thumbPath),
  };
  content.document.minithumbnail = {
    width: 40,
    height: 30,
    data: [-1, -40, -1],
  };
  return m;
};

describe("mediaKindOf", () => {
  it("reads the MIME type first", () => {
    expect(mediaKindOf("a.bin", "image/heic")).toBe("photo");
    expect(mediaKindOf("a.jpg", "video/mp4")).toBe("video");
  });

  it("falls back to the extension, in any case", () => {
    expect(mediaKindOf("IMG_1.HEIC", "application/octet-stream")).toBe("photo");
    expect(mediaKindOf("clip.MOV", "")).toBe("video");
    expect(mediaKindOf("report.pdf", "application/pdf")).toBe("other");
    expect(mediaKindOf("noext", "")).toBe("other");
  });
});

describe("toFolderFile", () => {
  it("adds the file id, the thumbnail, and the minithumbnail", () => {
    expect(toFolderFile(indexed(5), mediaDoc(5, "/td/thumbs/5.jpg"))).toEqual({
      ...indexed(5),
      kind: "photo",
      fileId: 5,
      localUri: null,
      thumbnailFileId: 1005,
      thumbnailUri: "file:///td/thumbs/5.jpg",
      placeholderUri: "data:image/jpeg;base64,/9j/",
    });
  });

  it("gives no thumbnail URI before the thumbnail is downloaded", () => {
    expect(toFolderFile(indexed(5), mediaDoc(5))).toMatchObject({
      thumbnailFileId: 1005,
      thumbnailUri: null,
    });
  });

  it("gives null for a message that is no longer a document", () => {
    expect(
      toFolderFile(indexed(5), withContent(5, { "@type": "messageText" })),
    ).toBeNull();
  });
});

describe("loadFolderFiles", () => {
  function installMessages(messages: (TdMessage | null)[]) {
    const fake = install([]);
    const td = fake as typeof fake & { getMessagesCompat: jest.Mock };
    td.getMessagesCompat = jest
      .fn()
      .mockResolvedValue(
        JSON.stringify({
          "@type": "messages",
          total_count: messages.length,
          messages,
        }),
      );
    return td;
  }

  afterEach(() => filesInDir.mockReset());

  it("reads the rows, then their messages, and leaves out a deleted message", async () => {
    filesInDir.mockResolvedValue({
      ok: true,
      value: [indexed(3), indexed(2), indexed(1)],
    });
    const td = installMessages([mediaDoc(3), null, mediaDoc(1)]);
    const r = await loadFolderFiles("Goa");
    expect(filesInDir).toHaveBeenCalledWith("Goa");
    expect(td.getMessagesCompat).toHaveBeenCalledWith(777, [3, 2, 1]);
    expect(r.ok && r.value.map((f) => f.messageId)).toEqual([3, 1]);
  });

  it("does not call TDLib for an empty folder", async () => {
    filesInDir.mockResolvedValue({ ok: true, value: [] });
    const td = installMessages([]);
    expect(await loadFolderFiles("Goa")).toEqual({ ok: true, value: [] });
    expect(td.getProfile).not.toHaveBeenCalled();
  });

  it("gives a database error as failed", async () => {
    filesInDir.mockResolvedValue({ ok: false, message: "no such table" });
    expect(await loadFolderFiles("Goa")).toEqual({
      ok: false,
      error: { kind: "failed", code: "no such table" },
    });
  });

  it("gives a flood wait as rate limited", async () => {
    filesInDir.mockResolvedValue({ ok: true, value: [indexed(1)] });
    const td = installMessages([]);
    td.getMessagesCompat.mockResolvedValue(
      JSON.stringify({ "@type": "error", code: 429, message: "FLOOD_WAIT_7" }),
    );
    expect(await loadFolderFiles("Goa")).toEqual({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_7", retryAfter: 7 },
    });
  });
});

describe("loadThumbnail", () => {
  function installDownload(file: unknown) {
    const fake = install([]);
    const td = fake as typeof fake & { downloadFile: jest.Mock };
    td.downloadFile = jest
      .fn()
      .mockResolvedValue({ raw: JSON.stringify(file) });
    return td;
  }

  it("gives the file URI of the downloaded thumbnail", async () => {
    const td = installDownload(tdFile(1005, "/td/thumbs/5.jpg"));
    expect(await loadThumbnail(1005)).toEqual({
      ok: true,
      value: "file:///td/thumbs/5.jpg",
    });
    expect(td.downloadFile).toHaveBeenCalledWith(1005);
  });

  it("gives an error when TDLib gives no local path", async () => {
    installDownload(tdFile(1005));
    expect(await loadThumbnail(1005)).toEqual({
      ok: false,
      error: { kind: "failed", code: "NO_LOCAL_PATH" },
    });
  });
});
