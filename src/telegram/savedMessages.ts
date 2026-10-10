import { call, parseRaw } from "./client";
import type { TdChat, TdResult, TdUser } from "./types";

// The Saved Messages chat id equals the user's own id (spec §1). TDLib needs the chat in its
// cache before the chat can be read. On a new session getChat(id) gives "Chat not found"
// (seen on the device, 2026-10-10), so createPrivateChat loads the chat. It also returns a
// chat that is already loaded.

let cached: number | null = null;

/** Gets the Saved Messages chat id. Call it only after the authorization is ready. */
export async function getSavedMessagesChatId(): Promise<TdResult<number>> {
  if (cached !== null) return { ok: true, value: cached };

  const profile = await call((td) => td.getProfile());
  if (!profile.ok) return profile;
  const user = parseRaw<TdUser>(profile.value, "user");
  if (!user.ok) return user;

  // The binding resolves with the chat JSON, and rejects on a TDLib error.
  const chat = await call((td) => td.createPrivateChat(user.value.id));
  if (!chat.ok) return chat;
  const loaded = parseRaw<TdChat>(chat.value, "chat");
  if (!loaded.ok) return loaded;

  cached = loaded.value.id;
  return { ok: true, value: cached };
}

/** Forgets the cached id. Call it on log-out, so the next account does not use it. */
export function resetSavedMessages(): void {
  cached = null;
}
