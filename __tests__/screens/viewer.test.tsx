import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { State } from "react-native-gesture-handler";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";
import type { ReactElement, Ref } from "react";

import ViewerScreen from "@/app/viewer/[folderId]/[messageId]";
import { loadFolderFiles, loadThumbnail, viewFile } from "@/index/sync";
import type { FileProgress, FolderFile, ServiceError } from "@/types/domain";

import { mockParams, mockRouter, mockStack, resetAuthMocks } from "./authMocks";

jest.mock("expo-router", () => require("./authMocks").expoRouterModule);
jest.mock("@/index/sync", () => ({
  loadFolderFiles: jest.fn(),
  loadThumbnail: jest.fn(),
  viewFile: jest.fn(),
}));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("expo-video", () => ({
  VideoView: () => null,
  useVideoPlayer: () => ({
    addListener: () => ({ remove: () => {} }),
    play: jest.fn(),
  }),
}));

// The pager is checked in components/viewer.test.tsx. This mock renders each page and keeps
// the props, so a test can swipe, tap, or swipe down.
type Page = { key: string; accessibilityLabel: string };
type GalleryProps = {
  ref?: Ref<{ setIndex: (i: number) => void }>;
  data: Page[];
  keyExtractor: (p: Page, i: number) => string;
  renderItem: (info: {
    item: Page;
    index: number;
    setImageDimensions: () => void;
  }) => ReactElement | null;
  onIndexChange?: (i: number) => void;
  onTap?: () => void;
  onSwipeToClose?: () => void;
};
const mockGallery: { props: GalleryProps | null } = { props: null };
jest.mock("@benschac/react-native-awesome-gallery", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    __esModule: true,
    default: (props: GalleryProps) => {
      mockGallery.props = props;
      React.useImperativeHandle(props.ref, () => ({ setIndex: () => {} }));
      return React.createElement(
        React.Fragment,
        null,
        props.data.map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: props.keyExtractor(item, index) },
            props.renderItem({ item, index, setImageDimensions: () => {} }),
          ),
        ),
      );
    },
  };
});
const gallery = (): GalleryProps => {
  if (!mockGallery.props) throw new Error("The pager did not render");
  return mockGallery.props;
};

const load = loadFolderFiles as jest.Mock;
const thumb = loadThumbnail as jest.Mock;
const view = viewFile as jest.Mock;

const MB = 1024 ** 2;
const DATE = new Date(2024, 7, 12, 12).getTime() / 1000;
const file = (
  messageId: number,
  over: Partial<FolderFile> = {},
): FolderFile => ({
  messageId,
  dirPath: "Goa 2024",
  name: `IMG_${messageId}.HEIC`,
  date: DATE,
  size: 8.4 * MB,
  mimeType: "image/heic",
  kind: "photo",
  fileId: messageId,
  localUri: null,
  thumbnailFileId: messageId + 1000,
  thumbnailUri: null,
  placeholderUri: null,
  ...over,
});

const files = [
  file(5),
  file(4, {
    name: "clip.mp4",
    kind: "video",
    mimeType: "video/mp4",
    size: 51.8 * MB,
  }),
  file(3, { name: "notes.pdf", kind: "other", mimeType: "application/pdf" }),
  file(2, { localUri: "file:///td/2.jpg" }),
];

/** The last viewFile call: its file and its callbacks. */
const download = () => {
  const call = view.mock.calls[view.mock.calls.length - 1] as [
    number,
    (p: FileProgress) => void,
    (e: ServiceError) => void,
  ];
  return { fileId: call[0], progress: call[1], error: call[2] };
};
const stop = jest.fn();

beforeEach(() => {
  resetAuthMocks();
  mockGallery.props = null;
  mockParams.current = { folderId: "Goa 2024", messageId: "5" };
  load.mockReset().mockResolvedValue({ ok: true, value: files });
  thumb.mockReset().mockResolvedValue({ ok: true, value: "file:///t.jpg" });
  view.mockReset().mockReturnValue(stop);
});

