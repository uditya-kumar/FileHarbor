import { StyleSheet, Text, View } from "react-native";

import type { ColorTokens } from "@/constants/Colors";
import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

import { Icon, type IconName } from "./Icon";

type Tone = "info" | "warn" | "danger" | "success";

type Props = {
  text: string;
  icon: IconName;
  tone?: Tone;
};

// flood_wait uses "warn", never "danger": red makes users retry (spec §5.2).
function toneColors(
  tone: Tone,
  colors: ColorTokens,
): { bg: string; fg: string } {
  switch (tone) {
    case "info":
      return { bg: colors.bgMuted, fg: colors.textSecondary };
    case "warn":
      return { bg: colors.warnSoft, fg: colors.warn };
    case "danger":
      return { bg: colors.bgMuted, fg: colors.danger };
    case "success":
      return { bg: colors.bgMuted, fg: colors.success };
  }
}

export function Banner({ text, icon, tone = "info" }: Props) {
  const { colors } = useColorScheme();
  const { bg, fg } = toneColors(tone, colors);

  return (
    <View
      accessible
      accessibilityRole={
        tone === "danger" || tone === "warn" ? "alert" : undefined
      }
      style={[styles.banner, { backgroundColor: bg }]}
    >
      <Icon name={icon} size={15} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 13,
    gap: 10,
    borderRadius: Layout.radius.banner,
  },
  text: { flex: 1, fontSize: 12, lineHeight: 17 },
});
