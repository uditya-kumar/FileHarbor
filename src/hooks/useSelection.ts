import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { BackHandler } from "react-native";

// Multi-select state for 08 (folder grid) and 14 (transfer list). The keys are list keys; the
// screen hook maps them to files. Selection lives in UI state only (spec §8.4 order 4).

const NONE: ReadonlySet<string> = new Set();

export function useSelection() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(NONE);

  /** Starts selection, with one key already selected (a long press) or none (the header). */
  const start = useCallback((key?: string): void => {
    setActive(true);
    setSelected(key === undefined ? NONE : new Set([key]));
  }, []);

  const toggle = useCallback((key: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

  /** Selects all of `keys`, or none when all of them are selected already. */
  const toggleAll = useCallback((keys: readonly string[]): void => {
    setSelected((prev) =>
      keys.every((k) => prev.has(k)) ? NONE : new Set(keys),
    );
  }, []);

  const exit = useCallback((): void => {
    setActive(false);
    setSelected(NONE);
  }, []);

  // Android back leaves selection first, as in Google Photos. Only the focused screen listens,
  // so a selection on a tab that is not shown does not take the press.
  useFocusEffect(
    useCallback(() => {
      if (!active) return undefined;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        exit();
        return true;
      });
      return () => sub.remove();
    }, [active, exit]),
  );

  return { active, selected, start, toggle, toggleAll, exit };
}
