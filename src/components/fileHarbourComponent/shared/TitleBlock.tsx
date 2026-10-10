import { StyleSheet, Text, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

import { Icon, type IconName } from "./Icon";

type Props = {
  title: string;
  body?: string;
  /** Shown in an accent tile above the heading (01). */
  icon?: IconName;
};

export function TitleBlock({ title, body, icon }: Props) {
  const { colors } = useColorScheme();

  return (
    <View style={styles.block}>
      {icon ? (
        <View style={[styles.mark, { backgroundColor: colors.accentSoft }]}>
          <Icon name={icon} size={26} color={colors.accent} />
        </View>
      ) : null}
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {body ? <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Layout.section.gap },
  mark: {
    width: 54,
    height: 54,
    borderRadius: Layout.radius.mark,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { gap: Layout.section.headingGap },
  title: { fontSize: 27, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20 },
});
