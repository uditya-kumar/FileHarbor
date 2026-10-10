import { act, fireEvent, render, screen } from "@testing-library/react-native";

import FileSheetScreen from "@/app/(tabs)/folders/[folderId]/[messageId]";
import { loadFolderFiles, viewFile } from "@/index/sync";
import { copyToFolder, pickSaveFolder } from "@/media/saveToDevice";
import type { FileProgress, FolderFile, ServiceError } from "@/types/domain";

import { mockParams, mockRouter, resetAuthMocks } from "./authMocks";

jest.mock("expo-router", () => require("./authMocks").expoRouterModule);
jest.mock("@/index/sync", () => ({
  loadFolderFiles: jest.fn(),
  viewFile: jest.fn(),
}));
jest.mock("@/media/saveToDevice", () => ({
  pickSaveFolder: jest.fn(),
  copyToFolder: jest.fn(),
}));

const load = loadFolderFiles as jest.Mock;
const view = viewFile as jest.Mock;
const pick = pickSaveFolder as jest.Mock;
const copy = copyToFolder as jest.Mock;

const MB = 1024 ** 2;
const DATE = new Date(2024, 7, 12, 12).getTime() / 1000;
const FOLDER = { uri: "content://tree/Download", name: "Download" };
const NOTE =
  "This type can't be previewed in the app. Download it, then open it with another app.";

const report = (over: Partial<FolderFile> = {}): FolderFile => ({
  messageId: 7,
  dirPath: "Work Docs",
  name: "Q3_Report_final.pdf",
  date: DATE,
  size: 4.2 * MB,
  mimeType: "application/pdf",
  kind: "other",
  fileId: 70,
  localUri: null,
  thumbnailFileId: null,
  thumbnailUri: null,
  placeholderUri: null,
  ...over,
});

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
const downloadButton = () =>
  screen.getByRole("button", { name: "Download to device" });

beforeEach(() => {
  resetAuthMocks();
  mockParams.current = { folderId: "Work Docs", messageId: "7" };
  load.mockReset().mockResolvedValue({ ok: true, value: [report()] });
  view.mockReset().mockReturnValue(stop);
  pick.mockReset().mockResolvedValue({ ok: true, value: FOLDER });
  copy.mockReset().mockResolvedValue({ ok: true, value: undefined });
});

