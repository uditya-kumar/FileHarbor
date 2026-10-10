import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactElement, Ref } from "react";
import { Text } from "react-native";
import type { VideoPlayer } from "expo-video";
import { State } from "react-native-gesture-handler";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";

import {
  PhotoViewer,
  type ViewerPage,
} from "@components/fileHarbourComponent/viewer/PhotoViewer";
import { VideoScrubber } from "@components/fileHarbourComponent/viewer/VideoScrubber";
import { VideoViewer } from "@components/fileHarbourComponent/viewer/VideoViewer";
import {
  ViewerActionRow,
  type ViewerAction,
} from "@components/fileHarbourComponent/viewer/ViewerActionRow";
import { ViewerFileMeta } from "@components/fileHarbourComponent/viewer/ViewerFileMeta";
import { ViewerFilmstrip } from "@components/fileHarbourComponent/viewer/ViewerFilmstrip";

jest.mock("expo-image", () => ({ Image: () => null }));

// expo-video is native. The mock records the props of each VideoView.
type VideoViewProps = { player: VideoPlayer; surfaceType?: string };
const mockVideoView = jest.fn<null, [VideoViewProps]>(() => null);
jest.mock("expo-video", () => ({
  VideoView: (props: VideoViewProps) => mockVideoView(props),
}));

// The gallery needs Reanimated and gesture-handler on a device. The mock renders every page
// with the real renderItem, and records the props and the ref calls.
type GalleryProps = {
  ref?: Ref<{ setIndex: (i: number, animated?: boolean) => void }>;
  data: ViewerPage[];
  keyExtractor: (p: ViewerPage, i: number) => string;
  renderItem: (info: {
    item: ViewerPage;
    index: number;
    setImageDimensions: (d: { width: number; height: number }) => void;
  }) => ReactElement | null;
  initialIndex?: number;
  onIndexChange?: (i: number) => void;
  onTap?: () => void;
  pinchEnabled?: boolean;
  doubleTapEnabled?: boolean;
};
const mockGallery = jest.fn<void, [GalleryProps]>();
const mockSetIndex = jest.fn();
jest.mock("@benschac/react-native-awesome-gallery", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: (props: GalleryProps) => {
      mockGallery(props);
      React.useImperativeHandle(props.ref, () => ({ setIndex: mockSetIndex }));
      return React.createElement(
        React.Fragment,
        null,
        props.data.map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: props.keyExtractor(item, index) },
            props.renderItem({ item, index, setImageDimensions: jest.fn() }),
          ),
        ),
      );
    },
  };
});
const lastGallery = (): GalleryProps => {
  const calls = mockGallery.mock.calls;
  return calls[calls.length - 1][0];
};

beforeEach(() => {
  mockVideoView.mockClear();
  mockGallery.mockClear();
  mockSetIndex.mockClear();
});

describe("ViewerFileMeta", () => {
  it("shows the name and the meta line", async () => {
    await render(
      <ViewerFileMeta name="IMG_4821.HEIC" meta="12 Aug 2024 · 8.4 MB" />,
    );
    expect(screen.getByText("IMG_4821.HEIC")).toBeOnTheScreen();
    expect(screen.getByText("12 Aug 2024 · 8.4 MB")).toBeOnTheScreen();
  });
});

