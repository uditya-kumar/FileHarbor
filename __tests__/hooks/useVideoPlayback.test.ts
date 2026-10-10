import { act, renderHook } from "@testing-library/react-native";

import { useVideoPlayback } from "@/hooks/useVideoPlayback";

// A fake player for each source, as useVideoPlayer makes a new player for a new source.
type Handler = (payload?: unknown) => void;
type FakePlayer = {
  source: string | null;
  timeUpdateEventInterval: number;
  currentTime: number;
  play: jest.Mock;
  pause: jest.Mock;
  replay: jest.Mock;
  seekBy: jest.Mock;
  emit: (event: string, payload?: unknown) => void;
  addListener: (event: string, h: Handler) => { remove: () => void };
};
const mockPlayers: FakePlayer[] = [];
jest.mock("expo-video", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const make = (source: string | null): FakePlayer => {
    const handlers = new Map<string, Set<Handler>>();
    const player: FakePlayer = {
      source,
      timeUpdateEventInterval: 0,
      currentTime: 0,
      play: jest.fn(),
      pause: jest.fn(),
      replay: jest.fn(),
      seekBy: jest.fn(),
      emit: (event, payload) => handlers.get(event)?.forEach((h) => h(payload)),
      addListener: (event, h) => {
        const set = handlers.get(event) ?? new Set<Handler>();
        set.add(h);
        handlers.set(event, set);
        return { remove: () => set.delete(h) };
      },
    };
    mockPlayers.push(player);
    return player;
  };
  return {
    useVideoPlayer: (source: string | null, setup?: (p: FakePlayer) => void) =>
      React.useMemo(() => {
        const p = make(source);
        setup?.(p);
        return p;
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [source]),
  };
});

const last = (): FakePlayer => mockPlayers[mockPlayers.length - 1];

beforeEach(() => {
  mockPlayers.length = 0;
});

describe("useVideoPlayback", () => {
  it("gives no player until the whole file is on the device", async () => {
    const { result } = await renderHook(() => useVideoPlayback("2", null));
    expect(result.current.player).toBeNull();
    expect(result.current.total).toBe("0:00");
    expect(result.current.seek).toBeUndefined();
  });

  it("plays, pauses, and replays at the end", async () => {
    const { result } = await renderHook(() =>
      useVideoPlayback("2", "file:///td/2.mp4"),
    );
    const p = last();
    expect(result.current.player).toBe(p);
    expect(p.timeUpdateEventInterval).toBe(0.25);
    await act(() => p.emit("sourceLoad", { duration: 24 }));
    await act(() => result.current.toggle());
    expect(p.play).toHaveBeenCalledTimes(1);
    await act(() => p.emit("playingChange", { isPlaying: true }));
    await act(() => p.emit("timeUpdate", { currentTime: 12 }));
    expect(result.current.playing).toBe(true);
    expect(result.current.played).toBe(0.5);
    expect(result.current.elapsed).toBe("0:12");
    expect(result.current.total).toBe("0:24");
    await act(() => result.current.toggle());
    expect(p.pause).toHaveBeenCalledTimes(1);
    await act(() => {
      p.emit("playingChange", { isPlaying: false });
      p.emit("playToEnd");
    });
    await act(() => result.current.toggle());
    expect(p.replay).toHaveBeenCalledTimes(1);
  });

  it("seeks to a part of the video", async () => {
    const { result } = await renderHook(() =>
      useVideoPlayback("2", "file:///td/2.mp4"),
    );
    const p = last();
    await act(() => p.emit("sourceLoad", { duration: 20 }));
    p.currentTime = 5;
    await act(() => result.current.seek?.(0.75));
    expect(p.seekBy).toHaveBeenCalledWith(10);
  });

  it("keeps a tap on Play while the video downloads, and plays when it loads", async () => {
    const { result, rerender } = await renderHook(
      ({ uri }: { uri: string | null }) => useVideoPlayback("2", uri),
      { initialProps: { uri: null } },
    );
    await act(() => result.current.toggle());
    // The button shows Pause, so the user sees that the tap is kept.
    expect(result.current.playing).toBe(true);
    await rerender({ uri: "file:///td/2.mp4" });
    const p = last();
    expect(p.play).not.toHaveBeenCalled();
    await act(() => p.emit("sourceLoad", { duration: 24 }));
    expect(p.play).toHaveBeenCalledTimes(1);
  });

  it("starts a new video from 0:00", async () => {
    const { result, rerender } = await renderHook(
      ({ uri }: { uri: string }) => useVideoPlayback(uri, uri),
      { initialProps: { uri: "file:///td/2.mp4" } },
    );
    await act(() => {
      last().emit("sourceLoad", { duration: 24 });
      last().emit("timeUpdate", { currentTime: 12 });
    });
    await rerender({ uri: "file:///td/3.mp4" });
    expect(result.current.elapsed).toBe("0:00");
    expect(result.current.played).toBe(0);
  });
});
