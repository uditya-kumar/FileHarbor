import { Stack } from "expo-router";

import { useColorScheme } from "@/hooks/useColorScheme";

export const unstable_settings = {
  anchor: "downloads/index",
};

export default function TransfersLayout() {
  const { colors } = useColorScheme();

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* 12 and 13 are one page with a switch (Downloads / Uploads), so the switch replaces
          the screen with no animation. */}
      <Stack.Screen
        name="downloads/index"
        options={{ title: "Transfers", animation: "none" }}
      />
      <Stack.Screen
        name="uploads/index"
        options={{ title: "Transfers", animation: "none" }}
      />
    </Stack>
  );
}
