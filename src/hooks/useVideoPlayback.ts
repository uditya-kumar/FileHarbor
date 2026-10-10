import { useVideoPlayer, type VideoPlayer } from "expo-video";
import { useCallback, useEffect, useState } from "react";

import { formatClock } from "@/format/units";

// Playback state for the open video (10). The video plays only when the whole file is on the
// device: ExoPlayer does not read a file that TDLib is still writing (TaskList 7.10). A tap on
// Play before that waits, and the video starts when it loads.

type Clock = {
  /** The player that the values come from. A new file gives a new player. */
  player: VideoPlayer;
  playing: boolean;
  elapsed: number;
  duration: number;
  ended: boolean;
};

/** Seconds between two play-time updates: four steps a second for the scrubber. */
const TIME_STEP = 0.25;

/**
 * @param key The open video (the message id). A tap on Play is kept for this video only.
 * @param uri The file:// URI of the whole video, or null while it downloads.
 */
export function useVideoPlayback(key: string | null, uri: string | null) {
  const player = useVideoPlayer(uri, (p) => {
    p.timeUpdateEventInterval = TIME_STEP;
  });
  const [clock, setClock] = useState<Clock | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const update = (next: Partial<Omit<Clock, "player">>): void =>
      setClock((prev) => ({
        ...(prev?.player === player
          ? prev
          : { playing: false, elapsed: 0, duration: 0, ended: false }),
        ...next,
        player,
      }));
    const subs = [
      player.addListener("playingChange", ({ isPlaying }) =>
        update(
          isPlaying ? { playing: true, ended: false } : { playing: false },
        ),
      ),
      player.addListener("timeUpdate", ({ currentTime }) =>
        update({ elapsed: currentTime }),
      ),
      player.addListener("sourceLoad", ({ duration }) => update({ duration })),
      player.addListener("playToEnd", () => update({ ended: true })),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [player]);

  // A tap on Play while the video downloaded: start it when it loads. The next tap clears it.
  const loaded = clock?.player === player && clock.duration > 0;
  const asked = key !== null && pending === key;
  const waiting = asked && !loaded;
  useEffect(() => {
    if (asked && uri && loaded) player.play();
  }, [asked, uri, loaded, player]);

  const own = clock?.player === player ? clock : null;
  const duration = own?.duration ?? 0;
  const elapsed = own?.elapsed ?? 0;

  const toggle = useCallback((): void => {
    if (!uri) {
      setPending((p) => (p === key ? null : key));
      return;
    }
    setPending(null);
    if (own?.playing) player.pause();
    else if (own?.ended) player.replay();
    else player.play();
  }, [uri, key, own?.playing, own?.ended, player]);

  const seek = useCallback(
    (value: number): void => {
      // A method, not `currentTime =`: the React Compiler does not let a hook value change.
      player.seekBy(value * duration - player.currentTime);
    },
    [player, duration],
  );

  return {
    /** null until the whole file is on the device: the poster shows. */
    player: uri ? player : null,
    /** A waiting tap shows as playing, so the button shows Pause. */
    playing: (own?.playing ?? false) || waiting,
    /** The played part, 0 to 1. */
    played: duration > 0 ? Math.min(1, elapsed / duration) : 0,
    elapsed: formatClock(elapsed),
    total: formatClock(duration),
    /** Not set until the video loads. */
    seek: uri && duration > 0 ? seek : undefined,
    toggle,
  };
}
