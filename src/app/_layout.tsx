import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { StrictMode, useEffect } from "react";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAuthStep } from "@/hooks/useAuthFlow";
import { useColorScheme } from "@/hooks/useColorScheme";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  // index is the gate: a denied guard returns here, and the gate redirects again.
  anchor: "index",
};

const SPLASH_MAX_MS = 4000;

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <StrictMode>
      <RootLayoutNav />
    </StrictMode>
  );
}

function RootLayoutNav() {
  const { scheme, colors } = useColorScheme();
  const step = useAuthStep();
  const known = step.step !== "starting";
  // Only "ready" opens the tabs. Every other state belongs to the auth group, which shows the
  // unavailable and unsupported states on screen 01.
  const signedIn = step.step === "ready";

  // Keep the splash until TDLib reports a state, so a saved session never flashes 01.
  // The timeout makes sure that a stuck start shows 01 (with Continue loading), not a splash.
  useEffect(() => {
    if (known) {
      void SplashScreen.hideAsync();
      return;
    }
    const id = setTimeout(() => void SplashScreen.hideAsync(), SPLASH_MAX_MS);
    return () => clearTimeout(id);
  }, [known]);

  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.bg,
      card: colors.bg,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.danger,
    },
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerTintColor: colors.textPrimary,
            headerStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
