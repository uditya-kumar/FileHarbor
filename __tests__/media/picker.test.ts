import { launchImageLibraryAsync } from "expo-image-picker";

import { mediaFileName } from "@/media/gallery";
import { pickOneForUpload } from "@/media/picker";

jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("@/media/gallery", () => ({ mediaFileName: jest.fn() }));

const launch = launchImageLibraryAsync as jest.Mock;
const realName = mediaFileName as jest.Mock;

beforeEach(() => {
  launch.mockReset();
  realName.mockReset().mockResolvedValue(null);
});

const picked = (asset: Record<string, unknown>) => ({
  canceled: false,
  assets: [{ width: 1, height: 1, type: "video", ...asset }],
});

describe("pickOneForUpload", () => {
  it("asks for the original bytes: quality 1, no editing", async () => {
    launch.mockResolvedValue({ canceled: true, assets: null });
    await pickOneForUpload();
    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ["images", "videos"],
        allowsEditing: false,
        quality: 1,
      }),
    );
  });

  it("gives the picked file with its gallery name, as a cache copy", async () => {
    launch.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///data/cache/ImagePicker/abc.mp4",
          fileName: "VID_0032.mp4",
          mimeType: "video/mp4",
          fileSize: 1234,
          type: "video",
          width: 1,
          height: 1,
        },
      ],
    });
    await expect(pickOneForUpload()).resolves.toEqual({
      ok: true,
      value: {
        uri: "file:///data/cache/ImagePicker/abc.mp4",
        name: "VID_0032.mp4",
        mimeType: "video/mp4",
        size: 1234,
        kind: "video",
        temporary: true,
      },
    });
  });

  it("uses the file name of the URI when the gallery gives no name", async () => {
    launch.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: "file:///c/My%20pic.jpg", type: "image", width: 1, height: 1 },
      ],
    });
    const res = await pickOneForUpload();
    expect(res.ok && res.value).toMatchObject({
      name: "My pic.jpg",
      kind: "photo",
      size: 0,
      mimeType: "",
    });
  });

  it("gives null when the user closes the picker, and an error when it fails", async () => {
    launch.mockResolvedValueOnce({ canceled: true, assets: null });
    await expect(pickOneForUpload()).resolves.toEqual({
      ok: true,
      value: null,
    });
    launch.mockRejectedValueOnce(new Error("no activity"));
    await expect(pickOneForUpload()).resolves.toEqual({
      ok: false,
      error: { kind: "failed", code: "PICK_FAILED" },
    });
  });
});

describe("pickOneForUpload — the real file name (task 8.7)", () => {
  it("reads the media store name of a photo picker item", async () => {
    // The Android photo picker names the item after its media id (device test, 8.5).
    launch.mockResolvedValue(
      picked({ uri: "file:///c/x.mp4", fileName: "1000159075.mp4" }),
    );
    realName.mockResolvedValue("graphify_2026-10-21_10-38-31.mp4");
    const res = await pickOneForUpload();
    expect(realName).toHaveBeenCalledWith("1000159075", "video");
    expect(res.ok && res.value?.name).toBe("graphify_2026-10-21_10-38-31.mp4");
  });

  it("uses the assetId when the picker gives it", async () => {
    launch.mockResolvedValue(
      picked({
        uri: "file:///c/x.jpg",
        fileName: "IMG_1.jpg",
        assetId: "42",
        type: "image",
      }),
    );
    await pickOneForUpload();
    expect(realName).toHaveBeenCalledWith("42", "photo");
  });

  it("keeps the picker name with no read access, or with no media id", async () => {
    launch.mockResolvedValueOnce(
      picked({ uri: "file:///c/x.mp4", fileName: "1000159075.mp4" }),
    );
    const res = await pickOneForUpload();
    expect(res.ok && res.value?.name).toBe("1000159075.mp4");

    launch.mockResolvedValueOnce(
      picked({ uri: "file:///c/x.mp4", fileName: "VID_0032.mp4" }),
    );
    realName.mockClear();
    await pickOneForUpload();
    expect(realName).not.toHaveBeenCalled();
  });
});
