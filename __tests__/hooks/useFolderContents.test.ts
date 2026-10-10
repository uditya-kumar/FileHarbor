import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useFolderContents } from "@/hooks/useFolderContents";
import { loadFolderFiles, loadThumbnail, syncIndex } from "@/index/sync";
import type { FolderFile } from "@/types/domain";

jest.mock("@/index/sync", () => ({
  loadFolderFiles: jest.fn(),
  loadThumbnail: jest.fn(),
  syncIndex: jest.fn(),
}));

const load = loadFolderFiles as jest.Mock;
const thumb = loadThumbnail as jest.Mock;

const file = (
  messageId: number,
  over: Partial<FolderFile> = {},
): FolderFile => ({
  messageId,
  dirPath: "Goa",
  name: `IMG_${messageId}.jpg`,
  date: 1,
  size: 1,
  mimeType: "image/jpeg",
  kind: "photo",
  fileId: messageId,
  localUri: null,
  thumbnailFileId: messageId + 1000,
  thumbnailUri: null,
  placeholderUri: "data:image/jpeg;base64,/9j/",
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (syncIndex as jest.Mock).mockResolvedValue({ ok: true, value: {} });
  thumb.mockImplementation(async (id: number) => ({
    ok: true,
    value: `file:///thumb/${id}.jpg`,
  }));
});

async function loaded(files: FolderFile[]) {
  load.mockResolvedValue({ ok: true, value: files });
  const hook = await renderHook(() => useFolderContents("Goa"));
  await waitFor(() => expect(hook.result.current.status).toBe("grid"));
  return hook;
}

describe("useFolderContents thumbnails", () => {
  it("downloads the thumbnail of each visible cell once, and shows it", async () => {
    const { result } = await loaded([file(3), file(2), file(1)]);
    await act(async () => result.current.onVisible(["3", "2"]));
    await act(async () => result.current.onVisible(["3", "2", "1"]));
    expect(thumb.mock.calls.map((c) => c[0])).toEqual([1003, 1002, 1001]);
    expect(result.current.cells.map((c) => c.imageUri)).toEqual([
      "file:///thumb/1003.jpg",
      "file:///thumb/1002.jpg",
      "file:///thumb/1001.jpg",
    ]);
  });

  it("does not download a thumbnail that is on the device, or a file with none", async () => {
    const { result } = await loaded([
      file(2, { thumbnailUri: "file:///td/2.jpg" }),
      file(1, { thumbnailFileId: null, kind: "other", placeholderUri: null }),
    ]);
    await act(async () => result.current.onVisible(["2", "1", "99"]));
    expect(thumb).not.toHaveBeenCalled();
    expect(result.current.cells[0].imageUri).toBe("file:///td/2.jpg");
    expect(result.current.cells[1]).toMatchObject({
      imageUri: null,
      placeholderUri: null,
      accessibilityLabel: "File, IMG_1.jpg",
    });
  });

  it("shows a downloaded photo, but never a video file, when there is no thumbnail", async () => {
    const { result } = await loaded([
      file(2, { thumbnailFileId: null, localUri: "file:///td/2.jpg" }),
      file(1, {
        kind: "video",
        thumbnailFileId: null,
        localUri: "file:///td/1.mp4",
      }),
    ]);
    expect(result.current.cells.map((c) => c.imageUri)).toEqual([
      "file:///td/2.jpg",
      null,
    ]);
    expect(result.current.cells[1].isVideo).toBe(true);
  });

  it("keeps the placeholder when a thumbnail download fails", async () => {
    thumb.mockResolvedValue({
      ok: false,
      error: { kind: "failed", code: "X" },
    });
    const { result } = await loaded([file(1)]);
    await act(async () => result.current.onVisible(["1"]));
    expect(result.current.cells[0]).toMatchObject({
      imageUri: null,
      placeholderUri: "data:image/jpeg;base64,/9j/",
    });
  });
});

describe("useFolderContents selection", () => {
  const MB = 1024 ** 2;
  const sized = [file(3, { size: 3 * MB }), file(2, { size: 1 * MB }), file(1)];

  async function selecting(selected: ReadonlySet<string> | null) {
    load.mockResolvedValue({ ok: true, value: sized });
    const hook = await renderHook(
      (props: { selected: ReadonlySet<string> | null }) =>
        useFolderContents("Goa", props.selected),
      { initialProps: { selected } },
    );
    await waitFor(() => expect(hook.result.current.status).toBe("grid"));
    return hook;
  }

  it("gives no selection and no selected state outside selection", async () => {
    const { result } = await selecting(null);
    expect(result.current.selection).toBeNull();
    expect(result.current.cells.map((c) => c.selected)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(result.current.keys).toEqual(["3", "2", "1"]);
  });

  it("gives the count, the size, and the download label of the selected files", async () => {
    const { result, rerender } = await selecting(new Set(["3", "2"]));
    expect(result.current.selection).toMatchObject({
      count: 2,
      title: "2 selected",
      summary: "4 MB selected",
      downloadLabel: "Download 2 items",
      allSelected: false,
    });
    expect(result.current.cells.map((c) => c.selected)).toEqual([
      true,
      true,
      false,
    ]);
    await rerender({ selected: new Set(["3"]) });
    expect(result.current.selection?.downloadLabel).toBe("Download 1 item");
    await rerender({ selected: new Set(["1", "2", "3"]) });
    expect(result.current.selection?.allSelected).toBe(true);
  });

  it("counts only the files that are still in the folder", async () => {
    const { result } = await selecting(new Set(["99"]));
    expect(result.current.selection).toMatchObject({
      count: 0,
      title: "0 selected",
      downloadLabel: "Download",
      allSelected: false,
    });
  });
});
