// Display text for sizes and counts. Hooks build the strings; UI files only show them
// (CLAUDE.md §3).

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Base 1024, one decimal below 100 and no ".0", e.g. "2.4 GB", "6 MB", "300 MB", "0 B". */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits).replace(/\.0$/, "")} ${UNITS[unit]}`;
}

/** "1 Folder", "3 Folders". */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Unix seconds to the 09 date, "12 Aug 2024", in the device time zone. */
export function formatDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Seconds to the 10 play time: "0:12", "12:05", "1:02:03". */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
