// App types. Screens, hooks, and components use these only — never TDLib shapes.

export type ServiceErrorKind =
  /** Telegram flood limit. Show with warn tones, never danger (CLAUDE.md §6). */
  | "rate_limited"
  /** TDLib is not linked or not started. */
  | "unavailable"
  | "failed";

export type ServiceError = {
  kind: ServiceErrorKind;
  /** The Telegram error code, e.g. "PHONE_CODE_INVALID". Map it to text in the hook. */
  code: string;
  /** Seconds to wait. Set only when kind is "rate_limited". */
  retryAfter?: number;
};

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: ServiceError };

export type CodeDelivery = "telegram" | "sms" | "call" | "other";

export type AuthStep =
  | { step: "starting" }
  | { step: "phone" }
  | {
      step: "code";
      /** Digits only, as Telegram gives it, e.g. "919876543210". */
      phone: string;
      /** 0 when unknown (state read after a JS reload). */
      codeLength: number;
      delivery: CodeDelivery;
      /** Seconds until a new code can be requested. */
      resendAfter: number;
      canResend: boolean;
    }
  | { step: "password"; hint: string }
  | { step: "ready" }
  | { step: "loggingOut" }
  /** A state the app does not handle, e.g. email login or new-account registration. */
  | { step: "unsupported"; state: string }
  | { step: "unavailable"; error: ServiceError };

/** One file in a folder: a row of the local dir_index (spec §5). */
export type IndexedFile = {
  messageId: number;
  /** The folder from the caption, e.g. "Holiday/Beach". The root is "" (format/caption.ts). */
  dirPath: string;
  /** The file name from the caption. */
  name: string;
  /** Unix seconds. */
  date: number;
};

/** One folder path in dir_index and its file count. */
export type DirSummary = { dirPath: string; fileCount: number };

/** A FileHarbor caption that the sync did not index. The sync report shows it (TaskList 5.7). */
export type SyncSkip = {
  messageId: number;
  caption: string;
  reason:
    /** The caption has the FileHarbor prefix but does not parse. */
    | "bad_caption"
    /** The caption parses, but the message is not a document (e.g. a photo or a video). */
    | "not_document";
};

export type SyncReport = {
  /** All messages in Saved Messages. */
  scanned: number;
  indexed: number;
  /** Messages with no FileHarbor caption (notes, files from other apps). Not an error. */
  other: number;
  skipped: SyncSkip[];
};
