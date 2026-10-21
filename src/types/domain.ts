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

export type ServiceResult<T> =
  { ok: true; value: T } | { ok: false; error: ServiceError };

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
  /** Bytes. 0 when Telegram does not give the size. */
  size: number;
  /** From Telegram, e.g. "image/jpeg". "" when unknown. */
  mimeType: string;
};

/** How the app shows a file (spec §8.5): photo → expo-image, video → expo-video, other → sheet 11. */
export type MediaKind = "photo" | "video" | "other";

/** A file in a folder screen (07): the cached row plus its current Telegram file data. */
export type FolderFile = IndexedFile & {
  kind: MediaKind;
  /** The handle for a download. It is valid until the app restarts; each folder open reads it again. */
  fileId: number;
  /** A file:// URI when the whole file is on the device. */
  localUri: string | null;
  /** The 320 px thumbnail. null when the upload had no thumbnail. */
  thumbnailFileId: number | null;
  /** A file:// URI when the thumbnail is on the device. */
  thumbnailUri: string | null;
  /** A data URI of the ~40 px image in the message. It shows before the thumbnail. */
  placeholderUri: string | null;
};

/** The download state of one file (09, 10, and later the Downloads tab). */
export type FileProgress = {
  /** Bytes on the device. */
  downloaded: number;
  /** Bytes. 0 when unknown. */
  size: number;
  /** A file:// URI when the whole file is on the device. */
  localUri: string | null;
};

/** A file that the user picked to upload (07 upload button). */
export type UploadSource = {
  /** A file:// URI that TDLib can read. */
  uri: string;
  /** The name for the caption, from the gallery. */
  name: string;
  mimeType: string;
  /** Bytes. 0 when unknown. */
  size: number;
  kind: MediaKind;
  /** True for a copy in the app cache: it is deleted after the upload. */
  temporary: boolean;
};

/** The upload state of one file: bytes on Telegram's servers. */
export type UploadProgress = { uploaded: number; size: number };

/**
 * A file in the Downloads tab (12). "paused": the user stopped it; the parts on the device
 * stay. "failed": TDLib gave an error; the user can start it again.
 */
/** "saving": the whole file is on the device, and it goes into the gallery now. */
export type DownloadStatus =
  "queued" | "downloading" | "saving" | "paused" | "failed";

/**
 * One file in the Downloads list. It leaves the list when the whole file is on the device, and
 * a photo or a video is in the gallery too.
 */
export type DownloadItem = {
  fileId: number;
  messageId: number;
  dirPath: string;
  name: string;
  kind: MediaKind;
  /** Bytes. 0 when unknown. */
  size: number;
  thumbnailUri: string | null;
  placeholderUri: string | null;
  status: DownloadStatus;
  /** Bytes on the device. */
  downloaded: number;
  /** null until the speed has a first measure, and when the file does not download. */
  bytesPerSecond: number | null;
  /** Set only when the status is "failed". */
  error: ServiceError | null;
  /** The step that failed: the Telegram download, or the save in the gallery. */
  errorStep: "download" | "save";
};

/** Access to the phone gallery. "blocked": Android does not show the prompt again. */
export type MediaAccess = "granted" | "undetermined" | "denied" | "blocked";

/** A folder on the device that the user picked to save a file in (sheet 11). */
export type SaveFolder = {
  /** A content:// URI. */
  uri: string;
  /** The folder name to show, e.g. "Download". */
  name: string;
};

/** One folder path in dir_index: the files directly in it. */
export type DirSummary = {
  dirPath: string;
  fileCount: number;
  totalSize: number;
  /** Files with an image or video MIME type. */
  mediaCount: number;
};

/**
 * One folder in a list (04): its counts cover all the folders inside it. A folder with no file
 * is on this device only, until its first upload writes its name into a caption (spec §1).
 */
export type FolderSummary = {
  dirPath: string;
  name: string;
  fileCount: number;
  totalSize: number;
  mediaCount: number;
};

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
