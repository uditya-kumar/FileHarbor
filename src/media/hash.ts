import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { File } from "expo-file-system";

import type { ServiceResult } from "@/types/domain";

// SHA-256 of a file, for the upload dedupe (spec §5, queue order 4). expo-crypto 57 hashes one
// buffer only, with no streaming API (SDK 57 docs). A file up to WHOLE_MAX goes to it at once:
// native and fast, for photos and short videos. A larger file (a long video, up to 2 GB) goes
// through the JS hash below in parts, so the memory use does not grow with the file.

/** The largest file that is read into memory at once. */
const WHOLE_MAX = 64 * 1024 * 1024;
/** One read of a large file. */
const PART = 4 * 1024 * 1024;

// FIPS 180-4 §4.2.2: the first 32 bits of the fractional parts of the cube roots of the
// first 64 primes.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** An incremental SHA-256 (FIPS 180-4). `update` any number of times, then `hex` once. */
export class Sha256 {
  private readonly h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  private readonly w = new Uint32Array(64);
  /** The bytes that do not fill a 64-byte block yet. */
  private readonly block = new Uint8Array(64);
  private blockLength = 0;
  private total = 0;

  update(data: Uint8Array): this {
    this.total += data.length;
    let i = 0;
    if (this.blockLength > 0) {
      const take = Math.min(64 - this.blockLength, data.length);
      this.block.set(data.subarray(0, take), this.blockLength);
      this.blockLength += take;
      i = take;
      if (this.blockLength < 64) return this;
      this.compress(this.block, 0);
      this.blockLength = 0;
    }
    for (; i + 64 <= data.length; i += 64) this.compress(data, i);
    if (i < data.length) {
      this.block.set(data.subarray(i), 0);
      this.blockLength = data.length - i;
    }
    return this;
  }

  /** The digest as 64 lowercase hex digits. The hash cannot take more data after this. */
  hex(): string {
    // Padding: 0x80, zeros, then the length in bits as a 64-bit big-endian number.
    const padded = new Uint8Array(this.blockLength < 56 ? 64 : 128);
    padded.set(this.block.subarray(0, this.blockLength));
    padded[this.blockLength] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(this.total / 0x20000000));
    view.setUint32(padded.length - 4, (this.total * 8) >>> 0);
    for (let o = 0; o < padded.length; o += 64) this.compress(padded, o);
    return Array.from(this.h, (x) => x.toString(16).padStart(8, "0")).join("");
  }

  private compress(data: Uint8Array, offset: number): void {
    const { w, h } = this;
    for (let t = 0; t < 16; t++) {
      const j = offset + t * 4;
      w[t] =
        (data[j] << 24) |
        (data[j + 1] << 16) |
        (data[j + 2] << 8) |
        data[j + 3];
    }
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15];
      const y = w[t - 2];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const t1 =
        (hh +
          (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) +
          ((e & f) ^ (~e & g)) +
          K[t] +
          w[t]) |
        0;
      const t2 =
        ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) +
          ((a & b) ^ (a & c) ^ (b & c))) |
        0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
}

function hexOf(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}

/** Lets the UI draw between two parts of a large file. */
const nextTick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

/** The SHA-256 of the file at `uri`, as 64 lowercase hex digits. */
export async function sha256File(uri: string): Promise<ServiceResult<string>> {
  try {
    const file = new File(uri);
    const size = file.size;
    if (size <= WHOLE_MAX) {
      const bytes = await file.bytes();
      return {
        ok: true,
        value: hexOf(await digest(CryptoDigestAlgorithm.SHA256, bytes)),
      };
    }
    const hash = new Sha256();
    const handle = file.open();
    try {
      for (let read = 0; read < size;) {
        const part = handle.readBytes(PART);
        if (part.length === 0) break;
        hash.update(part);
        read += part.length;
        await nextTick();
      }
    } finally {
      handle.close();
    }
    return { ok: true, value: hash.hex() };
  } catch {
    return { ok: false, error: { kind: "failed", code: "HASH_FAILED" } };
  }
}
