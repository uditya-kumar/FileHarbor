import { Stack } from "expo-router";

import { Layout } from "@/constants/Layout";
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
      <Stack.Screen
        name="index"
        options={{ title: "Folders", headerLargeTitle: true }}
      />
      {/* An Android form sheet has no header and no grabber. The title and the grabber are
          in the content (CLAUDE.md §5). */}
      <Stack.Screen
        name="new/index"
        options={{
          presentation: "formSheet",
          headerShown: false,
          sheetAllowedDetents: "fitToContents",
          sheetCornerRadius: Layout.sheet.radius,
          sheetGrabberVisible: true,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
      <Stack.Screen
        name="[folderId]/[messageId]/index"
        options={{
          presentation: "formSheet",
          headerShown: false,
          sheetAllowedDetents: "fitToContents",
          sheetCornerRadius: Layout.sheet.radius,
          sheetGrabberVisible: true,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </Stack>
  );
}
