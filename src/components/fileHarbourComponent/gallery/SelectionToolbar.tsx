import { StyleSheet, Text, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Button } from "@components/fileHarbourComponent/shared/Button";

type Props = {
  /** 08 "Download 6 items". */
  downloadLabel: string;
  /** Small text above the buttons, e.g. how many files download at the same time. */
  hint?: string;
  /** Not set: the button shows disabled. */
  onDownload?: () => void;
  onDelete?: () => void;
};

const noop = (): void => {};

// The 08 bottom action bar above the tab bar. Not shared/: it is the only in-screen action
// bar with a main action and a delete circle; it is not navigation (CLAUDE.md §3).
export function SelectionToolbar({
  downloadLabel,
  hint,
  onDownload,
  onDelete,
}: Props) {
  const { colors } = useColorScheme();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.bg, borderTopColor: colors.border },
      ]}
    >
      {hint ? (
        <Text style={[styles.hint, { color: colors.textTertiary }]}>
          {hint}
        </Text>
      ) : null}
      <View style={styles.row}>
        <View style={styles.main}>
          <Button
            label={downloadLabel}
            icon="arrow-down-to-line"
            size="pill"
            onPress={onDownload ?? noop}
            disabled={!onDownload}
          />
        </View>
        <Button
          variant="destructive"
          size="pill"
          icon="trash-2"
          accessibilityLabel="Delete"
          onPress={onDelete ?? noop}
          disabled={!onDelete}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: Layout.hairline,
    paddingTop: Layout.actionBar.padTop,
    paddingHorizontal: Layout.actionBar.padX,
    paddingBottom: Layout.actionBar.padBottom,
    gap: Layout.actionBar.gap,
    alignItems: "center",
  },
  hint: { fontSize: 11 },
  row: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: Layout.actionBar.rowGap,
  },
  main: { flex: 1 },
});
