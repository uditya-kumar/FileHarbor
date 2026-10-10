import { fireEvent, render, screen } from "@testing-library/react-native";

import FoldersScreen from "@/app/(tabs)/folders";
import { getDirSummaries } from "@/index/db";
import { syncIndex } from "@/index/sync";

jest.mock("@/index/sync", () => ({ syncIndex: jest.fn() }));
jest.mock("@/index/db", () => ({ getDirSummaries: jest.fn() }));

const sync = syncIndex as jest.Mock;
const dirs = getDirSummaries as jest.Mock;

const report = {
  scanned: 612,
  indexed: 600,
  other: 10,
  skipped: [
    { messageId: 41, caption: "fileharbor:1:{", reason: "bad_caption" },
    {
      messageId: 42,
      caption: 'fileharbor:1:{"path":[],"name":"a"}',
      reason: "not_document",
    },
  ],
};

beforeEach(() => {
  sync.mockReset().mockResolvedValue({ ok: true, value: report });
  dirs.mockReset().mockResolvedValue({
    ok: true,
    value: [
      { dirPath: "", fileCount: 1 },
      { dirPath: "Holiday/Beach", fileCount: 599 },
    ],
  });
});

describe("Folders — temporary sync report (5.7)", () => {
  it("shows the counts, each folder path, and each skipped caption", async () => {
    await render(<FoldersScreen />);
    expect(await screen.findByText("Sync report")).toBeOnTheScreen();
    expect(
      screen.getByText("612 messages · 600 files · 10 other · 2 skipped"),
    ).toBeOnTheScreen();
    expect(screen.getByText("/ · 1 file")).toBeOnTheScreen();
    expect(screen.getByText("/Holiday/Beach · 599 files")).toBeOnTheScreen();
    expect(
      screen.getByText('Message 41 · caption does not parse: "fileharbor:1:{"'),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Message 42 · not a document: "fileharbor:1:{\\"path\\":[],\\"name\\":\\"a\\"}"',
      ),
    ).toBeOnTheScreen();
  });

  it("shows the progress while it reads", async () => {
    sync.mockImplementation((onProgress: (n: number) => void) => {
      onProgress(200);
      return new Promise(() => undefined);
    });
    await render(<FoldersScreen />);
    expect(screen.getByText("Reading Saved Messages")).toBeOnTheScreen();
    expect(screen.getByText("200 messages read")).toBeOnTheScreen();
  });

  it("shows the empty state", async () => {
    sync.mockResolvedValue({
      ok: true,
      value: { scanned: 3, indexed: 0, other: 3, skipped: [] },
    });
    dirs.mockResolvedValue({ ok: true, value: [] });
    await render(<FoldersScreen />);
    expect(
      await screen.findByText("No file has a FileHarbor caption."),
    ).toBeOnTheScreen();
  });

  it("shows a flood wait as a warning, not an error", async () => {
    sync.mockResolvedValue({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_30", retryAfter: 30 },
    });
    await render(<FoldersScreen />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Telegram is rate-limiting. Try again in 30 s.",
    );
    expect(dirs).not.toHaveBeenCalled();
  });

  it("shows an error, and syncs again on the button", async () => {
    sync.mockResolvedValueOnce({
      ok: false,
      error: { kind: "failed", code: "CHAT_NOT_FOUND" },
    });
    await render(<FoldersScreen />);
    expect(
      await screen.findByText("The sync did not complete: CHAT_NOT_FOUND"),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sync again" }));
    expect(await screen.findByText("Sync report")).toBeOnTheScreen();
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("shows a database error", async () => {
    dirs.mockResolvedValue({ ok: false, message: "disk I/O error" });
    await render(<FoldersScreen />);
    expect(
      await screen.findByText("The sync did not complete: disk I/O error"),
    ).toBeOnTheScreen();
  });
});
