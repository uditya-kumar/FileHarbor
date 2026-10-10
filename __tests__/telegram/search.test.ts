import { getFullHistory, getHistoryPage, HISTORY_PAGE_SIZE } from "@/telegram/search";

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
