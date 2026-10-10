import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
} from "react-native";
import type TdLibBinding from "react-native-tdlib";

import type {
  TdError,
  TdLibUpdateEvent,
  TdMessage,
  TdObject,
  TdResult,
  TdUpdateMap,
} from "./types";

type Binding = typeof TdLibBinding;
type Handler = (update: TdObject) => void;

export type StartParams = {
  apiId: number;
  apiHash: string;
  appVersion?: string;
};

// The package index throws at import time when TdLibModule is not linked (jest, Expo Go,
// a build without Patch 1). Read the native module directly so the app can show a state
// instead of crashing. Note: index.js adds defaults to sendMessage and deleteMessages; pass
// every argument when you call those.
function binding(): Binding | null {
  return (NativeModules.TdLibModule as Binding | undefined) ?? null;
}

const handlers = new Map<string, Set<Handler>>();
const anyHandlers = new Set<Handler>();
let subscription: EmitterSubscription | null = null;

function dispatch(event: TdLibUpdateEvent): void {
  if (!event.raw) return; // echoToJs events have no raw payload.
  let update: TdObject;
  try {
    update = JSON.parse(event.raw) as TdObject;
  } catch {
    return;
  }
  handlers.get(update["@type"])?.forEach((h) => h(update));
  anyHandlers.forEach((h) => h(update));
}

// The one tdlib-update subscription in the app (CLAUDE.md §1, spec §9). Every module
// subscribes through onUpdate, so no update is handled twice and nothing leaks.
function ensureSubscription(native: Binding): void {
  if (subscription) return;
  type EmitterModule = ConstructorParameters<typeof NativeEventEmitter>[0];
  const emitter = new NativeEventEmitter(native as unknown as EmitterModule);
  subscription = emitter.addListener("tdlib-update", dispatch);
}

const FLOOD = /retry after (\d+)|FLOOD_WAIT_(\d+)/i;

/** Maps a rejected binding promise to a TdError. TDLib messages are kept unchanged. */
export function toTdError(e: unknown): TdError {
  const message =
    e instanceof Error
      ? e.message
      : typeof e === "string"
        ? e
        : "Unknown TDLib error";
  const flood = FLOOD.exec(message);
  if (flood) {
    return {
      kind: "flood_wait",
      message,
      retryAfter: Number(flood[1] ?? flood[2]),
    };
  }
  if (/not (initialized|linked)|CLIENT_NULL/i.test(message))
    return { kind: "not_ready", message };
  return { kind: "tdlib", message };
}

const notLinked: TdError = {
  kind: "not_ready",
  message: "TdLibModule not linked",
};

/** Calls a wrapped binding method. A rejection becomes an error result; nothing throws. */
export async function call<T>(
  fn: (td: Binding) => Promise<T>,
): Promise<TdResult<T>> {
  const native = binding();
  if (!native) return { ok: false, error: notLinked };
  try {
    return { ok: true, value: await fn(native) };
  } catch (e) {
    return { ok: false, error: toTdError(e) };
  }
}

/**
 * Reads the JSON that a wrapped method resolves with. Most methods resolve with a TDLib
 * `error` object instead of a rejection, so the type is checked here.
 */
export function parseRaw<T extends TdObject>(
  raw: string,
  type: T["@type"],
): TdResult<T> {
  let value: TdObject & { message?: unknown };
  try {
    value = JSON.parse(raw) as TdObject & { message?: unknown };
  } catch {
    return {
      ok: false,
      error: { kind: "tdlib", message: "Bad TDLib response" },
    };
  }
  if (value["@type"] === type) return { ok: true, value: value as T };
  const message =
    typeof value.message === "string" ? value.message : value["@type"];
  return { ok: false, error: toTdError(message) };
}

export function isLinked(): boolean {
  return binding() !== null;
}

