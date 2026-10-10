import { fireEvent, render, screen } from "@testing-library/react-native";

import {
  GalleryGrid,
  type GalleryCell,
} from "@components/fileHarbourComponent/gallery/GalleryGrid";
import { GridCell } from "@components/fileHarbourComponent/gallery/GridCell";
import { SelectionToolbar } from "@components/fileHarbourComponent/gallery/SelectionToolbar";
import { Thumbnail } from "@components/fileHarbourComponent/shared/Thumbnail";

// expo-image is native. The mock records the props of each image that renders.
type ImageProps = {
  source: { uri: string } | null;
  placeholder: { uri: string } | null;
  recyclingKey: string;
  contentFit: string;
  placeholderContentFit: string;
  onLoad?: (e: { source: { width: number; height: number } }) => void;
};
const mockImage = jest.fn<null, [ImageProps]>(() => null);
jest.mock("expo-image", () => ({
  Image: (props: ImageProps) => mockImage(props),
}));
/** The props of the images in the last render, one per image. */
const images = (): ImageProps[] => {
  const byKey = new Map<string, ImageProps>();
  for (const [p] of mockImage.mock.calls) byKey.set(p.recyclingKey, p);
  return [...byKey.values()];
};

beforeEach(() => mockImage.mockClear());

const cell = (n: number, over: Partial<GalleryCell> = {}): GalleryCell => ({
  key: String(n),
  title: `IMG_${n}.jpg`,
  imageUri: `file:///td/${n}.jpg`,
  placeholderUri: null,
  isVideo: false,
  accessibilityLabel: `Photo, IMG_${n}.jpg`,
  ...over,
});

/** GridCell props: React must not get `key` in a spread. */
const cellProps = (n: number, over: Partial<GalleryCell> = {}) => {
  const { key, ...props } = cell(n, over);
  return { ...props, recyclingKey: key };
};

describe("Thumbnail", () => {
  it("passes the recycling key, the source, and the placeholder to expo-image", async () => {
    await render(
      <Thumbnail
        uri="file:///a.jpg"
        placeholderUri="data:image/jpeg;base64,/9j/"
        recyclingKey="42"
      />,
    );
    const [image] = images();
    expect(image.recyclingKey).toBe("42");
    expect(image.source).toEqual({ uri: "file:///a.jpg" });
    expect(image.placeholder).toEqual({ uri: "data:image/jpeg;base64,/9j/" });
    expect(image.contentFit).toBe("cover");
  });

  it("gives no source when there is no image yet", async () => {
    await render(<Thumbnail uri={null} recyclingKey="1" />);
    expect(images()[0].source).toBeNull();
  });

  it("shows all of a photo with contain, and gives its pixel size", async () => {
    const onLoadSize = jest.fn();
    await render(
      <Thumbnail
        uri="file:///a.jpg"
        recyclingKey="7"
        fit="contain"
        onLoadSize={onLoadSize}
      />,
    );
    const [image] = images();
    expect(image.contentFit).toBe("contain");
    expect(image.placeholderContentFit).toBe("contain");
    image.onLoad?.({ source: { width: 4032, height: 3024 } });
    expect(onLoadSize).toHaveBeenCalledWith({ width: 4032, height: 3024 });
  });

  it("sets no onLoad when nobody needs the size", async () => {
    await render(<Thumbnail uri="file:///a.jpg" recyclingKey="8" />);
    expect(images()[0].onLoad).toBeUndefined();
  });
});

describe("GridCell", () => {
  it("shows the image and calls onPress", async () => {
    const onPress = jest.fn();
    await render(<GridCell {...cellProps(1)} onPress={onPress} />);
    expect(images()).toHaveLength(1);
    expect(screen.queryByText("IMG_1.jpg")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Photo, IMG_1.jpg"));
    expect(onPress).toHaveBeenCalled();
  });

  it("shows the file name when there is no image", async () => {
    await render(
      <GridCell
        {...cellProps(2, { imageUri: null, accessibilityLabel: "File, a.pdf" })}
        title="a.pdf"
      />,
    );
    expect(images()).toHaveLength(0);
    expect(screen.getByText("a.pdf")).toBeOnTheScreen();
  });

  it("shows a placeholder only, and the play badge for a video", async () => {
    await render(
      <GridCell
        {...cellProps(3, {
          imageUri: null,
          placeholderUri: "data:image/jpeg;base64,/9j/",
          isVideo: true,
        })}
      />,
    );
    expect(images()[0].source).toBeNull();
    expect(screen.queryByText("IMG_3.jpg")).toBeNull();
  });

  it("gives the selected state only during selection, and calls onLongPress", async () => {
    const onLongPress = jest.fn();
    const { rerender } = await render(
      <GridCell {...cellProps(4)} onPress={jest.fn()} />,
    );
    const label = "Photo, IMG_4.jpg";
    expect(
      screen.getByLabelText(label).props.accessibilityState?.selected,
    ).toBeUndefined();
    await rerender(
      <GridCell
        {...cellProps(4)}
        selected
        onPress={jest.fn()}
        onLongPress={onLongPress}
      />,
    );
    expect(screen.getByLabelText(label)).toBeSelected();
    await fireEvent(screen.getByLabelText(label), "longPress");
    expect(onLongPress).toHaveBeenCalled();
    await rerender(
      <GridCell {...cellProps(4)} selected={false} onPress={jest.fn()} />,
    );
    expect(screen.getByLabelText(label)).not.toBeSelected();
  });
});

describe("SelectionToolbar", () => {
  it("calls its handlers and shows the hint", async () => {
    const onDownload = jest.fn();
    const onDelete = jest.fn();
    await render(
      <SelectionToolbar
        downloadLabel="Download 2 items"
        hint="4 files download in parallel"
        onDownload={onDownload}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText("4 files download in parallel")).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Download 2 items" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    expect(onDownload).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it("disables a button that has no handler", async () => {
    await render(<SelectionToolbar downloadLabel="Download" />);
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});

describe("GalleryGrid", () => {
  it("renders each cell with its key as the recycling key, and the header", async () => {
    const onPressCell = jest.fn();
    await render(
      <GalleryGrid
        cells={[cell(1), cell(2), cell(3), cell(4)]}
        header={<></>}
        onPressCell={onPressCell}
      />,
    );
    expect(images().map((i) => i.recyclingKey)).toEqual(["1", "2", "3", "4"]);
    await fireEvent.press(screen.getByLabelText("Photo, IMG_3.jpg"));
    expect(onPressCell).toHaveBeenCalledWith("3");
  });

  it("gives the key of a long-pressed cell", async () => {
    const onLongPressCell = jest.fn();
    await render(
      <GalleryGrid
        cells={[cell(1), cell(2)]}
        onLongPressCell={onLongPressCell}
      />,
    );
    await fireEvent(screen.getByLabelText("Photo, IMG_2.jpg"), "longPress");
    expect(onLongPressCell).toHaveBeenCalledWith("2");
  });
});
