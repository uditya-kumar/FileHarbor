// The minithumbnail is a ~40 px JPEG inside the message, so it shows with no network (spec §8.1).
// The binding gives its bytes as a JSON array of signed ints (-128..127), not base64 (spec §8.2).

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Standard base64 with padding. Each value is read as one byte, so -1 is 0xFF. */
export function bytesToBase64(bytes: readonly number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] & 0xff;
    const b = i + 1 < bytes.length ? bytes[i + 1] & 0xff : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] & 0xff : 0;
    const n = (a << 16) | (b << 8) | c;
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : "=";
  }
  return out;
}

/** A data URI for expo-image, or null when there is no data. A string is taken as base64. */
export function minithumbnailUri(
  data: readonly number[] | string | null | undefined,
): string | null {
  if (data == null || data.length === 0) return null;
  const base64 = typeof data === "string" ? data : bytesToBase64(data);
  return `data:image/jpeg;base64,${base64}`;
}
