import { getSavedMessagesChatId, resetSavedMessages } from "@/telegram/savedMessages";

import { installFakeTdLib, removeFakeTdLib } from "./fakeTdLib";

function install() {
  const { td } = installFakeTdLib();
  const fake = td as typeof td & { getProfile: jest.Mock; createPrivateChat: jest.Mock };
  fake.getProfile = jest.fn().mockResolvedValue(JSON.stringify({ "@type": "user", id: 777 }));
  fake.createPrivateChat = jest
    .fn()
    .mockResolvedValue(JSON.stringify({ "@type": "chat", id: 777 }));
  return fake;
}

afterEach(() => {
  resetSavedMessages();
  removeFakeTdLib();
});

describe("getSavedMessagesChatId", () => {
  it("is the own user id, loaded with createPrivateChat (spec §1)", async () => {
    const td = install();
    expect(await getSavedMessagesChatId()).toEqual({ ok: true, value: 777 });
    expect(td.createPrivateChat).toHaveBeenCalledWith(777);
  });

  it("asks TDLib only once", async () => {
    const td = install();
    await getSavedMessagesChatId();
    await getSavedMessagesChatId();
    expect(td.getProfile).toHaveBeenCalledTimes(1);
  });

  it("asks again after a reset (log-out)", async () => {
    const td = install();
    await getSavedMessagesChatId();
    resetSavedMessages();
    await getSavedMessagesChatId();
    expect(td.getProfile).toHaveBeenCalledTimes(2);
  });

  it("gives a createPrivateChat rejection as an error, and does not cache it", async () => {
    const td = install();
    td.createPrivateChat.mockRejectedValueOnce(new Error("Chat not found"));
    const r = await getSavedMessagesChatId();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ message: "Chat not found" });
    expect(await getSavedMessagesChatId()).toEqual({ ok: true, value: 777 });
  });

  it("gives a result that is not a chat as an error", async () => {
    const td = install();
    td.createPrivateChat.mockResolvedValue(
      JSON.stringify({ "@type": "error", code: 400, message: "USER_ID_INVALID" }),
    );
    expect(await getSavedMessagesChatId()).toEqual({
      ok: false,
      error: { kind: "tdlib", message: "USER_ID_INVALID" },
    });
  });

  it("gives a getProfile rejection as an error", async () => {
    const td = install();
    td.getProfile.mockRejectedValue(new Error("Too Many Requests: retry after 9"));
    const r = await getSavedMessagesChatId();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ kind: "flood_wait", retryAfter: 9 });
  });

  it("is not_ready when TdLib is not linked", async () => {
    const r = await getSavedMessagesChatId();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("not_ready");
  });
});
