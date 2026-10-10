// TDLib JSON shapes as the binding emits them: snake_case fields plus "@type"
// (react-native-tdlib TdLibJson.GSON). Only the fields the app reads are typed.
// App types are in src/types/domain.ts.

export type TdObject = { "@type": string };

/** The `tdlib-update` event payload (spec §3). `raw` is the JSON of a TdApi.Object. */
export type TdLibUpdateEvent = { type: string; raw?: string };

// ---------- Errors ----------

export type TdErrorKind =
  /** "Too Many Requests: retry after X" or FLOOD_WAIT_X (spec §10). */
  | "flood_wait"
  /** The native module is not linked (Patch 1, spec §3.3) or the client is not started. */
  | "not_ready"
  | "tdlib";

export type TdError = {
  kind: TdErrorKind;
  /** The TDLib error message, e.g. "PHONE_CODE_INVALID". */
  message: string;
  /** Seconds to wait. Set only when kind is "flood_wait". */
  retryAfter?: number;
};

export type TdResult<T> = { ok: true; value: T } | { ok: false; error: TdError };

// ---------- Authorization ----------

export type TdAuthenticationCodeType = TdObject & {
  /** Absent for the types that do not use a digit code (e.g. flash call). */
  length?: number;
};

export type TdAuthenticationCodeInfo = {
  phone_number: string;
  type: TdAuthenticationCodeType;
  next_type?: TdAuthenticationCodeType | null;
  /** Seconds before resendAuthenticationCode is allowed. */
  timeout: number;
};

export type TdAuthorizationState =
  | { "@type": "authorizationStateWaitTdlibParameters" }
  | { "@type": "authorizationStateWaitPhoneNumber" }
  | { "@type": "authorizationStateWaitCode"; code_info?: TdAuthenticationCodeInfo }
  | {
      "@type": "authorizationStateWaitPassword";
      password_hint?: string;
      has_recovery_email_address?: boolean;
    }
  | { "@type": "authorizationStateWaitEmailAddress" }
  | { "@type": "authorizationStateWaitEmailCode" }
  | { "@type": "authorizationStateWaitOtherDeviceConfirmation" }
  | { "@type": "authorizationStateWaitRegistration" }
  | { "@type": "authorizationStateWaitPremiumPurchase" }
  | { "@type": "authorizationStateReady" }
  | { "@type": "authorizationStateLoggingOut" }
  | { "@type": "authorizationStateClosing" }
  | { "@type": "authorizationStateClosed" };

export type TdUpdateAuthorizationState = {
  "@type": "updateAuthorizationState";
  authorization_state: TdAuthorizationState;
};

// ---------- Users and chats ----------

export type TdUser = { "@type": "user"; id: number };

export type TdChat = { "@type": "chat"; id: number };

// ---------- Messages ----------

export type TdFormattedText = { "@type": "formattedText"; text: string };

export type TdFile = { "@type": "file"; id: number; size: number; expected_size: number };

export type TdDocument = {
  "@type": "document";
  file_name: string;
  mime_type: string;
  document: TdFile;
};

export type TdMessageDocument = {
  "@type": "messageDocument";
  document: TdDocument;
  caption: TdFormattedText;
};

export type TdMessage = {
  "@type": "message";
  id: number;
  chat_id: number;
  date: number;
  /** Present while the message is still being sent (temporary id). */
  sending_state?: TdObject | null;
  content: TdObject & Record<string, unknown>;
};

export type TdUpdateNewMessage = { "@type": "updateNewMessage"; message: TdMessage };

export type TdUpdateMessageSendSucceeded = {
  "@type": "updateMessageSendSucceeded";
  message: TdMessage;
  old_message_id: number;
};

export type TdUpdateMessageSendFailed = {
  "@type": "updateMessageSendFailed";
  message: TdMessage;
  old_message_id: number;
  error: { code: number; message: string };
};

/** Update types that `onUpdate` can type. Add an entry when a module reads a new update. */
export type TdUpdateMap = {
  updateAuthorizationState: TdUpdateAuthorizationState;
  updateNewMessage: TdUpdateNewMessage;
  updateMessageSendSucceeded: TdUpdateMessageSendSucceeded;
  updateMessageSendFailed: TdUpdateMessageSendFailed;
};
