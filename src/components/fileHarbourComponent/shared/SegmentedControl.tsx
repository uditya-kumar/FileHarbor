import { Pressable, StyleSheet, Text, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

type Option<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  options: readonly Option<K>[];
  value: K;
  onChange: (key: K) => void;
};

// The switch at the top of a page (12–14 Downloads / Uploads). It has the page padding.
export function SegmentedControl<K extends string>({
  options,
  value,
  onChange,
}: Props<K>) {
  const { colors } = useColorScheme();

  return (
    <View style={styles.bar}>
      <View
        accessibilityRole="tablist"
        style={[styles.track, { backgroundColor: colors.bgSunken }]}
      >
        {options.map((option) => {
          const selected = option.key === value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={selected ? undefined : () => onChange(option.key)}
              style={[styles.item, selected && { backgroundColor: colors.bg }]}
            >
              <Text
                style={[
                  styles.label,
                  selected
                    ? { color: colors.textPrimary, fontWeight: "600" }
                    : { color: colors.textSecondary, fontWeight: "500" },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: Layout.pad, paddingTop: Layout.segmented.top },
  track: {
    flexDirection: "row",
    height: Layout.segmented.height,
    padding: Layout.segmented.pad,
    gap: Layout.segmented.gap,
    borderRadius: Layout.segmented.radius,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Layout.segmented.itemRadius,
  },
  label: { fontSize: 13 },
});
