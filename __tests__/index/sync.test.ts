import { replaceDirIndex } from "@/index/db";
import { classifyMessage, syncIndex } from "@/index/sync";
import { resetSavedMessages } from "@/telegram/savedMessages";
import type { TdMessage } from "@/telegram/types";

import { installFakeTdLib, removeFakeTdLib } from "../telegram/fakeTdLib";

jest.mock("@/index/db", () => ({
  replaceDirIndex: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
}));

const replace = replaceDirIndex as jest.Mock;

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
      },
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
      { messageId: 3, dirPath: "A", name: "x.jpg", date: 1700000003 },
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
