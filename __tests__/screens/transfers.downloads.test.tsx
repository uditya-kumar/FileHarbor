import { act, fireEvent, render, screen } from "@testing-library/react-native";

import DownloadsScreen from "@/app/(tabs)/transfers/downloads";
import UploadsScreen from "@/app/(tabs)/transfers/uploads";
import { fetchFile, stopFile, watchFiles } from "@/index/sync";
import {
  addDownloads,
  pauseDownload,
  resetDownloadsForTests,
} from "@/transfer/downloads";
import type { FolderFile, ServiceResult } from "@/types/domain";

import { mockRouter, resetAuthMocks } from "./authMocks";

jest.mock("expo-router", () => require("./authMocks").expoRouterModule);
jest.mock("@/index/sync", () => ({
  fetchFile: jest.fn(),
  stopFile: jest.fn(),
  watchFiles: jest.fn(),
}));
jest.mock("expo-image", () => ({ Image: () => null }));

const fetch = fetchFile as jest.Mock;
const stop = stopFile as jest.Mock;
const watch = watchFiles as jest.Mock;

const MB = 1024 ** 2;
const file = (fileId: number, over: Partial<FolderFile> = {}): FolderFile => ({
  messageId: fileId * 10,
  dirPath: "Goa 2024",
  name: `IMG_${fileId}.HEIC`,
  date: 1,
  size: 10 * MB,
  mimeType: "image/heic",
  kind: "photo",
  fileId,
  localUri: null,
  thumbnailFileId: null,
  thumbnailUri: null,
  placeholderUri: null,
  ...over,
});

const pending = new Map<number, (r: ServiceResult<string>) => void>();

beforeEach(() => {
  resetAuthMocks();
  resetDownloadsForTests();
  pending.clear();
  fetch.mockReset().mockImplementation(
    (fileId: number) =>
      new Promise<ServiceResult<string>>((resolve) => {
        pending.set(fileId, resolve);
      }),
  );
  stop.mockReset().mockResolvedValue({ ok: true, value: undefined });
  watch.mockReset().mockReturnValue(() => {});
});

/** Five downloading or queued files, and one paused file, as in frame 12. */
function fill(): void {
  addDownloads([
    file(1),
    file(2, { name: "VID_0032.mp4", kind: "video", mimeType: "video/mp4" }),
    file(3),
    file(4),
    file(5, {
      name: "Costs_2024.xlsx",
      kind: "other",
      size: 1.2 * MB,
      mimeType: "application/vnd.ms-excel",
    }),
    file(6),
  ]);
  pauseDownload(6);
}

describe("Downloads 12 — empty", () => {
  it("tells the user how to add files", async () => {
    await render(<DownloadsScreen />);
    expect(screen.getByText("No downloads")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Downloads" })).toBeSelected();
  });
});

describe("Downloads 12 — list", () => {
  it("shows the summary, the hint, and each row with its status", async () => {
    fill();
    await render(<DownloadsScreen />);
    expect(
      screen.getByText("4 downloading · 1 queued · 1 paused"),
    ).toBeOnTheScreen();
    expect(screen.getByText("4 files download in parallel")).toBeOnTheScreen();
    expect(screen.getByText("VID_0032.mp4")).toBeOnTheScreen();
    expect(screen.getByText("Queued · 1.2 MB")).toBeOnTheScreen();
    expect(screen.getByText("Paused · 0 B of 10 MB")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Queued Costs_2024.xlsx" }),
    ).toBeDisabled();
  });

  it("pauses a file that downloads, and resumes a paused file", async () => {
    fill();
    await render(<DownloadsScreen />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Pause IMG_1.HEIC" }),
    );
    expect(stop).toHaveBeenCalledWith(1);
    // A place is free, so the queued file starts.
    expect(fetch).toHaveBeenLastCalledWith(5);
    expect(
      screen.getByRole("button", { name: "Resume IMG_1.HEIC" }),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Resume IMG_6.HEIC" }),
    );
    // File 6 waits in the queue: four files download.
    expect(
      screen.getByText("4 downloading · 1 queued · 1 paused"),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Queued IMG_6.HEIC" }),
    ).toBeDisabled();
  });

  it("takes a complete file out of the list, and shows empty at the end", async () => {
    addDownloads([file(1)]);
    await render(<DownloadsScreen />);
    expect(screen.getByText("1 downloading")).toBeOnTheScreen();
    await act(async () => {
      pending.get(1)?.({ ok: true, value: "file:///td/1.heic" });
    });
    expect(screen.getByText("No downloads")).toBeOnTheScreen();
  });
});

describe("Downloads 12 — errors", () => {
  it("shows a rate limit with the wait time, and starts the file again", async () => {
    addDownloads([file(1)]);
    await render(<DownloadsScreen />);
    await act(async () => {
      pending.get(1)?.({
        ok: false,
        error: { kind: "rate_limited", code: "FLOOD_WAIT_30", retryAfter: 30 },
      });
    });
    expect(screen.getByText("1 failed")).toBeOnTheScreen();
    expect(
      screen.getByText("Telegram asks the app to wait 30 s. Then try again."),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Try again IMG_1.HEIC" }),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("1 downloading")).toBeOnTheScreen();
  });

  it("shows another error", async () => {
    addDownloads([file(1)]);
    await render(<DownloadsScreen />);
    await act(async () => {
      pending.get(1)?.({
        ok: false,
        error: { kind: "failed", code: "FILE_ID_INVALID" },
      });
    });
    expect(
      screen.getByText("Not downloaded (FILE_ID_INVALID). Try again."),
    ).toBeOnTheScreen();
  });
});

describe("Transfers switch", () => {
  it("goes from Downloads to Uploads and back", async () => {
    await render(<DownloadsScreen />);
    await fireEvent.press(screen.getByRole("tab", { name: "Uploads" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/transfers/uploads");
    await render(<UploadsScreen />);
    expect(screen.getByRole("tab", { name: "Uploads" })).toBeSelected();
    await fireEvent.press(screen.getByRole("tab", { name: "Downloads" }));
    expect(mockRouter.replace).toHaveBeenLastCalledWith("/transfers/downloads");
  });
});
