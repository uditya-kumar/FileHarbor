// Caption format (spec §1). Each file message holds its folder path and its file name:
//
//   fileharbor:1:{"path":["Holiday","Beach"],"name":"IMG_001.jpg"}
//
// The captions are the only record of the folder tree. There is no manifest and no folder
// database, so a fresh install rebuilds the tree from the captions alone (spec §1 order 3).
// "1" is the format version. After the first real upload, change the format only with a new
// version, and keep the parser for each old version: a sent caption cannot be changed in bulk.
//
// The path is a JSON array, so a name needs no escape rules of our own. Inside the app a
// folder is a dir path: the folder names from the root down, joined with "/". The root is "".

export const ROOT_DIR_PATH = "";

const PREFIX = "fileharbor:1:";
const SEPARATOR = "/";
// Telegram's caption limit for an account without Premium.
export const MAX_CAPTION_LENGTH = 1024;
export const MAX_NAME_LENGTH = 255;

// C0 and C1 control characters. Telegram can change or remove them, so a name cannot hold them.
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/;

// A surrogate that is not part of a pair is not valid text, and JSON and Telegram do not keep
// it the same. A loop, not a regex: Hermes support for lookbehind is not certain.
function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export type FileCaption = {
  /** The folder of the file, e.g. "Holiday/Beach". The root is "". */
  dirPath: string;
  /** The file name that the app shows. */
  name: string;
};

export type CaptionParseError =
  /** The caption is not a FileHarbor caption (a note, or a caption from another app). */
  | "not_fileharbor"
  /** The caption starts with the FileHarbor prefix, but the rest is not a valid caption. */
  | "bad_caption";

export type CaptionSerialiseError =
  /** A folder name or the file name is not valid (see isValidName). */
  | "bad_name"
  /** The caption is longer than MAX_CAPTION_LENGTH. */
  | "too_long";

export type ParsedCaption =
  { ok: true; value: FileCaption } | { ok: false; error: CaptionParseError };

export type SerialisedCaption =
  { ok: true; caption: string } | { ok: false; error: CaptionSerialiseError };

/**
 * A folder name or a file name: 1 to MAX_NAME_LENGTH characters, no "/", no control
 * character, no space at the start or the end, and not "." or "..".
 */
export function isValidName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= MAX_NAME_LENGTH &&
    name === name.trim() &&
    name !== "." &&
    name !== ".." &&
    !name.includes(SEPARATOR) &&
    !CONTROL.test(name) &&
    !hasLoneSurrogate(name)
  );
}

/** The folder names from the root down, e.g. "Holiday/Beach" → ["Holiday", "Beach"]. */
export function dirSegments(dirPath: string): string[] {
  return dirPath === ROOT_DIR_PATH ? [] : dirPath.split(SEPARATOR);
}

export function isDirPath(dirPath: string): boolean {
  return dirSegments(dirPath).every(isValidName);
}

/** The path of the folder that holds `dirPath`, or null for the root. */
export function parentDirPath(dirPath: string): string | null {
  if (dirPath === ROOT_DIR_PATH) return null;
  const cut = dirPath.lastIndexOf(SEPARATOR);
  return cut === -1 ? ROOT_DIR_PATH : dirPath.slice(0, cut);
}

/** The path of the folder `name` in `parent`, or null when the result is not a dir path. */
export function childDirPath(parent: string, name: string): string | null {
  if (!isDirPath(parent) || !isValidName(name)) return null;
  return parent === ROOT_DIR_PATH ? name : `${parent}${SEPARATOR}${name}`;
}

/** Makes the caption for a file. A bad name gives an error, so no bad caption is sent. */
export function serialiseCaption(file: FileCaption): SerialisedCaption {
  if (!isDirPath(file.dirPath) || !isValidName(file.name))
    return { ok: false, error: "bad_name" };
  // Fixed key order, so the same file always gives the same caption.
  const caption =
    PREFIX +
    JSON.stringify({ path: dirSegments(file.dirPath), name: file.name });
  return caption.length <= MAX_CAPTION_LENGTH
    ? { ok: true, caption }
    : { ok: false, error: "too_long" };
}

/**
 * Gets the folder and the file name from a caption. The JSON can have spaces and unknown
 * keys, so a later app version can add a key to version 1 and this parser still reads it.
 */
export function parseCaption(caption: string): ParsedCaption {
  if (!caption.startsWith(PREFIX))
    return { ok: false, error: "not_fileharbor" };
  let data: unknown;
  try {
    data = JSON.parse(caption.slice(PREFIX.length));
  } catch {
    return { ok: false, error: "bad_caption" };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, error: "bad_caption" };
  }
  const { path, name } = data as { path?: unknown; name?: unknown };
  if (
    !Array.isArray(path) ||
    !path.every((s): s is string => typeof s === "string" && isValidName(s)) ||
    typeof name !== "string" ||
    !isValidName(name)
  ) {
    return { ok: false, error: "bad_caption" };
  }
  return { ok: true, value: { dirPath: path.join(SEPARATOR), name } };
}
