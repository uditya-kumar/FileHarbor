// The only file with colour literals (CLAUDE.md §6). Light values come from Design.pen.
// Dark values are not in the design; check their contrast on device and change them here only.

const viewer = {
  viewerBg: "#0E0E0E",
  viewerSurface: "#1A1A1A",
  viewerBorder: "#2A2A2A",
  viewerText: "#F5F5F5",
  viewerTextSecondary: "#A3A3A0",
} as const;

const light = {
  bg: "#FFFFFF",
  bgMuted: "#F7F7F5",
  bgSunken: "#F1F1EF",
  border: "#E9E9E6",
  borderStrong: "#DBDBD7",
  textPrimary: "#191918",
  textSecondary: "#6F6F6B",
  textTertiary: "#9C9C98",
  accent: "#2383E2",
  accentSoft: "#EDF4FD",
  onAccent: "#FFFFFF",
  success: "#2E7D4F",
  warn: "#B26B00",
  warnSoft: "#FBF3E7",
  danger: "#D1453B",
  ...viewer,
};

export type ColorTokens = typeof light;
export type ColorScheme = "light" | "dark";

const dark: ColorTokens = {
  bg: "#1B1B1A",
  bgMuted: "#242423",
  bgSunken: "#151514",
  border: "#2F2F2D",
  borderStrong: "#3D3D3A",
  textPrimary: "#F1F1EF",
  textSecondary: "#A3A3A0",
  textTertiary: "#74746F",
  accent: "#4C9AEA",
  accentSoft: "#16263A",
  onAccent: "#FFFFFF",
  success: "#4CAF75",
  warn: "#D9933A",
  warnSoft: "#30250F",
  danger: "#E5574D",
  ...viewer,
};

export const Colors: Record<ColorScheme, ColorTokens> = { light, dark };
