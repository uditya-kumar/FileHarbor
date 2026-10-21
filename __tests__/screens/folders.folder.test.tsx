import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";

import FolderScreen from "@/app/(tabs)/folders/[folderId]";
import { loadFolderFiles, loadThumbnail, syncIndex } from "@/index/sync";
import {
  getReadAccess,
  getSaveAccess,
  requestReadAccess,
  requestSaveAccess,
} from "@/media/gallery";
import { pickOneForUpload } from "@/media/picker";
import { addDownloads } from "@/transfer/downloads";
import { uploadFile } from "@/transfer/queue";
import type { FolderFile, ServiceResult } from "@/types/domain";

import { mockParams, mockRouter, mockStack, resetAuthMocks } from "./authMocks";

jest.mock("expo-router", () => require("./authMocks").expoRouterModule);
jest.mock("@/index/sync", () => ({
  loadFolderFiles: jest.fn(),
  loadThumbnail: jest.fn(),
  syncIndex: jest.fn(),
}));
jest.mock("@/media/gallery", () => ({
  getReadAccess: jest.fn(async () => "granted"),
  getSaveAccess: jest.fn(),
  requestReadAccess: jest.fn(async () => "granted"),
  requestSaveAccess: jest.fn(),
}));
jest.mock("@/media/picker", () => ({ pickOneForUpload: jest.fn() }));
jest.mock("@/transfer/queue", () => ({ uploadFile: jest.fn() }));
jest.mock("@/transfer/downloads", () => ({
  addDownloads: jest.fn(),
  MAX_PARALLEL_DOWNLOADS: 4,
}));
// The grid cells are checked in components/gallery.test.tsx.
jest.mock("expo-image", () => ({ Image: () => null }));

const load = loadFolderFiles as jest.Mock;
const thumb = loadThumbnail as jest.Mock;
const sync = syncIndex as jest.Mock;
const add = addDownloads as jest.Mock;
const getAccess = getSaveAccess as jest.Mock;
const pick = pickOneForUpload as jest.Mock;
const upload = uploadFile as jest.Mock;
const requestAccess = requestSaveAccess as jest.Mock;

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
  add.mockReset().mockReturnValue(1);
  getAccess.mockReset().mockResolvedValue("granted");
  requestAccess.mockReset().mockResolvedValue("granted");
  pick.mockReset().mockResolvedValue({
    ok: true,
    value: {
      uri: "file:///c/IMG_9.jpg",
      name: "IMG_9.jpg",
      mimeType: "image/jpeg",
      size: 2 * MB,
      kind: "photo",
      temporary: true,
    },
  });
  upload.mockReset();
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

