import { VideoView, type VideoPlayer } from "expo-video";
import { Pressable, StyleSheet, View } from "react-native";

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
  /** false while the viewer bars are hidden. A paused video keeps its button. */
  controlsVisible?: boolean;
};

// One video page of the viewer (10). Not shared/: only the viewer plays a video.
export function VideoViewer({
  player,
  posterUri,
  recyclingKey,
  playing,
  onTogglePlay,
  controlsVisible = true,
}: Props) {
  const { colors } = useColorScheme();

  return (
    <View style={styles.page}>
      <Thumbnail uri={posterUri} recyclingKey={recyclingKey} fit="contain" />
      {player ? (
        <VideoView
          player={player}
          nativeControls={false}
          contentFit="contain"
          // A SurfaceView does not move with the pager's transforms on Android.
          surfaceType="textureView"
          style={styles.video}
        />
      ) : null}
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
  video: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  play: {
    width: Layout.viewer.playButton,
    height: Layout.viewer.playButton,
    borderRadius: Layout.viewer.playButton / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
