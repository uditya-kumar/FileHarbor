import { VideoView, type VideoPlayer } from "expo-video";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Icon } from "@components/fileHarbourComponent/shared/Icon";
import { Thumbnail } from "@components/fileHarbourComponent/shared/Thumbnail";

type Props = {
  /**
   * The player of the open video. The screen makes it, because the 10 scrubber in the bottom
   * bar reads the same player. null while the file is not on the device yet: the poster shows.
   */
  player: VideoPlayer | null;
  /** The thumbnail, under the video until the first frame. */
  posterUri: string | null;
  recyclingKey: string;
  playing: boolean;
  onTogglePlay: () => void;
  /**
   * A tap on the page outside the button: the screen shows or hides the bars. The pager does
   * not get the tap on a video page, so a tap on Play does not also hide the bars.
   */
  onPressPage?: () => void;
  /** false while the viewer bars are hidden. A paused video keeps its button. */
  controlsVisible?: boolean;
};

/** Points that a tap can move and still count as a tap: the same as the pager's own tap. */
const PAGE_TAP_SLOP = 10;

// One video page of the viewer (10). Not shared/: only the viewer plays a video.
export function VideoViewer({
  player,
  posterUri,
  recyclingKey,
  playing,
  onTogglePlay,
  onPressPage,
  controlsVisible = true,
}: Props) {
  const { colors } = useColorScheme();
  // A gesture-handler tap, not a Pressable: the VideoView keeps the touches on it, so a
  // Pressable around it gets no press (device test, 7.10). The tap is on a layer under the
  // button, not on its parent: gesture-handler stops at the button, so a tap on Play does
  // not also reach this layer.
  const pageTap = Gesture.Tap()
    .enabled(onPressPage != null)
    .maxDistance(PAGE_TAP_SLOP)
    .runOnJS(true)
    .onEnd((_event, success) => {
      if (success) onPressPage?.();
    })
    .withTestId("video-page-tap");

  return (
    <View style={styles.page}>
      <GestureDetector gesture={pageTap}>
        <View style={styles.fill} collapsable={false}>
          <Thumbnail
            uri={posterUri}
            recyclingKey={recyclingKey}
            fit="contain"
          />
          {player ? (
            <VideoView
              player={player}
              nativeControls={false}
              contentFit="contain"
              // A TextureView moves and fades with the pager page like any other view.
              surfaceType="textureView"
              style={styles.fill}
            />
          ) : null}
        </View>
      </GestureDetector>
      {controlsVisible || !playing ? (
        <Pressable
          onPress={onTogglePlay}
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pause" : "Play"}
          style={[styles.play, { backgroundColor: colors.viewerScrim }]}
        >
          <Icon
            name={playing ? "pause" : "play"}
            size={Layout.viewer.playIcon}
            color={colors.viewerText}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center" },
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  play: {
    width: Layout.viewer.playButton,
    height: Layout.viewer.playButton,
    borderRadius: Layout.viewer.playButton / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