describe("Folder 07 — open a file", () => {
  it("opens a photo or a video in the viewer", async () => {
    await render(<FolderScreen />);
    await fireEvent.press(await screen.findByLabelText("Video, clip.mp4"));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/viewer/[folderId]/[messageId]",
      params: { folderId: "Goa 2024/Beach", messageId: "2" },
    });
  });

  it("opens sheet 11 for another file", async () => {
    await render(<FolderScreen />);
    await fireEvent.press(await screen.findByLabelText("File, notes.pdf"));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/folders/[folderId]/[messageId]",
      params: { folderId: "Goa 2024/Beach", messageId: "1" },
    });
  });

  it("selects, and does not open, a file during the selection", async () => {
    await render(<FolderScreen />);
    await fireEvent(
      await screen.findByLabelText("Photo, IMG_3.jpg"),
      "longPress",
    );
    await fireEvent.press(screen.getByLabelText("Video, clip.mp4"));
    expect(mockRouter.push).not.toHaveBeenCalled();
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

  it("adds the selected files to the Downloads tab and closes the selection", async () => {
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await longPress("Photo, IMG_3.jpg");
    await fireEvent.press(screen.getByLabelText("Video, clip.mp4"));
    expect(screen.getByText("4 files download in parallel")).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Download 2 items" }),
    );
    expect(add).toHaveBeenCalledTimes(1);
    expect((add.mock.calls[0] as [FolderFile[]])[0].map((f) => f.name)).toEqual(
      ["IMG_3.jpg", "clip.mp4"],
    );
    expect(mockStack.options.title).toBe("Beach");
    expect(screen.getByText("3 items · 6 MB")).toBeOnTheScreen();
    // The app has gallery access: Android shows no prompt.
    expect(requestAccess).not.toHaveBeenCalled();
  });

  it("asks for gallery access, and downloads when the user allows it", async () => {
    getAccess.mockResolvedValue("undetermined");
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await longPress("Photo, IMG_3.jpg");
    await fireEvent.press(
      screen.getByRole("button", { name: "Download 1 item" }),
    );
    expect(requestAccess).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it("keeps the selection and tells the user when there is no gallery access", async () => {
    getAccess.mockResolvedValue("denied");
    requestAccess.mockResolvedValue("denied");
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await longPress("Photo, IMG_3.jpg");
    await fireEvent.press(
      screen.getByRole("button", { name: "Download 1 item" }),
    );
    expect(add).not.toHaveBeenCalled();
    expect(mockStack.options.title).toBe("1 selected");
    expect(
      screen.getByText(
        "No access to the gallery. Tap Download again, then allow it.",
      ),
    ).toBeOnTheScreen();

    // The user allows it on the second prompt.
    requestAccess.mockResolvedValue("granted");
    await fireEvent.press(
      screen.getByRole("button", { name: "Download 1 item" }),
    );
    expect(add).toHaveBeenCalledTimes(1);
    expect(mockStack.options.title).toBe("Beach");
  });

  it("sends the user to Android Settings when Android does not ask again", async () => {
    getAccess.mockResolvedValue("blocked");
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await longPress("Video, clip.mp4");
    await fireEvent.press(
      screen.getByRole("button", { name: "Download 1 item" }),
    );
    // Android shows no prompt again: the app does not ask.
    expect(requestAccess).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "No access to the gallery. Allow it for FileHarbor in Android Settings.",
      ),
    ).toBeOnTheScreen();
  });

  it("downloads a document with no gallery access", async () => {
    getAccess.mockResolvedValue("blocked");
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await longPress("File, notes.pdf");
    await fireEvent.press(
      screen.getByRole("button", { name: "Download 1 item" }),
    );
    expect(getAccess).not.toHaveBeenCalled();
    expect(add).toHaveBeenCalledTimes(1);
  });

  it("does not download with no file selected, and does not delete yet", async () => {
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await headerButton("headerRight", "Select");
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
    await fireEvent.press(screen.getByLabelText("Photo, IMG_3.jpg"));
    expect(
      screen.getByRole("button", { name: "Download 1 item" }),
    ).toBeEnabled();
    // Delete is a Telegram write (Phase 8).
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(add).not.toHaveBeenCalled();
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

describe("Folder 07 — upload one file", () => {
  const uploadButton = () =>
    screen.getByRole("button", { name: "Upload a photo or video" });

  it("uploads the picked file to this folder, shows the state, and reads the folder again", async () => {
    let finish: (r: ServiceResult<void>) => void = () => {};
    upload.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await fireEvent.press(uploadButton());
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({ name: "IMG_9.jpg" }),
      "Goa 2024/Beach",
      expect.any(Function),
    );
    expect(screen.getByText("Uploading IMG_9.jpg")).toBeOnTheScreen();
    // One upload at a time.
    expect(uploadButton()).toBeDisabled();

    load.mockResolvedValue({
      ok: true,
      value: [...files, file(9, { name: "IMG_9.jpg" })],
    });
    await act(async () => finish({ ok: true, value: undefined }));
    expect(screen.getByText("IMG_9.jpg is uploaded.")).toBeOnTheScreen();
    expect(await screen.findByText("4 items · 8 MB")).toBeOnTheScreen();
    expect(uploadButton()).toBeEnabled();
    // The upload synced already: the screen reads the folder only.
    expect(sync).not.toHaveBeenCalled();
  });

  it("asks for read access before the picker opens, and opens it when access is denied", async () => {
    const order: string[] = [];
    (getReadAccess as jest.Mock).mockImplementationOnce(async () => {
      order.push("check");
      return "undetermined";
    });
    (requestReadAccess as jest.Mock).mockImplementationOnce(async () => {
      order.push("ask");
      return "denied";
    });
    pick.mockImplementationOnce(async () => {
      order.push("pick");
      return { ok: true, value: null };
    });
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await fireEvent.press(uploadButton());
    expect(order).toEqual(["check", "ask", "pick"]);
  });

  it("shows a rate limit with the wait time", async () => {
    upload.mockResolvedValue({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_12", retryAfter: 12 },
    });
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await fireEvent.press(uploadButton());
    expect(
      screen.getByText("Telegram asks the app to wait 12 s. Then try again."),
    ).toBeOnTheScreen();
  });

  it("shows the button in an empty folder, and not during a selection", async () => {
    load.mockResolvedValue({ ok: true, value: [] });
    await render(<FolderScreen />);
    await screen.findByText("No files yet");
    expect(uploadButton()).toBeOnTheScreen();

    load.mockResolvedValue({ ok: true, value: files });
    await render(<FolderScreen />);
    await screen.findByText("3 items · 6 MB");
    await longPress("Photo, IMG_3.jpg");
    expect(
      screen.queryByRole("button", { name: "Upload a photo or video" }),
    ).toBeNull();
  });
});
