import { Platform, StyleSheet, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

// An Android form sheet shows no native grabber (CLAUDE.md §5). On iOS,
// `sheetGrabberVisible` shows the native one, so this renders nothing.
export function SheetGrabber() {
  const { colors } = useColorScheme();
  if (Platform.OS === "ios") return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.grabber, { backgroundColor: colors.borderStrong }]}
    />
  );
}

const styles = StyleSheet.create({
  grabber: {
    alignSelf: "center",
    marginTop: Layout.sheet.top,
    width: Layout.sheet.grabberWidth,
    height: Layout.sheet.grabberHeight,
    borderRadius: Layout.sheet.grabberHeight / 2,
  },
});