/**
 * Subscribes to tdlib-update, then starts the client. startTdLib sends the TDLib parameters
 * itself (spec §3.2.4). It resolves "TDLib already started" after a JS reload; then no new
 * updateAuthorizationState arrives, so callers must also read getAuthorizationState.
 */
export async function startClient(
  params: StartParams,
): Promise<TdResult<void>> {
  const native = binding();
  if (!native) return { ok: false, error: notLinked };
  ensureSubscription(native);
  const started = await call((td) =>
    td.startTdLib({
      api_id: params.apiId,
      api_hash: params.apiHash,
      system_language_code: "en",
      device_model: "Android",
      application_version: params.appVersion ?? "1.0",
    }),
  );
  if (!started.ok) return started;
  // startTdLib hardcodes verbosity 5, which logs every packet. 1 keeps errors only.
  await call((td) =>
    td.td_json_client_execute({
      "@type": "setLogVerbosityLevel",
      new_verbosity_level: 1,
    }),
  );
  return { ok: true, value: undefined };
}

export function onUpdate<K extends keyof TdUpdateMap>(
  type: K,
  handler: (update: TdUpdateMap[K]) => void,
): () => void {
  let set = handlers.get(type);
  if (!set) {
    set = new Set();
    handlers.set(type, set);
  }
  const h = handler as Handler;
  set.add(h);
  return () => {
    set.delete(h);
  };
}

export function onAnyUpdate(handler: (update: TdObject) => void): () => void {
  anyHandlers.add(handler);
  return () => {
    anyHandlers.delete(handler);
  };
}

/**
 * Raw request. The binding sends it with a null result handler, so the direct result never
 * reaches JS (spec §3.2.3, TaskList 5.0). Only a conversion error comes back here. Read the
 * effect from updates.
 */
export function sendRaw(
  request: TdObject & Record<string, unknown>,
): Promise<TdResult<void>> {
  return call(async (td) => {
    await td.td_json_client_send(request);
  });
}

/** Synchronous TDLib request (Client.execute). Only a few functions allow it. */
export async function executeRaw<T extends TdObject>(
  request: TdObject & Record<string, unknown>,
): Promise<TdResult<T>> {
  const res = await call((td) => td.td_json_client_execute(request));
  if (!res.ok) return res;
  try {
    return { ok: true, value: JSON.parse(res.value) as T };
  } catch {
    return {
      ok: false,
      error: { kind: "tdlib", message: "Bad execute response" },
    };
  }
}

/**
 * Raw message send with correlation (spec §3.2.3). `@extra` is dropped by the binding, so the
 * request is matched to its pending message by `isOwn` on updateNewMessage (temporary id),
 * then the temporary id to updateMessageSendSucceeded / Failed via old_message_id.
 * `onPending` gives the temporary message, so progress can be tracked from updateFile.
 * The promise settles from updates only; it never awaits the native send (spec §4.2).
 */
export function sendMessageTracked(
  request: TdObject & Record<string, unknown>,
  isOwn: (pending: TdMessage) => boolean,
  onPending?: (pending: TdMessage) => void,
): Promise<TdResult<TdMessage>> {
  return new Promise((resolve) => {
    let tempId: number | null = null;
    const unsubs: (() => void)[] = [];
    const settle = (r: TdResult<TdMessage>): void => {
      unsubs.forEach((u) => u());
      resolve(r);
    };

    unsubs.push(
      onUpdate("updateNewMessage", ({ message }) => {
        if (tempId !== null || !message.sending_state || !isOwn(message))
          return;
        tempId = message.id;
        onPending?.(message);
      }),
      onUpdate("updateMessageSendSucceeded", (u) => {
        if (u.old_message_id === tempId) settle({ ok: true, value: u.message });
      }),
      onUpdate("updateMessageSendFailed", (u) => {
        if (u.old_message_id === tempId)
          settle({ ok: false, error: toTdError(u.error.message) });
      }),
    );

    void sendRaw(request).then((sent) => {
      if (!sent.ok) settle(sent);
    });
  });
}
