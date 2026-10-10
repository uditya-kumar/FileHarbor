import { FlashList, type ViewToken } from "@shopify/flash-list";
import type { ReactNode } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

import { GridCell, type GridCellProps } from "./GridCell";

export type GalleryCell = Omit<
  GridCellProps,
  "recyclingKey" | "onPress" | "onLongPress"
> & {
  key: string;
};

type Props = {
  cells: readonly GalleryCell[];
  /** Scrolls with the grid, above it (07 "148 items · 2.4 GB"). */
  header?: ReactNode;
  onPressCell?: (key: string) => void;
  /** 07: a long press starts selection (08). */
  onLongPressCell?: (key: string) => void;
  /** The keys of the cells on screen, so only those thumbnails download (spec §8.1). */
  onVisibleChange?: (keys: string[]) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
};

// FlashList reads this once; it must not change (FlashList docs).
const VIEWABILITY = { itemVisiblePercentThreshold: 10 };
const HALF_GAP = Layout.grid.gap / 2;

// The 07 thumbnail grid: FlashList v2, 3 columns (spec §8). Not shared/: only folder screens
// show a media grid.
export function GalleryGrid({
  cells,
  header,
  onPressCell,
  onLongPressCell,
  onVisibleChange,
  refreshing = false,
  onRefresh,
}: Props) {
  const { colors } = useColorScheme();

  return (
    <FlashList
      data={cells}
      numColumns={Layout.grid.columns}
      keyExtractor={(cell) => cell.key}
      renderItem={({ item: { key, ...cell } }) => (
        <View style={styles.slot}>
          <GridCell
            {...cell}
            recyclingKey={key}
            onPress={onPressCell ? () => onPressCell(key) : undefined}
            onLongPress={
              onLongPressCell ? () => onLongPressCell(key) : undefined
            }
          />
        </View>
      )}
      ListHeaderComponent={
        header ? <View style={styles.header}>{header}</View> : null
      }
      viewabilityConfig={VIEWABILITY}
      onViewableItemsChanged={
        onVisibleChange
          ? ({ viewableItems }: { viewableItems: ViewToken<GalleryCell>[] }) =>
              onVisibleChange(viewableItems.map((v) => v.item.key))
          : undefined
      }
      contentContainerStyle={styles.content}
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

// Each slot pads half the gap on each side, so the cells are a full gap apart and the outer
// edge is at the page padding.
const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Layout.pad - HALF_GAP,
    paddingTop: Layout.grid.top,
    paddingBottom: Layout.pad,
  },
  header: {
    paddingHorizontal: HALF_GAP,
    paddingBottom: Layout.grid.top,
    gap: Layout.grid.top,
  },
  slot: { paddingHorizontal: HALF_GAP, paddingBottom: Layout.grid.gap },
});
