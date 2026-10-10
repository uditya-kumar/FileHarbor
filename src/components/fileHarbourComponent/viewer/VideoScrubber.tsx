import { StyleSheet, Text, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Icon } from "@components/fileHarbourComponent/shared/Icon";
import { ProgressBar } from "@components/fileHarbourComponent/shared/ProgressBar";

type Props = {
  /** "Buffered 62% · streaming from Telegram". Not set: the line does not show. */
  bufferText?: string;
  /** The played part, 0 to 1. */
  played: number;
  /** "0:12" */
  elapsed: string;
  /** "0:24" */
  total: string;
  /** Not set: the bar shows the position only (no video loaded yet). */
  onSeek?: (value: number) => void;
};

// The 10 controls over the action row. Not shared/: only the video viewer has a seek bar with
// a download line and play times; the bar itself is shared/ProgressBar.
export function VideoScrubber({
  bufferText,
  played,
  elapsed,
  total,
  onSeek,
}: Props) {
  const { colors } = useColorScheme();
  const dim = { color: colors.viewerTextSecondary };

  return (
    <View style={styles.controls}>
      {bufferText ? (
        <View style={styles.buffer}>
          <Icon
            name="cloud-download"
            size={Layout.viewer.bufferIcon}
            color={colors.viewerTextSecondary}
          />
          <Text numberOfLines={1} style={[styles.small, dim]}>
            {bufferText}
          </Text>
        </View>
      ) : null}
      <ProgressBar
        value={played}
        tone="viewer"
        knob
        onSeek={onSeek}
        accessibilityLabel="Play position"
      />
      <View style={styles.times}>
        <Text style={[styles.small, dim]}>{elapsed}</Text>
        <Text style={[styles.small, dim]}>{total}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    paddingHorizontal: Layout.viewer.controlsPadX,
    gap: Layout.viewer.controlsGap,
  },
  buffer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Layout.viewer.bufferGap,
  },
  times: { flexDirection: "row", justifyContent: "space-between" },
  small: { fontSize: 11 },
});
