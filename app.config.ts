import type { ConfigContext, ExpoConfig } from "expo/config";

// api_id / api_hash identify the app, not the user; shipping them in the bundle is the
// accepted MTProto-client tradeoff (spec §3.4). Set them in `.env.local`.
const telegramApiId = Number(process.env.TELEGRAM_API_ID ?? 0);
const telegramApiHash = process.env.TELEGRAM_API_HASH ?? "";

// Plain Node cannot import src/ (CLAUDE.md §9). Keep equal to Colors.light.bg / Colors.dark.bg.
const nativeBgLight = "#FFFFFF";
const nativeBgDark = "#1B1B1A";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "FileHarbor",
  slug: "FileHarbor",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "fileharbor",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.fileharbor.app",
  },
  android: {
    package: "com.fileharbor.app",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: nativeBgLight,
    },
    // The TDLib database is unencrypted in filesDir (spec §3.2.4). Keep it off backups.
    allowBackup: false,
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: nativeBgLight,
        dark: { backgroundColor: nativeBgDark },
      },
    ],
    "expo-status-bar",
    "expo-image",
    "expo-video",
    "expo-sqlite",
    "expo-secure-store",
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
    reactCompiler: true,
  },
  extra: {
    telegram: {
      apiId: telegramApiId,
      apiHash: telegramApiHash,
    },
  },
});
