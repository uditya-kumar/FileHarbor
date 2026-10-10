import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

type Props = {
  /** 0 to 1. A value out of range shows as 0 or 1. */
  value: number;
  /** "viewer": white on the dark viewer (10). "accent": transfer rows (12, 13). */
  tone?: "accent" | "viewer";
  /** Shows a round knob at the end of the fill (10 scrubber). */
  knob?: boolean;
  /** Set it to let the user tap a point on the bar. It gives the point as 0 to 1. */
  onSeek?: (value: number) => void;
  accessibilityLabel?: string;
};

const clamp = (n: number): number => Math.min(1, Math.max(0, n));
// A screen reader moves a seek bar 10 % for each swipe.
const STEP = 0.1;

export function ProgressBar({
  value,
  tone = "accent",
  knob = false,
  onSeek,
  accessibilityLabel,
}: Props) {
  const { colors } = useColorScheme();
  const [width, setWidth] = useState(0);
  const v = clamp(value);
  const fill = tone === "viewer" ? colors.viewerText : colors.accent;
  const rest = tone === "viewer" ? colors.viewerTrack : colors.border;
  const percent = `${v * 100}%` as const;

  const seekAt = (e: GestureResponderEvent): void => {
    if (onSeek && width > 0) onSeek(clamp(e.nativeEvent.locationX / width));
  };
  const step = (e: AccessibilityActionEvent): void => {
    if (!onSeek) return;
    if (e.nativeEvent.actionName === "increment") onSeek(clamp(v + STEP));
    if (e.nativeEvent.actionName === "decrement") onSeek(clamp(v - STEP));
  };

  return (
    <Pressable
      onPress={onSeek ? seekAt : undefined}
      disabled={!onSeek}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      hitSlop={onSeek ? Layout.progress.hitSlop : undefined}
      accessibilityRole={onSeek ? "adjustable" : "progressbar"}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}
      accessibilityActions={
        onSeek ? [{ name: "increment" }, { name: "decrement" }] : undefined
      }
      onAccessibilityAction={step}
      style={[styles.bar, knob && styles.barKnob]}
    >
      {/* The children take no touches, so locationX is from the left edge of the bar. */}
      <View style={styles.fill} pointerEvents="none">
        <View style={[styles.track, { backgroundColor: rest }]}>
          <View
            style={[styles.done, { width: percent, backgroundColor: fill }]}
          />
        </View>
        {knob ? (
          <View
            style={[styles.knob, { left: percent, backgroundColor: fill }]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { alignSelf: "stretch", height: Layout.progress.track },
  barKnob: { height: Layout.progress.knob },
  fill: { flex: 1, justifyContent: "center" },
  track: {
    height: Layout.progress.track,
    borderRadius: Layout.progress.radius,
    overflow: "hidden",
  },
  done: { height: Layout.progress.track },
  knob: {
    position: "absolute",
    top: 0,
    width: Layout.progress.knob,
    height: Layout.progress.knob,
    marginLeft: -Layout.progress.knob / 2,
    borderRadius: Layout.progress.knob / 2,
  },
});
