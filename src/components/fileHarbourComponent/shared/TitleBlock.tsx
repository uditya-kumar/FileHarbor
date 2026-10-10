import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

import { Icon, type IconName } from "./Icon";

type Props = {
  title: string;
  body?: string;
  /** "left": an accent tile above the heading (01). "center": a muted circle (05). */
  icon?: IconName;
  /** "left" is a page heading (01–03). "center" is an empty state in the free space (05). */
  align?: "left" | "center";
  /** Shown under the text, e.g. the 05 "New folder" button. */
  action?: ReactNode;
};

export function TitleBlock({
  title,
  body,
  icon,
  align = "left",
  action,
}: Props) {
  const { colors } = useColorScheme();
  const center = align === "center";

  return (
    <View style={center ? styles.blockCenter : styles.block}>
      {icon ? (
        <View
          style={[
            center ? styles.circle : styles.mark,
            // The 05 circle is bgMuted on a bgMuted page in Design.pen, so it does not show.
            // bgSunken matches the 04 row icon tiles.
            { backgroundColor: center ? colors.bgSunken : colors.accentSoft },
          ]}
        >
          <Icon
            name={icon}
            size={center ? 28 : 26}
            color={center ? colors.textTertiary : colors.accent}
          />
        </View>
      ) : null}
      <View style={center ? styles.headingCenter : styles.heading}>
        <Text
          accessibilityRole="header"
          style={[
            center ? styles.titleCenter : styles.title,
            { color: colors.textPrimary },
          ]}
        >
          {title}
        </Text>
        {body ? (
          <Text
            style={[
              center ? styles.bodyCenter : styles.body,
              { color: colors.textSecondary },
            ]}
          >
            {body}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: Layout.section.gap },
  blockCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Layout.empty.padX,
    gap: Layout.empty.gap,
  },
  mark: {
    width: 54,
    height: 54,
    borderRadius: Layout.radius.mark,
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    width: Layout.empty.mark,
    height: Layout.empty.mark,
    borderRadius: Layout.empty.mark / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { gap: Layout.section.headingGap },
  headingCenter: { gap: Layout.empty.copyGap, alignItems: "center" },
  title: { fontSize: 27, fontWeight: "700" },
  titleCenter: { fontSize: 17, fontWeight: "600", textAlign: "center" },
  body: { fontSize: 14, lineHeight: 20 },
  bodyCenter: { fontSize: 13, lineHeight: 19, textAlign: "center" },
});
