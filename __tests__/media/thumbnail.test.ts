import { ImageManipulator } from "expo-image-manipulator";
import { getThumbnailAsync } from "expo-video-thumbnails";

import { deleteThumbnail, makeThumbnail } from "@/media/thumbnail";

// The native modules are mocked. The test checks the size math, the video frame, and the
// clean-up, not the JPEG.
const mockDeleted: string[] = [];
jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(path: string) {
      this.uri = path;
    }
    delete(): void {
      mockDeleted.push(this.uri);
    }
  },
}));

type Size = { width: number; height: number };
const mockSource: Size & { fail: boolean } = {
  width: 4032,
  height: 3024,
  fail: false,
};
const mockResized: Size[] = [];
jest.mock("expo-image-manipulator", () => {
  const image = (size: { width: number; height: number }) => ({
    ...size,
    saveAsync: jest.fn(async () => ({
      uri: "file:///cache/thumb.jpg",
      ...size,
    })),
  });
  return {
    SaveFormat: { JPEG: "jpeg" },
    ImageManipulator: {
      manipulate: jest.fn(() => {
        const context = {
          renderAsync: jest.fn(async () => {
            if (mockSource.fail) throw new Error("cannot decode");
            return image(mockSource);
          }),
          resize: jest.fn((size: { width: number; height: number }) => {
            mockResized.push(size);
            return { renderAsync: jest.fn(async () => image(size)) };
          }),
        };
        return context;
      }),
    },
  };
});
jest.mock("expo-video-thumbnails", () => ({
  getThumbnailAsync: jest.fn(async () => ({
    uri: "file:///cache/frame.jpg",
    width: 1920,
    height: 1080,
  })),
}));

const frame = getThumbnailAsync as jest.Mock;
const manipulate = ImageManipulator.manipulate as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleted.length = 0;
  mockResized.length = 0;
  Object.assign(mockSource, { width: 4032, height: 3024, fail: false });
});

describe("makeThumbnail", () => {
  it("fits a photo in 320 px on the longest side, with the same ratio", async () => {
    await expect(makeThumbnail("file:///a.jpg", "photo")).resolves.toEqual({
      uri: "file:///cache/thumb.jpg",
      width: 320,
      height: 240,
    });
    expect(manipulate).toHaveBeenCalledWith("file:///a.jpg");
    Object.assign(mockSource, { width: 1080, height: 2412 });
    await makeThumbnail("file:///b.jpg", "photo");
    expect(mockResized[1]).toEqual({ width: 143, height: 320 });
  });

  it("does not make a small image larger", async () => {
    Object.assign(mockSource, { width: 200, height: 100 });
    await expect(makeThumbnail("file:///s.png", "photo")).resolves.toEqual({
      uri: "file:///cache/thumb.jpg",
      width: 200,
      height: 100,
    });
    expect(mockResized).toEqual([]);
  });

  it("takes a video frame at 1 s, and deletes the frame after", async () => {
    Object.assign(mockSource, { width: 1920, height: 1080 });
    const thumb = await makeThumbnail("file:///v.mp4", "video");
    expect(frame).toHaveBeenCalledWith("file:///v.mp4", { time: 1000 });
    expect(manipulate).toHaveBeenCalledWith("file:///cache/frame.jpg");
    expect(thumb).toMatchObject({ width: 320, height: 180 });
    expect(mockDeleted).toEqual(["file:///cache/frame.jpg"]);
  });

  it("takes the first frame of a video shorter than 1 s", async () => {
    frame.mockRejectedValueOnce(new Error("no frame"));
    await makeThumbnail("file:///short.mp4", "video");
    expect(frame).toHaveBeenLastCalledWith("file:///short.mp4", { time: 0 });
  });

  it("gives no thumbnail for a document, or for an image that cannot be read", async () => {
    await expect(makeThumbnail("file:///a.pdf", "other")).resolves.toBeNull();
    expect(manipulate).not.toHaveBeenCalled();
    mockSource.fail = true;
    await expect(makeThumbnail("file:///bad.jpg", "photo")).resolves.toBeNull();
  });
});

describe("deleteThumbnail", () => {
  it("deletes the file", () => {
    deleteThumbnail({ uri: "file:///cache/thumb.jpg", width: 1, height: 1 });
    expect(mockDeleted).toEqual(["file:///cache/thumb.jpg"]);
  });
});
