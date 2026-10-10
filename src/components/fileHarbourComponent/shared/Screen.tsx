import type { ReactNode } from "react";
import { KeyboardAvoidingView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ColorTokens } from "@/constants/Colors";
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
  /** "muted" for a page of rows (04): the rows are white on it. "viewer": 09 and 10. */
  background?: "default" | "muted" | "viewer";
  /**
   * Size to the content, not the window. Set it on a form sheet with
   * `sheetAllowedDetents: "fitToContents"`: that sheet cannot use flex 1. The native sheet
   * moves above the keyboard, so the screen does not avoid the keyboard itself.
   */
  fit?: boolean;
};

/** The colour token for each background. */
const BACKGROUND = {
  default: "bg",
  muted: "bgMuted",
  viewer: "viewerBg",
} as const satisfies Record<
  NonNullable<Props["background"]>,
  keyof ColorTokens
>;

export function Screen({
  children,
  footer,
  footerNote,
  headerShown = true,
  background = "default",
  fit = false,
}: Props) {
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const hasFooter = footer != null;
  const fill = fit ? null : styles.fill;

  return (
    <View
      style={[
        fill,
        {
          backgroundColor: colors[BACKGROUND[background]],
          paddingTop: headerShown ? 0 : insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/* Edge-to-edge Android does not resize the window for the keyboard. */}
      <KeyboardAvoidingView
        style={fill}
        behavior="padding"
        enabled={hasFooter && !fit}
      >
        <View style={fill}>{children}</View>
        {hasFooter ? (
          <View
            style={[
              styles.footer,
              // A fit sheet has no free space above the footer, so it needs its own gap.
              fit && styles.footerFit,
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
              <Text style={[styles.note, { color: colors.textTertiary }]}>
                {footerNote}
              </Text>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  footer: {
    paddingHorizontal: Layout.pad,
    gap: Layout.screen.footerGap,
    alignItems: "center",
  },
  footerFit: { paddingTop: Layout.sheet.gap },
  // 03: 16 between stacked actions; 01: 14 between the action and the note.
  actions: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: Layout.screen.footerActionGap,
  },
  note: { fontSize: 12, textAlign: "center" },
});
