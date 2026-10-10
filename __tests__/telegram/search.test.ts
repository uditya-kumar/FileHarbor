import {
  getFullHistory,
  getHistoryPage,
  getMessages,
  HISTORY_PAGE_SIZE,
  MESSAGES_BATCH_SIZE,
} from "@/telegram/search";

import { installFakeTdLib, removeFakeTdLib } from "./fakeTdLib";

const row = (id: number) => ({
  raw_json: JSON.stringify({
    "@type": "message",
    id,
    chat_id: 1,
    date: id,
    content: { "@type": "messageText" },
  }),
});

const ids = (from: number, to: number) => {
  const out = [];
  for (let id = from; id >= to; id--) out.push(row(id));
  return out;
};

function install(pages: { raw_json: string }[][]) {
  const { td } = installFakeTdLib();
  const fake = td as typeof td & { getChatHistory: jest.Mock };
  fake.getChatHistory = jest.fn();
  pages.forEach((p) => fake.getChatHistory.mockResolvedValueOnce(p));
  fake.getChatHistory.mockResolvedValue([]);
  return fake;
}

afterEach(removeFakeTdLib);

describe("getHistoryPage", () => {
  it("asks for 100 messages with offset 0", async () => {
    const td = install([ids(5, 1)]);
    const r = await getHistoryPage(1, 0);
    expect(td.getChatHistory).toHaveBeenCalledWith(1, 0, HISTORY_PAGE_SIZE, 0);
    expect(r.ok && r.value.map((m) => m.id)).toEqual([5, 4, 3, 2, 1]);
  });

  it("gives a rejection as an error", async () => {
    const td = install([]);
    td.getChatHistory.mockReset().mockRejectedValue(new Error("No messages returned"));
    expect(await getHistoryPage(1, 0)).toEqual({
      ok: false,
      error: { kind: "tdlib", message: "No messages returned" },
    });
  });
});

describe("getFullHistory", () => {
  it("pages back from the oldest id of each page until an empty page", async () => {
    // TDLib often gives 1 message on the first call; a short page is not the end.
    const td = install([ids(700, 700), ids(699, 600), ids(599, 500), ids(499, 499)]);
    const progress: number[] = [];
    const r = await getFullHistory(1, (n) => progress.push(n));
    expect(r.ok && r.value.length).toBe(202);
    expect(td.getChatHistory.mock.calls.map((c) => c[1])).toEqual([0, 700, 600, 500, 499]);
    expect(progress).toEqual([1, 101, 201, 202]);
  });

  it("drops a repeated boundary message", async () => {
    install([ids(10, 6), ids(6, 1)]);
    const r = await getFullHistory(1);
    expect(r.ok && r.value.map((m) => m.id)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it("stops when TDLib does not move back", async () => {
    const td = install([ids(10, 6), ids(10, 6), ids(10, 6)]);
    const r = await getFullHistory(1);
    expect(r.ok && r.value.length).toBe(5);
    expect(td.getChatHistory).toHaveBeenCalledTimes(2);
  });

  it("gives an error from any page as an error", async () => {
    const td = install([ids(10, 6)]);
    td.getChatHistory.mockRejectedValueOnce(new Error("FLOOD_WAIT_30"));
    const r = await getFullHistory(1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ kind: "flood_wait", retryAfter: 30 });
  });
});

describe("getMessages", () => {
  const message = (id: number) => ({
    "@type": "message",
    id,
    chat_id: 1,
    date: id,
    content: { "@type": "messageText" },
  });
  const reply = (messages: (ReturnType<typeof message> | null)[]) =>
    JSON.stringify({ "@type": "messages", total_count: messages.length, messages });

  function installMessages() {
    const { td } = installFakeTdLib();
    const fake = td as typeof td & { getMessagesCompat: jest.Mock };
    fake.getMessagesCompat = jest.fn(async (_chat: number, ids: number[]) =>
      reply(ids.map(message)),
    );
    return fake;
  }

  it("asks in batches of 100 and keeps the order of the ids", async () => {
    const td = installMessages();
    const want = Array.from({ length: 250 }, (_, i) => 1000 - i);
    const r = await getMessages(1, want);
    expect(td.getMessagesCompat).toHaveBeenCalledTimes(3);
    expect(td.getMessagesCompat.mock.calls.map((c) => c[1].length)).toEqual([
      MESSAGES_BATCH_SIZE,
      MESSAGES_BATCH_SIZE,
      50,
    ]);
    expect(r.ok && r.value.map((m) => m?.id)).toEqual(want);
  });

  it("gives null for a deleted message, and pads a short reply", async () => {
    const td = installMessages();
    td.getMessagesCompat.mockResolvedValueOnce(reply([message(3), null]));
    const r = await getMessages(1, [3, 2, 1]);
    expect(r.ok && r.value.map((m) => m?.id ?? null)).toEqual([3, null, null]);
  });

  it("gives a TDLib error object as an error", async () => {
    const td = installMessages();
    td.getMessagesCompat.mockResolvedValueOnce(
      JSON.stringify({ "@type": "error", code: 400, message: "CHAT_NOT_FOUND" }),
    );
    expect(await getMessages(1, [1])).toEqual({
      ok: false,
      error: { kind: "tdlib", message: "CHAT_NOT_FOUND" },
    });
  });

  it("does not call TDLib with no ids", async () => {
    const td = installMessages();
    expect(await getMessages(1, [])).toEqual({ ok: true, value: [] });
    expect(td.getMessagesCompat).not.toHaveBeenCalled();
  });
});
