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
