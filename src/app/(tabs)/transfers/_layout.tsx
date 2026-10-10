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
      <Stack.Screen name="downloads/index" options={{ title: "Downloads" }} />
      <Stack.Screen name="uploads/index" options={{ title: "Uploads" }} />
    </Stack>
  );
}
