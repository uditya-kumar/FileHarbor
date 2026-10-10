import { useEffect, useState } from "react";

/**
 * Seconds left from `seconds`, counted from the moment `startKey` changes. Pass a new key
 * (for example a new state object) to restart. Stops at 0.
 */
export function useCountdown(seconds: number, startKey: unknown): number {
  const [state, setState] = useState({ key: startKey, left: seconds });
  // Restart during render when the key changes (React's "adjust state on prop change").
  if (state.key !== startKey) setState({ key: startKey, left: seconds });
  const left = state.key === startKey ? state.left : seconds;

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setState((s) => ({ ...s, left: s.left - 1 })), 1000);
    return () => clearTimeout(id);
  }, [left]);

  return Math.max(0, left);
}

/** 252 → "4:12". */
export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
