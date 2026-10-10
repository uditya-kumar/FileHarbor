import type { ReactNode } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

type Props = {
  children: ReactNode;
  /** Pinned to the bottom, above the keyboard (auth and sheet actions). */
  footer?: ReactNode;
  /** Small centred text under the footer. */
  footerNote?: string;
  /** Mirror of the Stack option. With no native header, the screen pads the status bar. */
  headerShown?: boolean;
};

export function Screen({ children, footer, footerNote, headerShown = true }: Props) {
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const hasFooter = footer != null;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.bg,
          paddingTop: headerShown ? 0 : insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* Edge-to-edge Android does not resize the window for the keyboard. */}
      <KeyboardAvoidingView style={styles.fill} behavior="padding" enabled={hasFooter}>
        <View style={styles.fill}>{children}</View>
        {hasFooter ? (
          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(
                  Layout.screen.footerBottom,
                  insets.bottom + Layout.screen.footerInsetExtra,
                ),
              },
            ]}
          >
            <View style={styles.actions}>{footer}</View>
            {footerNote ? (
              <Text style={[styles.note, { color: colors.textTertiary }]}>{footerNote}</Text>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  footer: {
    paddingHorizontal: Layout.pad,
    gap: Layout.screen.footerGap,
    alignItems: "center",
  },
  // 03: 16 between stacked actions; 01: 14 between the action and the note.
  actions: { alignSelf: "stretch", alignItems: "center", gap: Layout.screen.footerActionGap },
  note: { fontSize: 12, textAlign: "center" },
});
