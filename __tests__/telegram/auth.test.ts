import {
  getAuthStep,
  resetAuthForTests,
  startAuth,
  submitCode,
  submitPhone,
  subscribeAuth,
  toAuthStep,
} from "@/telegram/auth";

import { installFakeTdLib, removeFakeTdLib } from "./fakeTdLib";

const authUpdate = (state: Record<string, unknown>) => ({
  "@type": "updateAuthorizationState",
  authorization_state: state,
});

describe("toAuthStep", () => {
  it("maps WaitCode with the code info", () => {
    expect(
      toAuthStep({
        "@type": "authorizationStateWaitCode",
        code_info: {
          phone_number: "919876543210",
          type: { "@type": "authenticationCodeTypeTelegramMessage", length: 5 },
          next_type: { "@type": "authenticationCodeTypeSms", length: 5 },
          timeout: 42,
        },
      }),
    ).toEqual({
      step: "code",
      phone: "919876543210",
      codeLength: 5,
      delivery: "telegram",
      resendAfter: 42,
      canResend: true,
    });
  });

  it("maps WaitCode with no code info (state read after a reload)", () => {
    expect(toAuthStep({ "@type": "authorizationStateWaitCode" })).toMatchObject({
      step: "code",
      codeLength: 0,
      canResend: false,
    });
  });

  it("maps WaitPassword with the hint", () => {
    expect(
      toAuthStep({ "@type": "authorizationStateWaitPassword", password_hint: "first pet" }),
    ).toEqual({ step: "password", hint: "first pet" });
  });

  it("maps states the app does not handle to unsupported", () => {
    expect(toAuthStep({ "@type": "authorizationStateWaitRegistration" })).toEqual({
      step: "unsupported",
      state: "authorizationStateWaitRegistration",
    });
  });
});

describe("auth state machine", () => {
  afterEach(resetAuthForTests);

  it("is unavailable when TDLib is not linked", async () => {
    removeFakeTdLib();
    await startAuth({ apiId: 1, apiHash: "x" });
    expect(getAuthStep()).toEqual({
      step: "unavailable",
      error: { kind: "unavailable", code: "TdLibModule not linked" },
    });
  });

  it("follows updateAuthorizationState and tells subscribers", async () => {
    const { emit } = installFakeTdLib();
    const seen: string[] = [];
    subscribeAuth((s) => seen.push(s.step));
    await startAuth({ apiId: 1, apiHash: "x" });
    emit(authUpdate({ "@type": "authorizationStateWaitPhoneNumber" }));
    emit(authUpdate({ "@type": "authorizationStateWaitPassword", password_hint: "" }));
    emit(authUpdate({ "@type": "authorizationStateReady" }));
    expect(seen).toEqual(["starting", "starting", "phone", "password", "ready"]);
  });

  it("reads the state once after a JS reload (no new update)", async () => {
    const { td } = installFakeTdLib();
    td.startTdLib.mockResolvedValueOnce("TDLib already started");
    td.getAuthorizationState.mockResolvedValueOnce(
      JSON.stringify({ "@type": "authorizationStateReady" }),
    );
    await startAuth({ apiId: 1, apiHash: "x" });
    expect(getAuthStep()).toEqual({ step: "ready" });
  });

  it("starts a fresh client after Closed", async () => {
    const { td, emit } = installFakeTdLib();
    await startAuth({ apiId: 1, apiHash: "x" });
    emit(authUpdate({ "@type": "authorizationStateClosed" }));
    await Promise.resolve();
    expect(td.startTdLib).toHaveBeenCalledTimes(2);
  });

  it("passes the country code with + and returns errors as results", async () => {
    const { td } = installFakeTdLib();
    await startAuth({ apiId: 1, apiHash: "x" });
    await submitPhone("+91", "9876543210");
    expect(td.login).toHaveBeenCalledWith({ countrycode: "+91", phoneNumber: "9876543210" });

    td.verifyPhoneNumber.mockRejectedValueOnce(new Error("FLOOD_WAIT_60"));
    expect(await submitCode("12345")).toEqual({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_60", retryAfter: 60 },
    });
  });
});
