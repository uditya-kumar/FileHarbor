import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { Colors } from "@/constants/Colors";
import { TransferRow } from "@components/fileHarbourComponent/transfers/TransferRow";

type ImageProps = { source: { uri: string } | null; recyclingKey: string };
const mockImage = jest.fn<null, [ImageProps]>(() => null);
jest.mock("expo-image", () => ({
  Image: (props: ImageProps) => mockImage(props),
}));

const base = {
  name: "IMG_4821.HEIC",
  detail: "12.4 MB of 51.8 MB · 2.1 MB/s",
  icon: "image",
  thumbnailUri: null,
  placeholderUri: null,
  recyclingKey: "70",
  actionIcon: "pause",
  actionLabel: "Pause IMG_4821.HEIC",
} as const;

beforeEach(() => mockImage.mockClear());

describe("TransferRow", () => {
  it("shows the name and the detail, and calls the action", async () => {
    const onAction = jest.fn();
    await render(<TransferRow {...base} onAction={onAction} />);
    expect(screen.getByText("IMG_4821.HEIC")).toBeOnTheScreen();
    expect(screen.getByText("12.4 MB of 51.8 MB · 2.1 MB/s")).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Pause IMG_4821.HEIC" }),
    );
    expect(onAction).toHaveBeenCalledTimes(1);
    // No thumbnail: the tile shows the type icon, not an image.
    expect(mockImage).not.toHaveBeenCalled();
  });

  it("shows the thumbnail with its recycling key", async () => {
    await render(
      <TransferRow
        {...base}
        thumbnailUri="file:///t/70.jpg"
        onAction={jest.fn()}
      />,
    );
    expect(mockImage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { uri: "file:///t/70.jpg" },
        recyclingKey: "70",
      }),
    );
  });

  it("disables the action when it has no handler (a queued file)", async () => {
    await render(
      <TransferRow
        {...base}
        detail="Queued · 1.2 MB"
        actionIcon="play"
        actionLabel="Queued IMG_4821.HEIC"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Queued IMG_4821.HEIC" }),
    ).toBeDisabled();
  });

  it("shows a rate limit in warn and an error in danger", async () => {
    const detailColor = (text: string) =>
      StyleSheet.flatten(screen.getByText(text).props.style).color;
    const { rerender } = await render(
      <TransferRow {...base} detail="Wait 30 s" detailTone="warn" />,
    );
    expect(detailColor("Wait 30 s")).toBe(Colors.light.warn);
    await rerender(
      <TransferRow {...base} detail="Not downloaded" detailTone="danger" />,
    );
    expect(detailColor("Not downloaded")).toBe(Colors.light.danger);
    await rerender(<TransferRow {...base} />);
    expect(detailColor(base.detail)).toBe(Colors.light.textTertiary);
  });
});

describe("TransferRow — selected (14)", () => {
  it("shows the check in place of the thumbnail, and takes the press", async () => {
    const onPress = jest.fn();
    const onLongPress = jest.fn();
    await render(
      <TransferRow
        {...base}
        thumbnailUri="file:///t/70.jpg"
        onAction={jest.fn()}
        selected
        onPress={onPress}
        onLongPress={onLongPress}
      />,
    );
    const row = screen.getByLabelText(`${base.name}, ${base.detail}`);
    expect(row).toBeSelected();
    expect(mockImage).not.toHaveBeenCalled();
    const detail = StyleSheet.flatten(
      screen.getByText(base.detail).props.style,
    );
    expect(detail.color).toBe(Colors.light.textSecondary);
    await fireEvent.press(row);
    await fireEvent(row, "longPress");
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("is not selected by default", async () => {
    await render(<TransferRow {...base} onPress={jest.fn()} />);
    expect(
      screen.getByLabelText(`${base.name}, ${base.detail}`),
    ).not.toBeSelected();
  });
});
