import { act, renderHook } from "@testing-library/react-native";

import { useUpload } from "@/hooks/useUpload";
import { pickOneForUpload } from "@/media/picker";
import { uploadFile } from "@/transfer/queue";
import type {
  ServiceResult,
  UploadProgress,
  UploadSource,
} from "@/types/domain";

jest.mock("@/media/picker", () => ({ pickOneForUpload: jest.fn() }));
jest.mock("@/transfer/queue", () => ({ uploadFile: jest.fn() }));

const pick = pickOneForUpload as jest.Mock;
const upload = uploadFile as jest.Mock;

const MB = 1024 ** 2;
const source: UploadSource = {
  uri: "file:///c/a.jpg",
  name: "IMG_1.jpg",
  mimeType: "image/jpeg",
  size: 4 * MB,
  kind: "photo",
  temporary: true,
};

let progress: (p: UploadProgress) => void;
let finish: (r: ServiceResult<void>) => void;

beforeEach(() => {
  jest.clearAllMocks();
  pick.mockResolvedValue({ ok: true, value: source });
  upload.mockImplementation(
    (_: UploadSource, __: string, onProgress: typeof progress) =>
      new Promise((resolve) => {
        progress = onProgress;
        finish = resolve;
      }),
  );
});

/** Lets the pick resolve, so uploadFile has started. */
const flush = () => new Promise((r) => setImmediate(r));

describe("useUpload", () => {
  it("shows no notice before a pick, and none when the user closes the picker", async () => {
    pick.mockResolvedValue({ ok: true, value: null });
    const { result } = await renderHook(() => useUpload("Goa", jest.fn()));
    expect(result.current.notice).toBeNull();
    await act(() => result.current.start());
    expect(result.current.notice).toBeNull();
    expect(result.current.busy).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });

  it("uploads to the folder, shows the progress, and reads the folder again", async () => {
    const onUploaded = jest.fn();
    const { result } = await renderHook(() => useUpload("Goa", onUploaded));
    let done: Promise<void> = Promise.resolve();
    await act(async () => {
      done = result.current.start();
    });
    expect(upload).toHaveBeenCalledWith(source, "Goa", expect.any(Function));
    expect(result.current.busy).toBe(true);
    expect(result.current.notice).toEqual({
      text: "Uploading IMG_1.jpg",
      tone: "info",
      icon: "upload",
    });
    await act(() => progress({ uploaded: 1.5 * MB, size: 4 * MB }));
    expect(result.current.notice?.text).toBe(
      "Uploading IMG_1.jpg · 1.5 MB of 4 MB",
    );
    await act(async () => {
      finish({ ok: true, value: undefined });
      await done;
    });
    expect(result.current.notice).toEqual({
      text: "IMG_1.jpg is uploaded.",
      tone: "success",
      icon: "check",
    });
    expect(result.current.busy).toBe(false);
    expect(onUploaded).toHaveBeenCalledTimes(1);
  });

  it("shows a rate limit with warn tones and the wait time", async () => {
    const { result } = await renderHook(() => useUpload("", jest.fn()));
    await act(async () => {
      const done = result.current.start();
      await flush();
      finish({
        ok: false,
        error: { kind: "rate_limited", code: "FLOOD_WAIT_30", retryAfter: 30 },
      });
      await done;
    });
    expect(result.current.notice).toEqual({
      text: "Telegram asks the app to wait 30 s. Then try again.",
      tone: "warn",
      icon: "timer",
    });
  });

  it("shows other errors with danger tones", async () => {
    const onUploaded = jest.fn();
    const { result } = await renderHook(() => useUpload("", onUploaded));
    const fail = async (code: string) =>
      act(async () => {
        const done = result.current.start();
        await flush();
        finish({ ok: false, error: { kind: "failed", code } });
        await done;
      });
    await fail("BAD_NAME");
    expect(result.current.notice).toEqual({
      text: "This file name cannot be used. Rename the file, then upload it.",
      tone: "danger",
      icon: "triangle-alert",
    });
    await fail("FILE_PARTS_INVALID");
    expect(result.current.notice?.text).toBe(
      "Not uploaded (FILE_PARTS_INVALID). Try again.",
    );
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("shows a picker error", async () => {
    pick.mockResolvedValue({
      ok: false,
      error: { kind: "failed", code: "PICK_FAILED" },
    });
    const { result } = await renderHook(() => useUpload("", jest.fn()));
    await act(() => result.current.start());
    expect(result.current.notice?.text).toBe(
      "The gallery did not open. Try again.",
    );
  });
});
