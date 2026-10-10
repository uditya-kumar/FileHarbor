import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Thumbnail } from "@components/fileHarbourComponent/shared/Thumbnail";

export type FilmstripItem = {
  key: string;
  imageUri: string | null;
  placeholderUri: string | null;
  accessibilityLabel: string;
};

type Props = {
  items: readonly FilmstripItem[];
  /** The file that the viewer shows. It is larger, with a ring. */
  activeKey: string;
  onPressItem?: (key: string) => void;
};

// The 09 row of small thumbnails under the caption. Not shared/: only the viewer has a
// horizontal strip that follows the open photo.
export function ViewerFilmstrip({ items, activeKey, onPressItem }: Props) {
  const { colors } = useColorScheme();
  const list = useRef<FlashListRef<FilmstripItem>>(null);
  const activeIndex = items.findIndex((i) => i.key === activeKey);

  // Keep the open photo in the middle of the strip when the user swipes the photo.
  useEffect(() => {
    if (activeIndex < 0) return;
    void list.current?.scrollToIndex({
      index: activeIndex,
      animated: true,
      viewPosition: 0.5,
    });
  }, [activeIndex]);

  return (
    <View style={styles.strip}>
      <FlashList
        ref={list}
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => i.key}
        extraData={activeKey}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => {
          const active = item.key === activeKey;
          return (
            <View style={styles.slot}>
              <Pressable
                onPress={onPressItem ? () => onPressItem(item.key) : undefined}
                disabled={!onPressItem}
                accessibilityRole="button"
                accessibilityLabel={item.accessibilityLabel}
                accessibilityState={{ selected: active }}
                style={[
                  active ? styles.thumbActive : styles.thumb,
                  { backgroundColor: colors.viewerSurface },
                ]}
              >
                <Thumbnail
                  uri={item.imageUri}
                  placeholderUri={item.placeholderUri}
                  recyclingKey={item.key}
                />
                {active ? (
                  <View
                    style={[styles.ring, { borderColor: colors.viewerText }]}
                    pointerEvents="none"
                  />
                ) : null}
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const { thumb, thumbActive, thumbRadius, thumbGap, thumbRing } = Layout.viewer;

const styles = StyleSheet.create({
  strip: { height: thumbActive },
  content: { paddingHorizontal: Layout.pad - thumbGap / 2 },
  // Each thumbnail is centred in a slot as tall as the active one.
  slot: {
    height: thumbActive,
    justifyContent: "center",
    paddingHorizontal: thumbGap / 2,
  },
  thumb: {
    width: thumb,
    height: thumb,
    borderRadius: thumbRadius,
    overflow: "hidden",
  },
  thumbActive: {
    width: thumbActive,
    height: thumbActive,
    borderRadius: thumbRadius,
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: thumbRing,
    borderRadius: thumbRadius,
  },
});
