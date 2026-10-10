import { Stack } from "expo-router";

import { useColorScheme } from "@/hooks/useColorScheme";

export const unstable_settings = {
  anchor: "phone/index",
};

export default function AuthLayout() {
  const { colors } = useColorScheme();

  return (
    <Stack
      screenOptions={{
        title: "",
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        headerTintColor: colors.textPrimary,
        headerStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="phone/index" options={{ headerShown: false }} />
      <Stack.Screen name="code/index" />
      <Stack.Screen name="password/index" />
    </Stack>
  );
}
