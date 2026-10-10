import {
  call,
  onAnyUpdate,
  onUpdate,
  sendMessageTracked,
  startClient,
  toTdError,
} from "@/telegram/client";
import type { TdMessage } from "@/telegram/types";

import { installFakeTdLib, removeFakeTdLib } from "./fakeTdLib";

const message = (id: number, pending: boolean, text = "dir--a--/dir"): TdMessage => ({
  "@type": "message",
  id,
  chat_id: 1,
  date: 0,
  sending_state: pending ? { "@type": "messageSendingStatePending" } : null,
  content: { "@type": "messageDocument", caption: { text } },
});

const captionIs = (text: string) => (m: TdMessage) =>
  (m.content.caption as { text: string }).text === text;

describe("toTdError", () => {
  it("reads the flood wait seconds from both message forms", () => {
    expect(toTdError(new Error("Too Many Requests: retry after 42"))).toEqual({
      kind: "flood_wait",
      message: "Too Many Requests: retry after 42",
      retryAfter: 42,
    });
    expect(toTdError(new Error("FLOOD_WAIT_7")).retryAfter).toBe(7);
  });

  it("marks a missing client as not ready", () => {
    expect(toTdError(new Error("TDLib client is not initialized")).kind).toBe("not_ready");
  });

  it("keeps other TDLib messages unchanged", () => {
    expect(toTdError(new Error("PHONE_CODE_INVALID"))).toEqual({
      kind: "tdlib",
      message: "PHONE_CODE_INVALID",
    });
  });
});

describe("without the native module", () => {
  beforeEach(removeFakeTdLib);

  it("returns not_ready and does not throw", async () => {
    const res = await startClient({ apiId: 1, apiHash: "x" });
    expect(res).toEqual({ ok: false, error: { kind: "not_ready", message: "TdLibModule not linked" } });
  });
});

describe("with the native module", () => {
  let fake: ReturnType<typeof installFakeTdLib>;

  beforeEach(async () => {
    fake = installFakeTdLib();
    await startClient({ apiId: 123, apiHash: "hash" });
  });

  it("starts TDLib with the api credentials and lowers the log verbosity", () => {
    expect(fake.td.startTdLib).toHaveBeenCalledWith(
      expect.objectContaining({ api_id: 123, api_hash: "hash" }),
    );
    expect(fake.td.td_json_client_execute).toHaveBeenCalledWith({
      "@type": "setLogVerbosityLevel",
      new_verbosity_level: 1,
    });
  });

  it("fans one subscription out to typed and catch-all listeners", () => {
    const typed = jest.fn();
    const any = jest.fn();
    const offTyped = onUpdate("updateAuthorizationState", typed);
    const offAny = onAnyUpdate(any);
    fake.emit({
      "@type": "updateAuthorizationState",
      authorization_state: { "@type": "authorizationStateReady" },
    });
    fake.emit({ "@type": "updateOption", name: "x" });
    expect(typed).toHaveBeenCalledTimes(1);
    expect(typed.mock.calls[0][0].authorization_state["@type"]).toBe("authorizationStateReady");
    expect(any).toHaveBeenCalledTimes(2);
    offTyped();
    offAny();
    fake.emit({ "@type": "updateOption", name: "y" });
    expect(any).toHaveBeenCalledTimes(2);
  });

  it("ignores events with no raw payload", () => {
    const any = jest.fn();
    const off = onAnyUpdate(any);
    jest.requireActual("react-native").DeviceEventEmitter.emit("tdlib-update", {
      type: "EchoFromJava",
    });
    expect(any).not.toHaveBeenCalled();
    off();
  });

  it("maps a rejected wrapped call to an error result", async () => {
    fake.td.verifyPhoneNumber.mockRejectedValueOnce(new Error("PHONE_CODE_INVALID"));
    const res = await call((td) => td.verifyPhoneNumber("1"));
    expect(res).toEqual({ ok: false, error: { kind: "tdlib", message: "PHONE_CODE_INVALID" } });
  });

  describe("sendMessageTracked", () => {
    const request = { "@type": "sendMessage", chat_id: 1 };

    it("matches the pending message, then settles on send succeeded", async () => {
      const onPending = jest.fn();
      const done = sendMessageTracked(request, captionIs("dir--a--/dir"), onPending);
      // Another upload's pending message and a sent message must not match.
      fake.emit({ "@type": "updateNewMessage", message: message(-9, true, "dir--b--/dir") });
      fake.emit({ "@type": "updateNewMessage", message: message(-8, false) });
      fake.emit({ "@type": "updateNewMessage", message: message(-1, true) });
      fake.emit({ "@type": "updateMessageSendSucceeded", old_message_id: -9, message: message(90, false) });
      fake.emit({ "@type": "updateMessageSendSucceeded", old_message_id: -1, message: message(10, false) });
      await expect(done).resolves.toEqual({ ok: true, value: message(10, false) });
      expect(onPending).toHaveBeenCalledWith(message(-1, true));
      expect(fake.td.td_json_client_send).toHaveBeenCalledWith(request);
    });

    it("settles with the flood error on send failed", async () => {
      const done = sendMessageTracked(request, captionIs("dir--a--/dir"));
      fake.emit({ "@type": "updateNewMessage", message: message(-1, true) });
      fake.emit({
        "@type": "updateMessageSendFailed",
        old_message_id: -1,
        message: message(-1, false),
        error: { code: 429, message: "Too Many Requests: retry after 30" },
      });
      await expect(done).resolves.toEqual({
        ok: false,
        error: { kind: "flood_wait", message: "Too Many Requests: retry after 30", retryAfter: 30 },
      });
    });

    it("settles at once when the request cannot be converted", async () => {
      fake.td.td_json_client_send.mockRejectedValueOnce(new Error("Could not parse TDLib request"));
      await expect(sendMessageTracked(request, () => true)).resolves.toMatchObject({ ok: false });
    });
  });
});