describe("Viewer 09 — photo", () => {
  it("opens the tapped file with its place in the folder, and only photos and videos", async () => {
    await render(<ViewerScreen />);
    expect(await screen.findByText("IMG_5.HEIC")).toBeOnTheScreen();
    expect(load).toHaveBeenCalledWith("Goa 2024");
    expect(mockStack.options.title).toBe("1 of 3");
    expect(screen.getByText("12 Aug 2024 · 8.4 MB")).toBeOnTheScreen();
    expect(gallery().data.map((p) => p.key)).toEqual(["5", "4", "2"]);
  });

  it("downloads the open photo and shows the progress", async () => {
    await render(<ViewerScreen />);
    await screen.findByText("IMG_5.HEIC");
    expect(download().fileId).toBe(5);
    await act(() =>
      download().progress({ downloaded: 42, size: 100, localUri: null }),
    );
    expect(
      screen.getByText("12 Aug 2024 · 8.4 MB · Downloading 42%"),
    ).toBeOnTheScreen();
    await act(() =>
      download().progress({
        downloaded: 100,
        size: 100,
        localUri: "file:///td/5.jpg",
      }),
    );
    expect(screen.getByText("12 Aug 2024 · 8.4 MB")).toBeOnTheScreen();
  });

  it("does not download a photo that is on the device", async () => {
    mockParams.current = { folderId: "Goa 2024", messageId: "2" };
    await render(<ViewerScreen />);
    expect(await screen.findByText("IMG_2.HEIC")).toBeOnTheScreen();
    expect(mockStack.options.title).toBe("3 of 3");
    expect(view).not.toHaveBeenCalled();
  });

  it("opens a filmstrip file, and stops the download of the last page", async () => {
    await render(<ViewerScreen />);
    await screen.findByText("IMG_5.HEIC");
    await fireEvent.press(
      screen.getByRole("button", { name: "Photo, IMG_2.HEIC" }),
    );
    expect(mockStack.options.title).toBe("3 of 3");
    expect(stop).toHaveBeenCalled();
  });

  it("follows a swipe to the next file", async () => {
    await render(<ViewerScreen />);
    await screen.findByText("IMG_5.HEIC");
    await act(() => gallery().onIndexChange?.(1));
    expect(mockStack.options.title).toBe("2 of 3");
    expect(download().fileId).toBe(4);
  });

  it("loads the thumbnails near the open page", async () => {
    await render(<ViewerScreen />);
    await screen.findByText("IMG_5.HEIC");
    expect(thumb).toHaveBeenCalledWith(1005);
    expect(thumb).toHaveBeenCalledWith(1004);
    expect(thumb).toHaveBeenCalledWith(1002);
  });

  it("hides the bars on a tap and shows them on the next", async () => {
    await render(<ViewerScreen />);
    await screen.findByText("IMG_5.HEIC");
    await act(() => gallery().onTap?.());
    expect(mockStack.options.headerShown).toBe(false);
    expect(screen.queryByText("IMG_5.HEIC")).toBeNull();
    await act(() => gallery().onTap?.());
    expect(mockStack.options.headerShown).toBe(true);
    expect(screen.getByText("IMG_5.HEIC")).toBeOnTheScreen();
  });

  it("closes on a swipe down", async () => {
    await render(<ViewerScreen />);
    await screen.findByText("IMG_5.HEIC");
    gallery().onSwipeToClose?.();
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("shows the actions disabled until they work", async () => {
    await render(<ViewerScreen />);
    await screen.findByText("IMG_5.HEIC");
    for (const name of ["Share", "Save", "Copy", "Delete"])
      expect(screen.getByRole("button", { name })).toBeDisabled();
  });

  it("shows a download error on the meta line", async () => {
    await render(<ViewerScreen />);
    await screen.findByText("IMG_5.HEIC");
    await act(() =>
      download().error({ kind: "failed", code: "FILE_ID_INVALID" }),
    );
    expect(
      screen.getByText("The file did not load (FILE_ID_INVALID)."),
    ).toBeOnTheScreen();
  });
});

describe("Viewer 10 — video", () => {
  beforeEach(() => {
    mockParams.current = { folderId: "Goa 2024", messageId: "4" };
  });

  it("shows the download line and the scrubber while the video downloads", async () => {
    await render(<ViewerScreen />);
    expect(
      await screen.findByText("Downloading · from Telegram"),
    ).toBeOnTheScreen();
    expect(mockStack.options.title).toBe("2 of 3");
    await act(() =>
      download().progress({ downloaded: 62, size: 100, localUri: null }),
    );
    expect(
      screen.getByText("Downloading 62% · from Telegram"),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText("Play position")).toBeOnTheScreen();
    expect(screen.getAllByText("0:00")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Play" })).toBeOnTheScreen();
  });

  it("hides the bars on a tap on the video page", async () => {
    await render(<ViewerScreen />);
    await screen.findByText("Downloading · from Telegram");
    expect(gallery().onTap).toBeUndefined();
    await act(() =>
      fireGestureHandler(getByGestureTestId("video-page-tap"), [
        { state: State.BEGAN },
        { state: State.ACTIVE },
        { state: State.END },
      ]),
    );
    expect(mockStack.options.headerShown).toBe(false);
    expect(screen.queryByLabelText("Play position")).toBeNull();
  });

  it("hides the download line when the whole video is on the device", async () => {
    await render(<ViewerScreen />);
    await screen.findByText("Downloading · from Telegram");
    await act(() =>
      download().progress({
        downloaded: 100,
        size: 100,
        localUri: "file:///td/4.mp4",
      }),
    );
    expect(screen.queryByText(/from Telegram/)).toBeNull();
  });

  it("shows the rate limit with the wait time on the download line", async () => {
    await render(<ViewerScreen />);
    await screen.findByText("Downloading · from Telegram");
    await act(() =>
      download().error({
        kind: "rate_limited",
        code: "FLOOD_WAIT_120",
        retryAfter: 120,
      }),
    );
    expect(
      screen.getByText("Telegram asks the app to wait 120 s. Then try again."),
    ).toBeOnTheScreen();
  });
});

describe("Viewer — states", () => {
  it("shows only the dark page while the folder loads", async () => {
    load.mockReturnValue(new Promise(() => {}));
    await render(<ViewerScreen />);
    expect(mockGallery.props).toBeNull();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });

  it("shows an error when the folder does not load", async () => {
    load.mockResolvedValue({
      ok: false,
      error: { kind: "failed", code: "DB_ERROR" },
    });
    await render(<ViewerScreen />);
    expect(await screen.findByText("The file did not load")).toBeOnTheScreen();
    expect(
      screen.getByText("The file did not load (DB_ERROR)."),
    ).toBeOnTheScreen();
    expect(mockGallery.props).toBeNull();
  });

  it("shows the rate limit when the folder does not load", async () => {
    load.mockResolvedValue({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_60", retryAfter: 60 },
    });
    await render(<ViewerScreen />);
    expect(
      await screen.findByText(
        "Telegram asks the app to wait 60 s. Then try again.",
      ),
    ).toBeOnTheScreen();
  });

  it("tells the user when the file is not in the folder now", async () => {
    mockParams.current = { folderId: "Goa 2024", messageId: "99" };
    await render(<ViewerScreen />);
    expect(
      await screen.findByText("This file is not here now"),
    ).toBeOnTheScreen();
  });
});
