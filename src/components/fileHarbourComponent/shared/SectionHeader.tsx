import { StyleSheet, Text, View } from "react-native";

import { useColorScheme } from "@/hooks/useColorScheme";

type Props = {
  title: string;
  /** A second line, e.g. the 12 "2 active · 1 finished". */
  subtitle?: string;
  /** "sheet" is the heading of a form sheet (06), which has no native header. */
  level?: "section" | "sheet";
};

// The line above a list (04 "4 Folders · 14.2 GB") or the title of a sheet (06).
export function SectionHeader({ title, subtitle, level = "section" }: Props) {
  const { colors } = useColorScheme();

  return (
    <View style={styles.block}>
      <Text
        accessibilityRole="header"
        style={[
          level === "sheet" ? styles.sheet : styles.title,
          { color: colors.textPrimary },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 2 },
  title: { fontSize: 16, fontWeight: "700" },
  sheet: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 12 },
});
