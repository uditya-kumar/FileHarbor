import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Button } from "@components/fileHarbourComponent/shared/Button";
import type { IconName } from "@components/fileHarbourComponent/shared/Icon";

export type ViewerAction = {
  key: string;
  icon: IconName;
  /** "Share" */
  label: string;
  /** Red, for Delete. */
  destructive?: boolean;
  /** Not set: the action shows disabled. */
  onPress?: () => void;
};

type Props = {
  actions: readonly ViewerAction[];
  /** Above the actions: the 09 caption and filmstrip, or the 10 scrubber. */
  children?: ReactNode;
};

const noop = (): void => {};

// The 09 and 10 bottom bar. It sits over the bottom of the photo or video, so the photo keeps
// the full screen and the bar can hide on a tap. Not shared/: it is an in-screen action bar
// in the viewer colours, not navigation (CLAUDE.md §3).
export function ViewerActionRow({ actions, children }: Props) {
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.viewerBg,
          paddingBottom: Math.max(
            Layout.viewer.barBottom,
            insets.bottom + Layout.screen.footerInsetExtra,
          ),
        },
      ]}
    >
      {children}
      <View style={styles.row}>
        {actions.map((a) => (
          <Button
            key={a.key}
            variant={a.destructive ? "viewerDestructive" : "viewer"}
            iconPosition="top"
            icon={a.icon}
            label={a.label}
            onPress={a.onPress ?? noop}
            disabled={!a.onPress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Layout.viewer.barTop,
    gap: Layout.viewer.barGap,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Layout.viewer.actionsPadX,
  },
});