describe("File sheet 11 — loaded", () => {
  it("shows the file, its details, and the note", async () => {
    await render(<FileSheetScreen />);
    expect(await screen.findByText("Q3_Report_final.pdf")).toBeOnTheScreen();
    expect(load).toHaveBeenCalledWith("Work Docs");
    expect(screen.getByText("4.2 MB · PDF · 12 Aug 2024")).toBeOnTheScreen();
    expect(screen.getByText(NOTE)).toBeOnTheScreen();
    expect(downloadButton()).toBeEnabled();
    expect(view).not.toHaveBeenCalled();
  });

  it("closes on Cancel", async () => {
    await render(<FileSheetScreen />);
    await screen.findByText("Q3_Report_final.pdf");
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});

describe("File sheet 11 — download to device", () => {
  it("asks for a folder, downloads with progress, and saves with the caption name", async () => {
    await render(<FileSheetScreen />);
    await screen.findByText("Q3_Report_final.pdf");
    await fireEvent.press(downloadButton());
    expect(pick).toHaveBeenCalled();
    expect(download().fileId).toBe(70);
    expect(screen.getByText("Downloading 0% from Telegram.")).toBeOnTheScreen();
    await act(() =>
      download().progress({ downloaded: 42, size: 100, localUri: null }),
    );
    expect(
      screen.getByText("Downloading 42% from Telegram."),
    ).toBeOnTheScreen();
    await act(() =>
      download().progress({
        downloaded: 100,
        size: 100,
        localUri: "file:///td/Q3.pdf",
      }),
    );
    expect(copy).toHaveBeenCalledWith(
      "file:///td/Q3.pdf",
      FOLDER,
      "Q3_Report_final.pdf",
      "application/pdf",
    );
    expect(
      screen.getByText('Saved in "Download". Open it with another app.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Done" })).toBeOnTheScreen();
    // A completed download is not cancelled.
    expect(stop).toHaveBeenCalled();
  });

  it("copies a file that is on the device without a download", async () => {
    load.mockResolvedValue({
      ok: true,
      value: [report({ localUri: "file:///td/Q3.pdf" })],
    });
    await render(<FileSheetScreen />);
    await screen.findByText("Q3_Report_final.pdf");
    await fireEvent.press(downloadButton());
    expect(view).not.toHaveBeenCalled();
    expect(copy).toHaveBeenCalledWith(
      "file:///td/Q3.pdf",
      FOLDER,
      "Q3_Report_final.pdf",
      "application/pdf",
    );
  });

  it("does nothing when the user closes the folder picker", async () => {
    pick.mockResolvedValue({ ok: true, value: null });
    await render(<FileSheetScreen />);
    await screen.findByText("Q3_Report_final.pdf");
    await fireEvent.press(downloadButton());
    expect(view).not.toHaveBeenCalled();
    expect(screen.getByText(NOTE)).toBeOnTheScreen();
    expect(downloadButton()).toBeEnabled();
  });

  it("stops the download when the sheet closes", async () => {
    await render(<FileSheetScreen />);
    await screen.findByText("Q3_Report_final.pdf");
    await fireEvent.press(downloadButton());
    expect(view).toHaveBeenCalled();
    await screen.unmount();
    expect(stop).toHaveBeenCalled();
    expect(copy).not.toHaveBeenCalled();
  });
});

describe("File sheet 11 — errors", () => {
  it("shows the rate limit with the wait time", async () => {
    await render(<FileSheetScreen />);
    await screen.findByText("Q3_Report_final.pdf");
    await fireEvent.press(downloadButton());
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
    expect(copy).not.toHaveBeenCalled();
    // The user can try again.
    expect(downloadButton()).toBeEnabled();
  });

  it("shows a download error", async () => {
    await render(<FileSheetScreen />);
    await screen.findByText("Q3_Report_final.pdf");
    await fireEvent.press(downloadButton());
    await act(() =>
      download().error({ kind: "failed", code: "FILE_ID_INVALID" }),
    );
    expect(
      screen.getByText("The file did not download (FILE_ID_INVALID)."),
    ).toBeOnTheScreen();
  });

  it("shows a save error", async () => {
    copy.mockResolvedValue({
      ok: false,
      error: { kind: "failed", code: "ERR_NO_SPACE" },
    });
    load.mockResolvedValue({
      ok: true,
      value: [report({ localUri: "file:///td/Q3.pdf" })],
    });
    await render(<FileSheetScreen />);
    await screen.findByText("Q3_Report_final.pdf");
    await fireEvent.press(downloadButton());
    expect(
      screen.getByText("The file was not saved (ERR_NO_SPACE)."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeOnTheScreen();
  });

  it("shows an error when the folder does not load", async () => {
    load.mockResolvedValue({
      ok: false,
      error: { kind: "failed", code: "DB_ERROR" },
    });
    await render(<FileSheetScreen />);
    expect(
      await screen.findByText("The file did not load (DB_ERROR)."),
    ).toBeOnTheScreen();
    expect(downloadButton()).toBeDisabled();
  });

  it("shows the rate limit when the folder does not load", async () => {
    load.mockResolvedValue({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_60", retryAfter: 60 },
    });
    await render(<FileSheetScreen />);
    expect(
      await screen.findByText(
        "Telegram asks the app to wait 60 s. Then try again.",
      ),
    ).toBeOnTheScreen();
  });

  it("tells the user when the file is not in the folder now", async () => {
    mockParams.current = { folderId: "Work Docs", messageId: "99" };
    await render(<FileSheetScreen />);
    expect(
      await screen.findByText("This file is not here now."),
    ).toBeOnTheScreen();
    expect(downloadButton()).toBeDisabled();
  });

  it("shows the loading note and no file until the folder loads", async () => {
    load.mockReturnValue(new Promise(() => {}));
    await render(<FileSheetScreen />);
    expect(screen.getByText("Loading the file.")).toBeOnTheScreen();
    expect(screen.queryByText("Q3_Report_final.pdf")).toBeNull();
    expect(downloadButton()).toBeDisabled();
  });
});
