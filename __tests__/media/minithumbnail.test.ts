import { bytesToBase64, minithumbnailUri } from "@/media/minithumbnail";

// Buffer is the Node reference encoder; the app has no Buffer.
const reference = (bytes: number[]): string =>
  Buffer.from(bytes.map((b) => b & 0xff)).toString("base64");

describe("bytesToBase64", () => {
  it("pads to a multiple of 4", () => {
    expect(bytesToBase64([77])).toBe("TQ==");
    expect(bytesToBase64([77, 97])).toBe("TWE=");
    expect(bytesToBase64([77, 97, 110])).toBe("TWFu");
    expect(bytesToBase64([])).toBe("");
  });

  it("reads signed ints as bytes (-1 is 0xFF)", () => {
    expect(bytesToBase64([-1, -1, -1])).toBe("////");
    // A JPEG starts FF D8 FF E0.
    expect(bytesToBase64([-1, -40, -1, -32])).toBe(
      reference([255, 216, 255, 224]),
    );
  });

  it("matches the reference encoder on all byte values", () => {
    const bytes = Array.from({ length: 256 }, (_, i) => i - 128);
    expect(bytesToBase64(bytes)).toBe(reference(bytes));
  });
});

describe("minithumbnailUri", () => {
  it("gives a JPEG data URI", () => {
    expect(minithumbnailUri([-1, -40, -1])).toBe("data:image/jpeg;base64,/9j/");
  });

  it("takes a string as base64 already", () => {
    expect(minithumbnailUri("/9j/")).toBe("data:image/jpeg;base64,/9j/");
  });

  it("gives null with no data", () => {
    expect(minithumbnailUri(undefined)).toBeNull();
    expect(minithumbnailUri(null)).toBeNull();
    expect(minithumbnailUri([])).toBeNull();
    expect(minithumbnailUri("")).toBeNull();
  });
});
