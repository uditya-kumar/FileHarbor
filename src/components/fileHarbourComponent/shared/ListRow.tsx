import { Pressable, StyleSheet, Text, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

import { Icon, type IconName } from "./Icon";

type Props = {
  title: string;
  /** One line under the title, e.g. "148 items · 2.4 GB". */
  subtitle?: string;
  /** Shown in a sunken tile before the text. */
  icon?: IconName;
  trailing?: "chevron" | "none";
  /** "card": a white card (04 folder row). "plain": no card and a larger muted tile (11 file). */
  variant?: "card" | "plain";
  onPress?: () => void;
};

// One row of an icon and text. Other trailing kinds come with the screens that need them.
export function ListRow({
  title,
  subtitle,
  icon,
  trailing = "none",
  variant = "card",
  onPress,
}: Props) {
  const { colors } = useColorScheme();
  const plain = variant === "plain";

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) =>
        plain
          ? styles.rowPlain
          : [
              styles.row,
              {
                backgroundColor: pressed ? colors.bgMuted : colors.bg,
                borderColor: colors.border,
              },
            ]
      }
    >
      {icon ? (
        <View
          style={[
            plain ? styles.tilePlain : styles.tile,
            { backgroundColor: plain ? colors.bgMuted : colors.bgSunken },
          ]}
        >
          <Icon
            name={icon}
            size={plain ? Layout.sheet.fileIcon : 19}
            color={colors.textSecondary}
          />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: colors.textPrimary }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: colors.textTertiary }]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing === "chevron" ? (
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Layout.list.rowPad,
    gap: Layout.list.rowGap,
    borderWidth: Layout.hairline,
    borderRadius: Layout.radius.card,
  },
  rowPlain: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.sheet.fileGap,
  },
  tile: {
    width: Layout.list.tile,
    height: Layout.list.tile,
    borderRadius: Layout.radius.banner,
    alignItems: "center",
    justifyContent: "center",
  },
  tilePlain: {
    width: Layout.sheet.fileTile,
    height: Layout.sheet.fileTile,
    borderRadius: Layout.radius.banner,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: Layout.list.textGap },
  title: { fontSize: 15, fontWeight: "600" },
  subtitle: { fontSize: 12 },
});
