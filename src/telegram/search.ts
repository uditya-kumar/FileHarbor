import { call, parseRaw } from "./client";
import type { TdMessage, TdMessages, TdResult } from "./types";

// Message listing (spec §4.4). searchChatMessages is a raw call, so its result cannot reach
// JS without Patch 3 (TaskList 5.0). Until that decision, folders read the local dir_index.

/** TDLib returns at most 100 messages for each getChatHistory call (spec §3.1). */
export const HISTORY_PAGE_SIZE = 100;

/**
 * One page of history, newest first, older than `fromMessageId` (0 = the newest message).
 * TDLib can return fewer messages than the limit before the end. Only an empty page is the end.
 */
export async function getHistoryPage(
  chatId: number,
  fromMessageId: number,
): Promise<TdResult<TdMessage[]>> {
  const page = await call((td) =>
    td.getChatHistory(chatId, fromMessageId, HISTORY_PAGE_SIZE, 0),
  );
  if (!page.ok) return page;
  try {
    return {
      ok: true,
      value: page.value.map((m) => JSON.parse(m.raw_json) as TdMessage),
    };
  } catch {
    return {
      ok: false,
      error: { kind: "tdlib", message: "Bad getChatHistory response" },
    };
  }
}

/**
 * All messages of the chat, newest first. About 7 calls for 600 files (spec §4.4).
 * `onPage` gets the running count, so a screen can show progress.
 */
export async function getFullHistory(
  chatId: number,
  onPage?: (loaded: number) => void,
): Promise<TdResult<TdMessage[]>> {
  const all: TdMessage[] = [];
  let from = 0;
  for (;;) {
    const page = await getHistoryPage(chatId, from);
    if (!page.ok) return page;
    const last = page.value[page.value.length - 1];
    // Stop on the end, and also if TDLib does not move back: that would loop for ever.
    if (!last || (from !== 0 && last.id >= from)) break;
    all.push(...page.value.filter((m) => from === 0 || m.id < from));
    from = last.id;
    onPage?.(all.length);
  }
  return { ok: true, value: all };
}

/** TDLib has no documented limit for getMessages. 100 keeps each reply small. */
export const MESSAGES_BATCH_SIZE = 100;

/**
 * Messages by id, in the order of `messageIds`. A deleted message is null. TDLib reads its
 * local message database first, so this works offline for messages that it has seen.
 */
export async function getMessages(
  chatId: number,
  messageIds: readonly number[],
): Promise<TdResult<(TdMessage | null)[]>> {
  const out: (TdMessage | null)[] = [];
  for (let i = 0; i < messageIds.length; i += MESSAGES_BATCH_SIZE) {
    const ids = messageIds.slice(i, i + MESSAGES_BATCH_SIZE);
    const res = await call((td) => td.getMessagesCompat(chatId, ids));
    if (!res.ok) return res;
    const batch = parseRaw<TdMessages>(res.value, "messages");
    if (!batch.ok) return batch;
    // TDLib gives one entry for each id. Pad, so a short reply cannot shift the order.
    for (let j = 0; j < ids.length; j++)
      out.push(batch.value.messages[j] ?? null);
  }
  return { ok: true, value: out };
}
