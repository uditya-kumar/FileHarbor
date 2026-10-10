import { act, fireEvent, render, screen } from "@testing-library/react-native";

import FoldersScreen from "@/app/(tabs)/folders";
import { getChildFolders } from "@/index/db";
import { syncIndex } from "@/index/sync";
import type { FolderSummary } from "@/types/domain";

import { mockRouter, mockStack, resetAuthMocks } from "./authMocks";

jest.mock("expo-router", () => require("./authMocks").expoRouterModule);
jest.mock("@/index/sync", () => ({ syncIndex: jest.fn() }));
jest.mock("@/index/db", () => ({ getChildFolders: jest.fn() }));

const sync = syncIndex as jest.Mock;
const folders = getChildFolders as jest.Mock;

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const goa: FolderSummary = {
  dirPath: "Goa 2024",
  name: "Goa 2024",
  fileCount: 148,
  totalSize: 2.4 * GB,
  mediaCount: 140,
};
const docs: FolderSummary = {
  dirPath: "Work Docs",
  name: "Work Docs",
  fileCount: 1,
  totalSize: 300 * MB,
  mediaCount: 0,
};
const trip: FolderSummary = {
  dirPath: "Trip",
  name: "Trip",
  fileCount: 0,
  totalSize: 0,
  mediaCount: 0,
};

const report = {
  ok: true,
  value: { scanned: 3, indexed: 3, other: 0, skipped: [] },
};

beforeEach(() => {
  resetAuthMocks();
  sync.mockReset().mockResolvedValue(report);
  folders.mockReset().mockResolvedValue({ ok: true, value: [goa, docs, trip] });
});

describe("Folders 04 — list", () => {
  it("shows each folder with its count and size, and the summary", async () => {
    await render(<FoldersScreen />);
    expect(await screen.findByText("3 Folders · 2.7 GB")).toBeOnTheScreen();
    expect(screen.getByText("Goa 2024")).toBeOnTheScreen();
    expect(screen.getByText("148 items · 2.4 GB")).toBeOnTheScreen();
    expect(screen.getByText("1 item · 300 MB")).toBeOnTheScreen();
    expect(screen.getByText("No files yet")).toBeOnTheScreen();
    expect(folders).toHaveBeenCalledWith("");
  });

  it("shows the cache first, then syncs and reads the cache again", async () => {
    let finish: (v: typeof report) => void = () => {};
    sync.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    // The first focus reads the cache. The sync then reads it again.
    folders.mockResolvedValueOnce({ ok: true, value: [goa] });
    await render(<FoldersScreen />);
    expect(await screen.findByText("1 Folder · 2.4 GB")).toBeOnTheScreen();
    await act(async () => finish(report));
    expect(await screen.findByText("3 Folders · 2.7 GB")).toBeOnTheScreen();
  });

  it("opens the new folder sheet from the header", async () => {
    await render(<FoldersScreen />);
    await screen.findByText("Goa 2024");
    const HeaderRight = mockStack.options.headerRight;
    expect(HeaderRight).toBeDefined();
    await render(<>{HeaderRight?.()}</>);
    await fireEvent.press(screen.getByRole("button", { name: "New folder" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/folders/new");
  });

  it("opens the folder grid (07) from a row", async () => {
    await render(<FoldersScreen />);
    await fireEvent.press(
      await screen.findByRole("button", {
        name: "Goa 2024, 148 items · 2.4 GB",
      }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/folders/[folderId]",
      params: { folderId: "Goa 2024" },
    });
  });

  it("filters by name from the search field above the summary", async () => {
    await render(<FoldersScreen />);
    await screen.findByText("Goa 2024");
    const search = screen.getByLabelText("Search folders by name");
    await fireEvent.changeText(search, " work");
    expect(screen.getByText("1 Folder · 300 MB")).toBeOnTheScreen();
    expect(screen.queryByText("Goa 2024")).not.toBeOnTheScreen();
    await fireEvent.changeText(search, "zzz");
    expect(screen.getByText('No folder name has "zzz".')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("Goa 2024")).toBeOnTheScreen();
  });

  it("keeps the list and shows a warn banner when Telegram rate-limits", async () => {
    sync.mockResolvedValue({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT", retryAfter: 30 },
    });
    await render(<FoldersScreen />);
    expect(
      await screen.findByText(
        "Telegram asks the app to wait 30 s. Then try again.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText("Goa 2024")).toBeOnTheScreen();
  });

  it("keeps the list and shows an error banner when the sync fails", async () => {
    sync.mockResolvedValue({
      ok: false,
      error: { kind: "failed", code: "CHAT_NOT_FOUND" },
    });
    await render(<FoldersScreen />);
    expect(
      await screen.findByText("The folders did not update (CHAT_NOT_FOUND)."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("alert")).toBeOnTheScreen();
  });
});

describe("Folders 05 — empty, loading, and error", () => {
  beforeEach(() => folders.mockResolvedValue({ ok: true, value: [] }));

  it("shows the empty state and opens the sheet", async () => {
    await render(<FoldersScreen />);
    expect(await screen.findByText("No folders yet")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Create a folder, then upload photos and videos into it.",
      ),
    ).toBeOnTheScreen();
    expect(
      screen.queryByLabelText("Search folders by name"),
    ).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "New folder" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/folders/new");
  });

  it("shows the progress of the first sync", async () => {
    sync.mockImplementation((onProgress: (n: number) => void) => {
      onProgress(200);
      return new Promise(() => {});
    });
    await render(<FoldersScreen />);
    expect(await screen.findByText("Reading Saved Messages")).toBeOnTheScreen();
    expect(screen.getByText("200 messages read")).toBeOnTheScreen();
  });

  it("shows an error when the first sync fails, and tries again", async () => {
    sync.mockResolvedValueOnce({
      ok: false,
      error: { kind: "unavailable", code: "not_ready" },
    });
    await render(<FoldersScreen />);
    expect(
      await screen.findByText("The folders did not load"),
    ).toBeOnTheScreen();
    expect(screen.getByText("Telegram is not connected.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No folders yet")).toBeOnTheScreen();
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("shows the rate limit without red when the first sync is rate-limited", async () => {
    sync.mockResolvedValue({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT", retryAfter: 9 },
    });
    await render(<FoldersScreen />);
    expect(
      await screen.findByText("The folders did not load"),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Telegram asks the app to wait 9 s. Then try again."),
    ).toBeOnTheScreen();
  });

  it("shows a database error", async () => {
    folders.mockResolvedValue({ ok: false, message: "disk I/O error" });
    await render(<FoldersScreen />);
    expect(
      await screen.findByText("The folders did not load (disk I/O error)."),
    ).toBeOnTheScreen();
  });
});
