import { formatBytes, formatClock, formatDate, plural } from "@/format/units";

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

describe("formatDate", () => {
  it("gives the 09 date in the device time zone", () => {
    const noon = new Date(2024, 7, 12, 12).getTime() / 1000;
    expect(formatDate(noon)).toBe("12 Aug 2024");
    expect(formatDate(new Date(2025, 0, 1, 0, 5).getTime() / 1000)).toBe(
      "1 Jan 2025",
    );
  });
});

describe("formatClock", () => {
  it("gives minutes and seconds, and hours only when needed", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(12.9)).toBe("0:12");
    expect(formatClock(725)).toBe("12:05");
    expect(formatClock(3723)).toBe("1:02:03");
  });

  it("gives 0:00 for a duration that is not known yet", () => {
    expect(formatClock(NaN)).toBe("0:00");
    expect(formatClock(-3)).toBe("0:00");
    expect(formatClock(Infinity)).toBe("0:00");
  });
});
