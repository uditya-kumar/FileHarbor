import { formatBytes, plural } from "@/format/units";

describe("formatBytes", () => {
  it("uses base 1024 with one decimal below 100", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(2.4 * 1024 ** 3)).toBe("2.4 GB");
    expect(formatBytes(300 * 1024 ** 2)).toBe("300 MB");
  });

  it('drops ".0"', () => {
    expect(formatBytes(6 * 1024 ** 2)).toBe("6 MB");
    expect(formatBytes(1024)).toBe("1 KB");
  });
});

describe("plural", () => {
  it("uses the singular for 1 only", () => {
    expect(plural(1, "item", "items")).toBe("1 item");
    expect(plural(0, "item", "items")).toBe("0 items");
    expect(plural(3, "item", "items")).toBe("3 items");
  });
});
