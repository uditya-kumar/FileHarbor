import { Pressable, StyleSheet, Text, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

import { Button } from "@components/fileHarbourComponent/shared/Button";
import { Checkbox } from "@components/fileHarbourComponent/shared/Checkbox";
import {
  Icon,
  type IconName,
} from "@components/fileHarbourComponent/shared/Icon";
import { Thumbnail } from "@components/fileHarbourComponent/shared/Thumbnail";

type Props = {
  name: string;
  /** One line under the name, e.g. "12.4 MB of 51.8 MB · 2.1 MB/s". */
  detail: string;
  /** "warn" for a rate limit, never "danger" (CLAUDE.md §6). */
  detailTone?: "normal" | "warn" | "danger";
  /** The file type icon. It shows when there is no thumbnail. */
  icon: IconName;
  thumbnailUri: string | null;
  placeholderUri: string | null;
  /** Required for the image in a recycled list cell (spec §8.3). */
  recyclingKey: string;
  actionIcon: IconName;
  /** E.g. "Pause IMG_4821.HEIC". */
  actionLabel: string;
  /** Not set: the button shows disabled (a queued file). */
  onAction?: () => void;
  /** 14: an accent card, and a check in place of the thumbnail. */
  selected?: boolean;
  /** A press on the file (not on the round button): toggles it in 14. */
  onPress?: () => void;
  /** Starts the 14 selection. */
  onLongPress?: () => void;
};

// One file in the transfer lists (12, 13). Not ListRow: it has a thumbnail tile, a toned
// status line, and a round action button, and ListRow has none of them. The file part and the
// round button are two press targets, so TalkBack can reach both.
export function TransferRow({
  name,
  detail,
  detailTone = "normal",
  icon,
  thumbnailUri,
  placeholderUri,
  recyclingKey,
  actionIcon,
  actionLabel,
  onAction,
  selected = false,
  onPress,
  onLongPress,
}: Props) {
  const { colors } = useColorScheme();
  const image = thumbnailUri != null || placeholderUri != null;
  const detailColor =
    detailTone === "warn"
      ? colors.warn
      : detailTone === "danger"
        ? colors.danger
        : selected
          ? colors.textSecondary
          : colors.textTertiary;

  return (
    <View
      style={[
        styles.row,
        selected
          ? { backgroundColor: colors.accentSoft, borderColor: colors.accent }
          : { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      <Pressable
        style={styles.file}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={!onPress && !onLongPress}
        accessibilityLabel={`${name}, ${detail}`}
        accessibilityState={{ selected }}
      >
        {selected ? (
          <Checkbox checked />
        ) : (
          <View style={[styles.tile, { backgroundColor: colors.bgSunken }]}>
            {image ? (
              <Thumbnail
                uri={thumbnailUri}
                placeholderUri={placeholderUri}
                recyclingKey={recyclingKey}
              />
            ) : (
              <Icon
                name={icon}
                size={Layout.transfer.tileIcon}
                color={colors.textTertiary}
              />
            )}
          </View>
        )}
        <View style={styles.text}>
          <Text
            numberOfLines={1}
            ellipsizeMode="middle"
            style={[styles.name, { color: colors.textPrimary }]}
          >
            {name}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.detail, { color: detailColor }]}
          >
            {detail}
          </Text>
        </View>
      </Pressable>
      <Button
        variant={selected ? "raised" : "sunken"}
        size="round"
        icon={actionIcon}
        accessibilityLabel={actionLabel}
        disabled={!onAction}
        onPress={onAction ?? noop}
      />
    </View>
  );
}

const noop = (): void => {};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Layout.list.rowPad,
    gap: Layout.transfer.gap,
    borderWidth: Layout.hairline,
    borderRadius: Layout.radius.card,
  },
  tile: {
    width: Layout.transfer.tile,
    height: Layout.transfer.tile,
    borderRadius: Layout.radius.sm,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  file: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.transfer.gap,
  },
  text: { flex: 1, gap: Layout.list.textGap },
  name: { fontSize: 14, fontWeight: "500" },
  detail: { fontSize: 11 },
});
