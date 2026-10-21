import { createHash, randomBytes } from "crypto";
import { digest } from "expo-crypto";

import { Sha256, sha256File } from "@/media/hash";

// The reference is Node's crypto. expo-file-system is mocked: a test sets the file size and
// the parts that readBytes gives.
const mockFile: {
  size: number;
  bytes: Uint8Array;
  parts: Uint8Array[];
  closed: boolean;
  fail: boolean;
} = { size: 0, bytes: new Uint8Array(), parts: [], closed: false, fail: false };

jest.mock("expo-file-system", () => ({
  File: class {
    constructor() {
      if (mockFile.fail) throw new Error("no file");
    }
    get size(): number {
      return mockFile.size;
    }
    async bytes(): Promise<Uint8Array> {
      return mockFile.bytes;
    }
    open() {
      return {
        readBytes: () => mockFile.parts.shift() ?? new Uint8Array(),
        close: () => {
          mockFile.closed = true;
        },
      };
    }
  },
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digest: jest.fn(async (_: string, data: Uint8Array) => {
    const out = require("crypto").createHash("sha256").update(data).digest();
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.length);
  }),
}));

const node = (data: Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");

beforeEach(() => {
  mockFile.size = 0;
  mockFile.bytes = new Uint8Array();
  mockFile.parts = [];
  mockFile.closed = false;
  mockFile.fail = false;
  jest.clearAllMocks();
});

describe("Sha256", () => {
  it("gives the FIPS 180-4 values for the empty input and 'abc'", () => {
    expect(new Sha256().hex()).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(new Sha256().update(new TextEncoder().encode("abc")).hex()).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is correct at each length near the padding edge", () => {
    for (const length of [1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129]) {
      const data = randomBytes(length);
      expect(new Sha256().update(data).hex()).toBe(node(data));
    }
  });

  it("gives the same digest for any split of the input", () => {
    const data = randomBytes(300_000);
    for (const cuts of [[1], [63, 64, 65], [4096, 70_001], [299_999]]) {
      const hash = new Sha256();
      let from = 0;
      for (const cut of cuts) {
        hash.update(data.subarray(from, cut));
        from = cut;
      }
      hash.update(data.subarray(from));
      expect(hash.hex()).toBe(node(data));
    }
  });
});

describe("sha256File", () => {
  it("hashes a small file at once, with expo-crypto", async () => {
    const data = randomBytes(5000);
    mockFile.size = data.length;
    mockFile.bytes = data;
    await expect(sha256File("file:///x.jpg")).resolves.toEqual({
      ok: true,
      value: node(data),
    });
    expect(digest).toHaveBeenCalledTimes(1);
  });

  it("hashes a large file in parts, and closes it", async () => {
    const data = randomBytes(9000);
    // The size says "larger than 64 MB", so the parts path runs on a small buffer.
    mockFile.size = 64 * 1024 * 1024 + 1;
    mockFile.parts = [data.subarray(0, 4000), data.subarray(4000)];
    await expect(sha256File("file:///big.mp4")).resolves.toEqual({
      ok: true,
      value: node(data),
    });
    expect(digest).not.toHaveBeenCalled();
    expect(mockFile.closed).toBe(true);
  });

  it("gives an error result for a file that cannot be read", async () => {
    mockFile.fail = true;
    await expect(sha256File("file:///gone.jpg")).resolves.toEqual({
      ok: false,
      error: { kind: "failed", code: "HASH_FAILED" },
    });
  });
});
