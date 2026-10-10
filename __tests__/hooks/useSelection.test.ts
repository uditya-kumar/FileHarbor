import { act, renderHook } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { useSelection } from "@/hooks/useSelection";

jest.mock(
  "expo-router",
  () => require("../screens/authMocks").expoRouterModule,
);

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
type BackEvent = Parameters<BackListener>[0];
const backListeners = new Set<BackListener>();
const remove = jest.fn();

beforeEach(() => {
  backListeners.clear();
  remove.mockClear();
  jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_event, listener) => {
      backListeners.add(listener);
      return {
        remove: () => {
          remove();
          backListeners.delete(listener);
        },
      };
    });
});

const pressBack = (): boolean[] =>
  [...backListeners].map((l) => Boolean(l({} as BackEvent)));

describe("useSelection", () => {
  it("starts with one key from a long press, or none from the header", async () => {
    const { result } = await renderHook(() => useSelection());
    expect(result.current.active).toBe(false);
    await act(async () => result.current.start("3"));
    expect(result.current.active).toBe(true);
    expect([...result.current.selected]).toEqual(["3"]);
    await act(async () => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.selected.size).toBe(0);
  });

  it("toggles one key, and stays in selection with none selected", async () => {
    const { result } = await renderHook(() => useSelection());
    await act(async () => result.current.start("1"));
    await act(async () => result.current.toggle("2"));
    expect([...result.current.selected]).toEqual(["1", "2"]);
    await act(async () => result.current.toggle("1"));
    await act(async () => result.current.toggle("2"));
    expect(result.current.selected.size).toBe(0);
    expect(result.current.active).toBe(true);
  });

  it("selects all, and selects none when all are selected", async () => {
    const { result } = await renderHook(() => useSelection());
    await act(async () => result.current.start("2"));
    await act(async () => result.current.toggleAll(["1", "2", "3"]));
    expect([...result.current.selected]).toEqual(["1", "2", "3"]);
    await act(async () => result.current.toggleAll(["1", "2", "3"]));
    expect(result.current.selected.size).toBe(0);
  });

  it("exits on Android back, and then lets back go through", async () => {
    const { result } = await renderHook(() => useSelection());
    expect(backListeners.size).toBe(0);
    await act(async () => result.current.start("1"));
    expect(backListeners.size).toBe(1);
    let handled: boolean[] = [];
    await act(async () => {
      handled = pressBack();
    });
    expect(handled).toEqual([true]);
    expect(result.current.active).toBe(false);
    expect(result.current.selected.size).toBe(0);
    expect(remove).toHaveBeenCalled();
    expect(backListeners.size).toBe(0);
  });
});
