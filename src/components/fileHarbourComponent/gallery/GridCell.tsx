import { Pressable, StyleSheet, Text, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Checkbox } from "@components/fileHarbourComponent/shared/Checkbox";
import { Icon } from "@components/fileHarbourComponent/shared/Icon";
import { Thumbnail } from "@components/fileHarbourComponent/shared/Thumbnail";

export type GridCellProps = {
  /** The file name. It shows only when the cell has no image (a document). */
  title: string;
  imageUri: string | null;
  placeholderUri: string | null;
  /** Shows the play badge (07). */
  isVideo: boolean;
  recyclingKey: string;
  accessibilityLabel: string;
  /** Set only during selection (08). true shows the accent ring and the check. */
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
};

// One square of the 07 grid. Not shared/: only the gallery grid shows a square media tile.
export function GridCell({
  title,
  imageUri,
  placeholderUri,
  isVideo,
  recyclingKey,
  accessibilityLabel,
  selected,
  onPress,
  onLongPress,
}: GridCellProps) {
  const { colors } = useColorScheme();
  const hasImage = imageUri !== null || placeholderUri !== null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? "button" : "image"}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={[styles.cell, { backgroundColor: colors.bgSunken }]}
    >
      {hasImage ? (
        <Thumbnail
          uri={imageUri}
          placeholderUri={placeholderUri}
          recyclingKey={recyclingKey}
        />
      ) : (
        <View style={styles.document}>
          <Icon name="file-text" size={22} color={colors.textTertiary} />
          <Text
            numberOfLines={2}
            style={[styles.name, { color: colors.textSecondary }]}
          >
            {title}
          </Text>
        </View>
      )}
      {isVideo ? (
        // Documents carry no video length, so the badge has the play mark only.
        <View style={[styles.badge, { backgroundColor: colors.mediaBadge }]}>
          <Icon name="play" size={9} color={colors.onMediaBadge} />
        </View>
      ) : null}
      {selected ? (
        // A ring drawn over the image, so the image keeps its size (08 inner stroke).
        <View
          style={[styles.ring, { borderColor: colors.accent }]}
          pointerEvents="none"
        >
          <Checkbox checked size="sm" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    aspectRatio: 1,
    borderRadius: Layout.grid.radius,
    overflow: "hidden",
  },
  document: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: Layout.grid.badgeInset,
  },
  name: { fontSize: 11, textAlign: "center" },
  ring: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: Layout.grid.selectedRing,
    borderRadius: Layout.grid.radius,
    alignItems: "flex-end",
    justifyContent: "flex-end",
    // The check sits 7 in from the cell edge, inside the ring.
    padding: Layout.grid.badgeInset - Layout.grid.selectedRing,
  },
  badge: {
    position: "absolute",
    left: Layout.grid.badgeInset,
    bottom: Layout.grid.badgeInset,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Layout.grid.badgeRadius,
  },
});
