import { Stack } from "expo-router";

import { useColorScheme } from "@/hooks/useColorScheme";

export const unstable_settings = {
  anchor: "index",
};

export default function FoldersLayout() {
  const { colors } = useColorScheme();

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.textPrimary,
        headerStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Folders", headerLargeTitle: true }} />
    </Stack>
  );
}
