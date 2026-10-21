import {
  Asset,
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-media-library";

import {
  getReadAccess,
  getSaveAccess,
  mediaFileName,
  requestReadAccess,
  requestSaveAccess,
  saveToGallery,
} from "@/media/gallery";

// expo-media-library is mocked in jest.setup.ts. expo-file-system is mocked here: the test
// checks the staging copy, not the disk.
const mockFs = {
  copies: [] as { from: string; to: string }[],
  created: [] as string[],
  deleted: [] as string[],
  exists: new Set<string>(),
};

jest.mock("expo-file-system", () => {
  const join = (parts: unknown[]) =>
    parts
      .map((p) => (typeof p === "string" ? p : (p as { uri: string }).uri))
      .join("/");
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists(): boolean {
      return mockFs.exists.has(this.uri);
    }
    create(): void {
      mockFs.created.push(this.uri);
      mockFs.exists.add(this.uri);
    }
    delete(): void {
      mockFs.deleted.push(this.uri);
      mockFs.exists.delete(this.uri);
    }
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    async copy(to: { uri: string }): Promise<void> {
      mockFs.copies.push({ from: this.uri, to: to.uri });
    }
  }
  return { Directory, File, Paths: { cache: "file:///cache" } };
});

const create = Asset.create as jest.Mock;
const getPerm = getPermissionsAsync as jest.Mock;
const requestPerm = requestPermissionsAsync as jest.Mock;

const response = (granted: boolean, status: string, canAskAgain: boolean) => ({
  granted,
  status,
  canAskAgain,
  expires: "never",
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFs.copies = [];
  mockFs.created = [];
  mockFs.deleted = [];
  mockFs.exists.clear();
  create.mockResolvedValue({ id: "asset" });
});

describe("gallery — access", () => {
  it("asks for write access to photos and videos only", async () => {
    getPerm.mockResolvedValueOnce(response(true, "granted", true));
    expect(await getSaveAccess()).toBe("granted");
    expect(getPerm).toHaveBeenCalledWith(true, ["photo", "video"]);
  });

  it("maps the Android answers", async () => {
    requestPerm.mockResolvedValueOnce(response(false, "undetermined", true));
    expect(await requestSaveAccess()).toBe("undetermined");
    requestPerm.mockResolvedValueOnce(response(false, "denied", true));
    expect(await requestSaveAccess()).toBe("denied");
    requestPerm.mockResolvedValueOnce(response(false, "denied", false));
    expect(await requestSaveAccess()).toBe("blocked");
    expect(requestPerm).toHaveBeenCalledWith(true, ["photo", "video"]);
  });

  it("gives denied when the native call fails, and does not throw", async () => {
    getPerm.mockRejectedValueOnce(new Error("no activity"));
    expect(await getSaveAccess()).toBe("denied");
  });

  it("asks for read access to photos and videos for the upload name", async () => {
    getPerm.mockResolvedValueOnce(response(false, "undetermined", true));
    expect(await getReadAccess()).toBe("undetermined");
    expect(getPerm).toHaveBeenCalledWith(false, ["photo", "video"]);
    requestPerm.mockResolvedValueOnce(response(true, "granted", true));
    expect(await requestReadAccess()).toBe("granted");
    expect(requestPerm).toHaveBeenCalledWith(false, ["photo", "video"]);
  });
});

describe("gallery — media file name", () => {
  const AssetClass = Asset as unknown as jest.Mock;

  it("reads the name of the item in the media store", async () => {
    AssetClass.mockImplementationOnce((id: string) => ({
      id,
      getFilename: async () => "graphify_2026-10-21_10-38-31.mp4",
    }));
    await expect(mediaFileName("1000159075", "video")).resolves.toBe(
      "graphify_2026-10-21_10-38-31.mp4",
    );
    expect(AssetClass).toHaveBeenLastCalledWith(
      "content://media/external/video/media/1000159075",
    );
    await mediaFileName("5", "photo");
    expect(AssetClass).toHaveBeenLastCalledWith(
      "content://media/external/images/media/5",
    );
  });

  it("gives null when the app cannot read the item", async () => {
    AssetClass.mockImplementationOnce(() => ({
      getFilename: async () => {
        throw new Error("permission denied");
      },
    }));
    await expect(mediaFileName("1", "photo")).resolves.toBeNull();
  });
});

describe("gallery — save", () => {
  it("saves the TDLib file as it is when it has the caption name", async () => {
    const res = await saveToGallery(
      "file:///td/photos/IMG_1.jpg",
      "IMG_1.jpg",
      7,
    );
    expect(res).toEqual({ ok: true, value: undefined });
    expect(create).toHaveBeenCalledWith("file:///td/photos/IMG_1.jpg");
    expect(mockFs.copies).toEqual([]);
  });

  it("copies the file to the caption name first, and deletes the copy after", async () => {
    const res = await saveToGallery(
      "file:///td/photos/IMG_4821_1.HEIC",
      "Goa: day 1.HEIC",
      7,
    );
    expect(res.ok).toBe(true);
    // A colon is not valid in an Android file name.
    const copy = "file:///cache/gallery/7/Goa_ day 1.HEIC";
    expect(mockFs.copies).toEqual([
      { from: "file:///td/photos/IMG_4821_1.HEIC", to: copy },
    ]);
    expect(create).toHaveBeenCalledWith(copy);
    expect(mockFs.deleted).toEqual(["file:///cache/gallery/7"]);
  });

  it("reads an encoded TDLib name", async () => {
    await saveToGallery("file:///td/photos/My%20trip.jpg", "My trip.jpg", 7);
    expect(mockFs.copies).toEqual([]);
  });

  it("returns the error code when the media library fails, and deletes the copy", async () => {
    create.mockRejectedValueOnce(
      Object.assign(new Error("no space"), { code: "ERR_NO_SPACE" }),
    );
    const res = await saveToGallery("file:///td/a.jpg", "b.jpg", 9);
    expect(res).toEqual({
      ok: false,
      error: { kind: "failed", code: "ERR_NO_SPACE" },
    });
    expect(mockFs.deleted).toEqual(["file:///cache/gallery/9"]);
  });

  it("gives SAVE_FAILED for an error with no code", async () => {
    create.mockRejectedValueOnce(new Error("?"));
    const res = await saveToGallery("file:///td/a.jpg", "a.jpg", 9);
    expect(res).toEqual({
      ok: false,
      error: { kind: "failed", code: "SAVE_FAILED" },
    });
  });
});
