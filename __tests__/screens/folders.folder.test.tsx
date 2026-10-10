import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";

import FolderScreen from "@/app/(tabs)/folders/[folderId]";
import { loadFolderFiles, loadThumbnail, syncIndex } from "@/index/sync";
import type { FolderFile } from "@/types/domain";

import { mockParams, mockStack, resetAuthMocks } from "./authMocks";

jest.mock("expo-router", () => require("./authMocks").expoRouterModule);
jest.mock("@/index/sync", () => ({
  loadFolderFiles: jest.fn(),
  loadThumbnail: jest.fn(),
  syncIndex: jest.fn(),
}));
// The grid cells are checked in components/gallery.test.tsx.
jest.mock("expo-image", () => ({ Image: () => null }));

const load = loadFolderFiles as jest.Mock;
const thumb = loadThumbnail as jest.Mock;
const sync = syncIndex as jest.Mock;

const MB = 1024 ** 2;
const file = (
  messageId: number,
  over: Partial<FolderFile> = {},
): FolderFile => ({
  messageId,
  dirPath: "Goa 2024/Beach",
  name: `IMG_${messageId}.jpg`,
  date: 1,
  size: 2 * MB,
  mimeType: "image/jpeg",
  kind: "photo",
  fileId: messageId,
  localUri: null,
  thumbnailFileId: messageId + 1000,
  thumbnailUri: null,
  placeholderUri: null,
  ...over,
});

const files = [
  file(3),
  file(2, { name: "clip.mp4", kind: "video", mimeType: "video/mp4" }),
  file(1, {
    name: "notes.pdf",
    kind: "other",
    mimeType: "application/pdf",
    thumbnailFileId: null,
  }),
];

beforeEach(() => {
  resetAuthMocks();
  mockParams.current = { folderId: "Goa 2024/Beach" };
  load.mockReset().mockResolvedValue({ ok: true, value: files });
  thumb.mockReset().mockResolvedValue({ ok: true, value: "file:///t.jpg" });
  sync.mockReset().mockResolvedValue({ ok: true, value: {} });
});

describe("Folder 07 — grid", () => {
  it("shows the folder name as the title, the summary, and each file", async () => {
    await render(<FolderScreen />);
    expect(await screen.findByText("3 items · 6 MB")).toBeOnTheScreen();
    expect(load).toHaveBeenCalledWith("Goa 2024/Beach");
    expect(mockStack.options.title).toBe("Beach");
    expect(screen.getByLabelText("Photo, IMG_3.jpg")).toBeOnTheScreen();
    expect(screen.getByLabelText("Video, clip.mp4")).toBeOnTheScreen();
    // A document with no image shows its name.
    expect(screen.getByText("notes.pdf")).toBeOnTheScreen();
  });
});

type HeaderButton = ReactElement<{
  accessibilityLabel: string;
  onPress: () => void;
}>;

/** Presses the header button from the last Stack options. A second render would replace
 *  the screen, so the test calls its onPress. */
async function headerButton(
  slot: "headerLeft" | "headerRight",
  name: string,
): Promise<void> {
  const make = mockStack.options[slot];
  if (!make) throw new Error(`no ${slot}`);
  const button = make() as HeaderButton;
  expect(button.props.accessibilityLabel).toBe(name);
  await act(async () => button.props.onPress());
}

async function longPress(label: string): Promise<void> {
  await act(async () => {
    await fireEvent(screen.getByLabelText(label), "longPress");
  });
}

describe("Folder 08 — multi-select", () => {
  it("starts from a long press with that file selected", async () => {
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await longPress("Photo, IMG_3.jpg");
    expect(mockStack.options.title).toBe("1 selected");
    expect(mockStack.options.headerBackVisible).toBe(false);
    expect(screen.getByText("2 MB selected")).toBeOnTheScreen();
    expect(screen.getByLabelText("Photo, IMG_3.jpg")).toBeSelected();
    expect(screen.getByLabelText("Video, clip.mp4")).not.toBeSelected();
    expect(
      screen.getByRole("button", { name: "Download 1 item" }),
    ).toBeOnTheScreen();
  });

  it("starts from the Select header button, and a press toggles a file", async () => {
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await headerButton("headerRight", "Select");
    expect(mockStack.options.title).toBe("0 selected");
    await fireEvent.press(screen.getByLabelText("Photo, IMG_3.jpg"));
    await fireEvent.press(screen.getByLabelText("Video, clip.mp4"));
    expect(mockStack.options.title).toBe("2 selected");
    expect(screen.getByText("4 MB selected")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Photo, IMG_3.jpg"));
    expect(mockStack.options.title).toBe("1 selected");
  });

  it("selects all, then none", async () => {
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await longPress("Photo, IMG_3.jpg");
    await headerButton("headerRight", "Select all");
    expect(mockStack.options.title).toBe("3 selected");
    expect(
      screen.getByRole("button", { name: "Download 3 items" }),
    ).toBeOnTheScreen();
    await headerButton("headerRight", "Select none");
    expect(mockStack.options.title).toBe("0 selected");
  });

  it("does not download or delete until those steps are built", async () => {
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await longPress("Photo, IMG_3.jpg");
    expect(
      screen.getByRole("button", { name: "Download 1 item" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });

  it("closes the selection and shows the folder again", async () => {
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await longPress("Photo, IMG_3.jpg");
    await headerButton("headerLeft", "Close selection");
    expect(mockStack.options.title).toBe("Beach");
    expect(mockStack.options.headerBackVisible).toBe(true);
    expect(screen.getByText("3 items · 6 MB")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(
      screen.getByLabelText("Photo, IMG_3.jpg").props.accessibilityState
        ?.selected,
    ).toBeUndefined();
  });

  it("shows no Select button when the folder is empty", async () => {
    load.mockResolvedValue({ ok: true, value: [] });
    await render(<FolderScreen />);
    await screen.findByText("No files yet");
    expect(mockStack.options.headerRight).toBeUndefined();
  });
});

describe("Folder 07 — states", () => {
  it("shows the empty state for a folder with no file", async () => {
    load.mockResolvedValue({ ok: true, value: [] });
    await render(<FolderScreen />);
    expect(await screen.findByText("No files yet")).toBeOnTheScreen();
  });

  it("shows an error when the files do not load, and tries again", async () => {
    load.mockResolvedValueOnce({
      ok: false,
      error: { kind: "failed", code: "CHAT_NOT_FOUND" },
    });
    await render(<FolderScreen />);
    expect(
      await screen.findByText("The files did not load (CHAT_NOT_FOUND)."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(sync).toHaveBeenCalled();
    expect(await screen.findByText("3 items · 6 MB")).toBeOnTheScreen();
  });

  it("shows the rate limit with the wait time", async () => {
    load.mockResolvedValueOnce({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_9", retryAfter: 9 },
    });
    await render(<FolderScreen />);
    expect(
      await screen.findByText(
        "Telegram asks the app to wait 9 s. Then try again.",
      ),
    ).toBeOnTheScreen();
  });

  it("does not read the folder again when the refresh sync is rate-limited", async () => {
    load.mockResolvedValueOnce({
      ok: false,
      error: { kind: "failed", code: "X" },
    });
    sync.mockResolvedValueOnce({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_30", retryAfter: 30 },
    });
    await render(<FolderScreen />);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Try again" }),
    );
    expect(
      await screen.findByText(
        "Telegram asks the app to wait 30 s. Then try again.",
      ),
    ).toBeOnTheScreen();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
