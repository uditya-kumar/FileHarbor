import type { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { Layout } from "@/constants/Layout";

type Props = {
  children: ReactNode;
  /** false when the screen has no native header (01): the design gives more top space. */
  belowHeader?: boolean;
  /** Less space between parts: form sheet content (06). */
  dense?: boolean;
};

// Padded, scrollable column for form screens (01–03) and sheet content.
export function FormBody({
  children,
  belowHeader = true,
  dense = false,
}: Props) {
  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: belowHeader
            ? Layout.screen.topBelowHeader
            : Layout.screen.topNoHeader,
        },
        dense && styles.dense,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Layout.pad,
    gap: Layout.section.gap,
  },
  dense: { gap: Layout.sheet.gap },
});