describe("ViewerActionRow", () => {
  const actions = (onShare?: () => void): ViewerAction[] => [
    { key: "share", icon: "share-2", label: "Share", onPress: onShare },
    { key: "delete", icon: "trash-2", label: "Delete", destructive: true },
  ];

  it("calls the action, and disables an action without a handler", async () => {
    const onShare = jest.fn();
    await render(
      <ViewerActionRow actions={actions(onShare)}>
        <Text>Caption</Text>
      </ViewerActionRow>,
    );
    expect(screen.getByText("Caption")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Share" }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});

describe("VideoScrubber", () => {
  it("shows the buffer line and the times, and seeks", async () => {
    const onSeek = jest.fn();
    await render(
      <VideoScrubber
        bufferText="Buffered 62% · streaming from Telegram"
        played={0.5}
        elapsed="0:12"
        total="0:24"
        onSeek={onSeek}
      />,
    );
    expect(
      screen.getByText("Buffered 62% · streaming from Telegram"),
    ).toBeOnTheScreen();
    expect(screen.getByText("0:12")).toBeOnTheScreen();
    expect(screen.getByText("0:24")).toBeOnTheScreen();
    const bar = screen.getByLabelText("Play position");
    expect(bar.props.accessibilityValue.now).toBe(50);
    await fireEvent(bar, "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 12 } },
    });
    await fireEvent.press(bar, { nativeEvent: { locationX: 225 } });
    expect(onSeek).toHaveBeenCalledWith(0.75);
  });

  it("hides the buffer line when there is no text", async () => {
    await render(<VideoScrubber played={0} elapsed="0:00" total="0:24" />);
    expect(screen.queryByText(/Buffered/)).toBeNull();
  });
});

describe("ViewerFilmstrip", () => {
  const items = ["1", "2", "3"].map((key) => ({
    key,
    imageUri: `file:///td/${key}.jpg`,
    placeholderUri: null,
    accessibilityLabel: `Photo ${key}`,
  }));

  it("marks the open file, and opens a tapped file", async () => {
    const onPressItem = jest.fn();
    await render(
      <ViewerFilmstrip items={items} activeKey="2" onPressItem={onPressItem} />,
    );
    expect(screen.getByLabelText("Photo 2")).toBeSelected();
    expect(screen.getByLabelText("Photo 1")).not.toBeSelected();
    await fireEvent.press(screen.getByLabelText("Photo 3"));
    expect(onPressItem).toHaveBeenCalledWith("3");
  });
});

describe("PhotoViewer", () => {
  const page = (key: string, over: Partial<ViewerPage> = {}): ViewerPage => ({
    key,
    kind: "photo",
    imageUri: `file:///td/${key}.jpg`,
    placeholderUri: null,
    accessibilityLabel: `Photo ${key}`,
    ...over,
  });
  const pages = [
    page("1"),
    page("2", { kind: "video", accessibilityLabel: "Video 2" }),
    page("3", { imageUri: null, accessibilityLabel: "Photo 3, not loaded" }),
  ];
  const slot = <Text>Video slot</Text>;

  it("renders each page, and the placeholder when there is no image", async () => {
    await render(
      <PhotoViewer pages={pages} index={0} onIndexChange={jest.fn()} />,
    );
    expect(screen.getByLabelText("Photo 1")).toBeOnTheScreen();
    expect(screen.getByLabelText("Photo 3, not loaded")).toBeOnTheScreen();
    expect(lastGallery().initialIndex).toBe(0);
    expect(lastGallery().pinchEnabled).toBe(true);
  });

  it("shows the video slot only on the open video page, with no zoom", async () => {
    const { rerender } = await render(
      <PhotoViewer
        pages={pages}
        index={0}
        onIndexChange={jest.fn()}
        video={slot}
      />,
    );
    expect(screen.queryByText("Video slot")).toBeNull();
    expect(screen.getByLabelText("Video 2")).toBeOnTheScreen();
    await rerender(
      <PhotoViewer
        pages={pages}
        index={1}
        onIndexChange={jest.fn()}
        video={slot}
      />,
    );
    expect(screen.getByText("Video slot")).toBeOnTheScreen();
    // The slot fills the page. A centring parent gave the video only the width of its play
    // button (device test, 7.10).
    const wrapper = screen.getByText("Video slot").parent;
    expect(wrapper).toHaveStyle({ flex: 1 });
    expect(wrapper).not.toHaveStyle({ alignItems: "center" });
    expect(screen.queryByLabelText("Video 2")).toBeNull();
    expect(lastGallery().pinchEnabled).toBe(false);
    expect(lastGallery().doubleTapEnabled).toBe(false);
  });

  it("gives the pager tap to a photo page only: a video page takes its own taps", async () => {
    const onTap = jest.fn();
    const { rerender } = await render(
      <PhotoViewer
        pages={pages}
        index={0}
        onIndexChange={jest.fn()}
        onTap={onTap}
      />,
    );
    expect(lastGallery().onTap).toBe(onTap);
    await rerender(
      <PhotoViewer
        pages={pages}
        index={1}
        onIndexChange={jest.fn()}
        onTap={onTap}
      />,
    );
    expect(lastGallery().onTap).toBeUndefined();
  });

  it("moves the pager for a new index from the screen, not for a swipe", async () => {
    const onIndexChange = jest.fn();
    const { rerender } = await render(
      <PhotoViewer pages={pages} index={0} onIndexChange={onIndexChange} />,
    );
    // A swipe: the gallery is on page 1 already.
    lastGallery().onIndexChange?.(1);
    expect(onIndexChange).toHaveBeenCalledWith(1);
    await rerender(
      <PhotoViewer pages={pages} index={1} onIndexChange={onIndexChange} />,
    );
    expect(mockSetIndex).not.toHaveBeenCalled();
    // A filmstrip tap: the screen sends page 2.
    await rerender(
      <PhotoViewer pages={pages} index={2} onIndexChange={onIndexChange} />,
    );
    expect(mockSetIndex).toHaveBeenCalledWith(2, false);
  });
});

describe("VideoViewer", () => {
  const player = {} as VideoPlayer;

  it("plays in a TextureView, and toggles play", async () => {
    const onTogglePlay = jest.fn();
    await render(
      <VideoViewer
        player={player}
        posterUri="file:///td/2.jpg"
        recyclingKey="2"
        playing={false}
        onTogglePlay={onTogglePlay}
      />,
    );
    expect(mockVideoView.mock.calls[0][0].player).toBe(player);
    expect(mockVideoView.mock.calls[0][0].surfaceType).toBe("textureView");
    await fireEvent.press(screen.getByRole("button", { name: "Play" }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it("shows or hides the bars on a page tap, and not on a tap on Play", async () => {
    const onTogglePlay = jest.fn();
    const onPressPage = jest.fn();
    await render(
      <VideoViewer
        player={player}
        posterUri={null}
        recyclingKey="2"
        playing
        onTogglePlay={onTogglePlay}
        onPressPage={onPressPage}
      />,
    );
    fireGestureHandler(getByGestureTestId("video-page-tap"), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END },
    ]);
    expect(onPressPage).toHaveBeenCalledTimes(1);
    expect(onTogglePlay).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Pause" }));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
    expect(onPressPage).toHaveBeenCalledTimes(1);
  });

  it("shows the poster only while there is no player", async () => {
    await render(
      <VideoViewer
        player={null}
        posterUri="file:///td/2.jpg"
        recyclingKey="2"
        playing={false}
        onTogglePlay={jest.fn()}
      />,
    );
    expect(mockVideoView).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Play" })).toBeOnTheScreen();
  });

  it("hides the button while it plays with the bars hidden", async () => {
    const props = {
      player,
      posterUri: null,
      recyclingKey: "2",
      playing: true,
      onTogglePlay: jest.fn(),
    };
    const { rerender } = await render(<VideoViewer {...props} />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeOnTheScreen();
    await rerender(<VideoViewer {...props} controlsVisible={false} />);
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    await rerender(
      <VideoViewer {...props} playing={false} controlsVisible={false} />,
    );
    expect(screen.getByRole("button", { name: "Play" })).toBeOnTheScreen();
  });
});
