import { StyleSheet, Text, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

type Props = {
  /** "IMG_4821.HEIC" */
  name: string;
  /** "12 Aug 2024 · 4032 × 3024 · 8.4 MB" */
  meta: string;
};

// The 09 caption over the filmstrip. Not shared/: only the dark viewer shows a centred name
// with a meta line, in the viewer colours.
export function ViewerFileMeta({ name, meta }: Props) {
  const { colors } = useColorScheme();

  return (
    <View style={styles.caption}>
      <Text
        numberOfLines={1}
        ellipsizeMode="middle"
        style={[styles.name, { color: colors.viewerText }]}
      >
        {name}
      </Text>
      {/* Two lines: a save notice can be longer than the date and size. */}
      <Text
        numberOfLines={2}
        style={[styles.meta, { color: colors.viewerTextSecondary }]}
      >
        {meta}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    alignItems: "center",
    gap: Layout.viewer.captionGap,
    paddingHorizontal: Layout.pad,
  },
  name: { fontSize: 13, fontWeight: "500" },
  meta: { fontSize: 11 },
});
