import Gallery, {
  type GalleryRef,
  type RenderItemInfo,
} from "@benschac/react-native-awesome-gallery";
import {
  useCallback,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Icon } from "@components/fileHarbourComponent/shared/Icon";
import { Thumbnail } from "@components/fileHarbourComponent/shared/Thumbnail";

export type ViewerPage = {
  key: string;
  kind: "photo" | "video";
  /** The full photo, or the video poster. null: the 09 placeholder icon shows. */
  imageUri: string | null;
  placeholderUri: string | null;
  accessibilityLabel: string;
};

type Props = {
  pages: ViewerPage[];
  /** The open page. A change from the screen (a filmstrip tap) moves the pager. */
  index: number;
  onIndexChange: (index: number) => void;
  /** The screen's VideoViewer. It shows only on the open page, if that page is a video. */
  video?: ReactNode;
  /** A tap on the page: the screen shows or hides the bars. */
  onTap?: () => void;
  onSwipeToClose?: () => void;
};

// The 09/10 pager: swipe between files, pinch and double-tap to zoom a photo. A video page
// shows its poster, and the `video` slot when it is the open page. Not shared/: only the
// viewer pages through full-screen files.
export function PhotoViewer({
  pages,
  index,
  onIndexChange,
  video,
  onTap,
  onSwipeToClose,
}: Props) {
  const { colors } = useColorScheme();
  const gallery = useRef<GalleryRef>(null);
  // The page that the pager shows. A swipe changes it before the screen sends the new index.
  const shown = useRef(index);
  const openIsVideo = pages[index]?.kind === "video";

  useEffect(() => {
    if (index === shown.current) return;
    shown.current = index;
    gallery.current?.setIndex(index, false);
  }, [index]);

  const handleIndexChange = useCallback(
    (next: number) => {
      shown.current = next;
      onIndexChange(next);
    },
    [onIndexChange],
  );

  // A new function when the open page or the slot changes, so the memoised pages render again.
  const renderItem = useCallback(
    ({
      item,
      index: i,
      setImageDimensions,
    }: RenderItemInfo<ViewerPage>): ReactElement => {
      if (item.kind === "video" && i === index && video) {
        return <View style={styles.page}>{video}</View>;
      }
      if (!item.imageUri && !item.placeholderUri) {
        return (
          <View
            style={styles.page}
            accessible
            accessibilityRole="image"
            accessibilityLabel={item.accessibilityLabel}
          >
            <Icon
              name="image"
              size={Layout.viewer.placeholderIcon}
              color={colors.viewerTextSecondary}
            />
          </View>
        );
      }
      return (
        <View
          style={styles.page}
          accessible
          accessibilityRole="image"
          accessibilityLabel={item.accessibilityLabel}
        >
          <Thumbnail
            uri={item.imageUri}
            placeholderUri={item.placeholderUri}
            recyclingKey={item.key}
            fit="contain"
            onLoadSize={setImageDimensions}
          />
        </View>
      );
    },
    [index, video, colors.viewerTextSecondary],
  );

  return (
    <Gallery
      ref={gallery}
      data={pages}
      keyExtractor={(p) => p.key}
      renderItem={renderItem}
      initialIndex={index}
      onIndexChange={handleIndexChange}
      // A zoom gesture on a video page would fight the play button and the scrubber.
      pinchEnabled={!openIsVideo}
      doubleTapEnabled={!openIsVideo}
      onTap={onTap}
      onSwipeToClose={onSwipeToClose}
      style={{ backgroundColor: colors.viewerBg }}
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center" },
});
