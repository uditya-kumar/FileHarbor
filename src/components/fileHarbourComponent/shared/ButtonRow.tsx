import { Children, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Layout } from "@/constants/Layout";

type Props = { children: ReactNode };

// Buttons side by side with equal widths (06 Cancel / Create). Give each Button `fullWidth`.
export function ButtonRow({ children }: Props) {
  return (
    <View style={styles.row}>
      {Children.map(children, (child) => (
        <View style={styles.cell}>{child}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: Layout.sheet.actionGap,
  },
  cell: { flex: 1 },
});
