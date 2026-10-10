import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import type { ReactNode } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

type Props<T> = {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: ListRenderItem<T>;
  /** Scrolls with the rows, above them (04 summary line and banners). */
  header?: ReactNode;
  /** Pull to refresh. Give both or neither. */
  refreshing?: boolean;
  onRefresh?: () => void;
};

// A padded, scrolling column of card rows, 10 apart (04 folder list; 12–14 transfer lists).
export function RowList<T>({
  data,
  keyExtractor,
  renderItem,
  header,
  refreshing = false,
  onRefresh,
}: Props<T>) {
  const { colors } = useColorScheme();

  return (
    <FlashList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={
        header ? <View style={styles.header}>{header}</View> : null
      }
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
            progressBackgroundColor={colors.bg}
          />
        ) : undefined
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Layout.pad,
    paddingTop: Layout.list.top,
    paddingBottom: Layout.pad,
  },
  header: { gap: Layout.list.top, paddingBottom: Layout.list.top },
  separator: { height: Layout.list.gap },
});
