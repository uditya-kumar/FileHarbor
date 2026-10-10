import type { AuthStep, CodeDelivery, ServiceError, ServiceResult } from "@/types/domain";

import { call, onUpdate, sendRaw, startClient, type StartParams } from "./client";
import { resetSavedMessages } from "./savedMessages";
import type { TdAuthenticationCodeType, TdAuthorizationState, TdError, TdResult } from "./types";

// Authorization state machine (spec §4.1). TDLib drives it with updateAuthorizationState;
// this module keeps the latest step and maps it to the domain AuthStep. The session lives
// in TDLib's own database, so a relaunch goes straight to authorizationStateReady.

type Listener = (step: AuthStep) => void;

const listeners = new Set<Listener>();
let current: AuthStep = { step: "starting" };
let params: StartParams | null = null;
let unsubscribe: (() => void) | null = null;

function emit(next: AuthStep): void {
  current = next;
  listeners.forEach((l) => l(next));
}

export function toServiceError(e: TdError): ServiceError {
  const kind =
    e.kind === "flood_wait" ? "rate_limited" : e.kind === "not_ready" ? "unavailable" : "failed";
  const error: ServiceError = { kind, code: e.message };
  if (e.retryAfter !== undefined) error.retryAfter = e.retryAfter;
  return error;
}

function toResult(r: TdResult<unknown>): ServiceResult<void> {
  return r.ok ? { ok: true, value: undefined } : { ok: false, error: toServiceError(r.error) };
}

function delivery(type: TdAuthenticationCodeType | undefined): CodeDelivery {
  switch (type?.["@type"]) {
    case "authenticationCodeTypeTelegramMessage":
      return "telegram";
    case "authenticationCodeTypeSms":
      return "sms";
    case "authenticationCodeTypeCall":
      return "call";
    default:
      return "other";
  }
}

export function toAuthStep(state: TdAuthorizationState): AuthStep {
  switch (state["@type"]) {
    case "authorizationStateWaitTdlibParameters":
    case "authorizationStateClosing":
    case "authorizationStateClosed":
      return { step: "starting" };
    case "authorizationStateWaitPhoneNumber":
      return { step: "phone" };
    case "authorizationStateWaitCode": {
      const info = state.code_info;
      return {
        step: "code",
        phone: info?.phone_number ?? "",
        codeLength: info?.type.length ?? 0,
        delivery: delivery(info?.type),
        resendAfter: info?.timeout ?? 0,
        canResend: Boolean(info?.next_type),
      };
    }
    case "authorizationStateWaitPassword":
      return { step: "password", hint: state.password_hint ?? "" };
    case "authorizationStateReady":
      return { step: "ready" };
    case "authorizationStateLoggingOut":
      return { step: "loggingOut" };
    default:
      return { step: "unsupported", state: state["@type"] };
  }
}

function handleState(state: TdAuthorizationState): void {
  emit(toAuthStep(state));
  // The binding nulls the native client on Closed (spec §4.1). Start a fresh one, so the
  // user gets the phone step after a log-out.
  // The next account has its own Saved Messages chat.
  if (state["@type"] === "authorizationStateClosed") {
    resetSavedMessages();
    if (params) void boot(params);
  }
}

async function boot(p: StartParams): Promise<void> {
  const started = await startClient(p);
  if (!started.ok) {
    emit({ step: "unavailable", error: toServiceError(started.error) });
    return;
  }
  // After a JS reload TDLib is already started and sends no new update. Read the state
  // once. It has the type only, so do not replace a step that an update already gave.
  const polled = await call((td) => td.getAuthorizationState());
  if (!polled.ok || current.step !== "starting") return;
  try {
    emit(toAuthStep(JSON.parse(polled.value) as TdAuthorizationState));
  } catch {
    // Keep "starting"; the update stream gives the state.
  }
}

/** Starts TDLib and the state machine. A second call does nothing. */
export async function startAuth(p: StartParams): Promise<void> {
  if (params) return;
  params = p;
  unsubscribe = onUpdate("updateAuthorizationState", (u) => handleState(u.authorization_state));
  await boot(p);
}

export function getAuthStep(): AuthStep {
  return current;
}

/** Calls the listener now with the current step, then on each change. */
export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

/** `countryCode` must include "+". The binding joins the two strings as is (spec §4.1). */
export async function submitPhone(
  countryCode: string,
  number: string,
): Promise<ServiceResult<void>> {
  return toResult(await call((td) => td.login({ countrycode: countryCode, phoneNumber: number })));
}

export async function submitCode(code: string): Promise<ServiceResult<void>> {
  return toResult(await call((td) => td.verifyPhoneNumber(code)));
}

/** TDLib does the SRP 2FA exchange (CLAUDE.md §1). */
export async function submitPassword(password: string): Promise<ServiceResult<void>> {
  return toResult(await call((td) => td.verifyPassword(password)));
}

/** Raw call: a refusal is not reported (TaskList 5.0). A new code gives a new WaitCode state. */
export async function resendCode(): Promise<ServiceResult<void>> {
  return toResult(await sendRaw({ "@type": "resendAuthenticationCode" }));
}

export async function logOut(): Promise<ServiceResult<void>> {
  return toResult(await call((td) => td.logout()));
}

/** Test seam: forget the module state. */
export function resetAuthForTests(): void {
  unsubscribe?.();
  unsubscribe = null;
  params = null;
  listeners.clear();
  current = { step: "starting" };
}
