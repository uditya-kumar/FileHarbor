import { useColorScheme } from "@/components/useColorScheme";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StrictMode, useEffect } from "react";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide the splash screen after the app is ready
    SplashScreen.hideAsync();
  }, []);

  return (
    <StrictMode>
      <RootLayoutNav />
    </StrictMode>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="message"
            options={{ presentation: "modal", title: "Message" }}
          />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
