import { fireEvent, render, screen } from "@testing-library/react-native";

import { Platform, StyleSheet } from "react-native";

import { Colors } from "@/constants/Colors";
import { Banner } from "@components/fileHarbourComponent/shared/Banner";
import { Button } from "@components/fileHarbourComponent/shared/Button";
import { ButtonRow } from "@components/fileHarbourComponent/shared/ButtonRow";
import { Checkbox } from "@components/fileHarbourComponent/shared/Checkbox";
import { InputField } from "@components/fileHarbourComponent/shared/InputField";
import { ListRow } from "@components/fileHarbourComponent/shared/ListRow";
import { ProgressBar } from "@components/fileHarbourComponent/shared/ProgressBar";
import { RowList } from "@components/fileHarbourComponent/shared/RowList";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { SearchField } from "@components/fileHarbourComponent/shared/SearchField";
import { SectionHeader } from "@components/fileHarbourComponent/shared/SectionHeader";
import { SheetGrabber } from "@components/fileHarbourComponent/shared/SheetGrabber";
import { TitleBlock } from "@components/fileHarbourComponent/shared/TitleBlock";

describe("Button", () => {
  it("calls onPress", async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled or loading", async () => {
    const onPress = jest.fn();
    const { rerender } = await render(
      <Button label="Continue" onPress={onPress} disabled />,
    );
    await fireEvent.press(screen.getByRole("button"));
    await rerender(<Button label="Continue" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("hides the label while loading", async () => {
    await render(<Button label="Continue" onPress={jest.fn()} loading />);
    expect(screen.queryByText("Continue")).not.toBeOnTheScreen();
  });

  it("uses accessibilityLabel for an icon-only button", async () => {
    await render(
      <Button
        icon="log-out"
        accessibilityLabel="Log out"
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Log out" })).toBeOnTheScreen();
  });

  it("renders the header variant as an icon button", async () => {
    const onPress = jest.fn();
    await render(
      <Button
        variant="header"
        icon="circle-plus"
        accessibilityLabel="New folder"
        onPress={onPress}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "New folder" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("keeps the 08 gap to the title only for a headerLeft button", async () => {
    await render(
      <>
        <Button
          variant="header"
          icon="x"
          headerLeading
          accessibilityLabel="Close selection"
          onPress={jest.fn()}
        />
        <Button
          variant="header"
          icon="list-checks"
          accessibilityLabel="Select all"
          onPress={jest.fn()}
        />
      </>,
    );
    const marginEnd = (name: string) =>
      StyleSheet.flatten(screen.getByRole("button", { name }).props.style)
        .marginEnd;
    expect(marginEnd("Close selection")).toBe(22);
    expect(marginEnd("Select all")).toBeUndefined();
  });

  it("renders the pill size with a label, and as a circle with an icon only", async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Button
          size="pill"
          icon="arrow-down-to-line"
          label="Download 2 items"
          onPress={onPress}
        />
        <Button
          size="pill"
          variant="destructive"
          icon="trash-2"
          accessibilityLabel="Delete"
          onPress={onPress}
        />
      </>,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Download 2 items" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("puts the label under the icon for the viewer actions", async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Button
          variant="viewer"
          iconPosition="top"
          icon="share-2"
          label="Share"
          onPress={onPress}
        />
        <Button
          variant="viewerDestructive"
          iconPosition="top"
          icon="trash-2"
          label="Delete"
          onPress={onPress}
        />
      </>,
    );
    const share = StyleSheet.flatten(screen.getByText("Share").props.style);
    expect(share.fontSize).toBe(10);
    expect(share.color).toBe(Colors.light.viewerTextSecondary);
    expect(
      StyleSheet.flatten(screen.getByText("Delete").props.style).color,
    ).toBe(Colors.light.viewerDanger);
    await fireEvent.press(screen.getByRole("button", { name: "Share" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("ProgressBar", () => {
  /** Gives the bar a width, as a layout pass does on a device. */
  const layOut = async (width: number) =>
    fireEvent(screen.getByLabelText("Play position"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width, height: 12 } },
    });

  it("shows the value as a percentage, inside 0 to 100", async () => {
    const { rerender } = await render(
      <ProgressBar value={0.42} accessibilityLabel="Play position" />,
    );
    const bar = () => screen.getByLabelText("Play position");
    expect(bar().props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 42,
    });
    expect(bar().props.accessibilityRole).toBe("progressbar");
    await rerender(
      <ProgressBar value={1.7} accessibilityLabel="Play position" />,
    );
    expect(bar().props.accessibilityValue.now).toBe(100);
    await rerender(
      <ProgressBar value={-1} accessibilityLabel="Play position" />,
    );
    expect(bar().props.accessibilityValue.now).toBe(0);
  });

  it("seeks to the tapped point", async () => {
    const onSeek = jest.fn();
    await render(
      <ProgressBar
        value={0}
        tone="viewer"
        knob
        onSeek={onSeek}
        accessibilityLabel="Play position"
      />,
    );
    await layOut(200);
    await fireEvent.press(screen.getByLabelText("Play position"), {
      nativeEvent: { locationX: 50 },
    });
    expect(onSeek).toHaveBeenCalledWith(0.25);
    expect(screen.getByLabelText("Play position").props.accessibilityRole).toBe(
      "adjustable",
    );
  });

  it("moves 10 % for each screen-reader step, and stops at the ends", async () => {
    const onSeek = jest.fn();
    await render(
      <ProgressBar
        value={0.95}
        onSeek={onSeek}
        accessibilityLabel="Play position"
      />,
    );
    const bar = screen.getByLabelText("Play position");
    await fireEvent(bar, "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    });
    await fireEvent(bar, "accessibilityAction", {
      nativeEvent: { actionName: "decrement" },
    });
    expect(onSeek).toHaveBeenNthCalledWith(1, 1);
    expect(onSeek.mock.calls[1][0]).toBeCloseTo(0.85);
  });

  it("does not seek without onSeek", async () => {
    await render(
      <ProgressBar value={0.5} accessibilityLabel="Play position" />,
    );
    await layOut(200);
    await fireEvent.press(screen.getByLabelText("Play position"), {
      nativeEvent: { locationX: 50 },
    });
    expect(
      screen.getByLabelText("Play position").props.accessibilityActions,
    ).toBeUndefined();
  });
});

describe("Checkbox", () => {
  it("shows the tick only when checked", async () => {
    const { rerender, toJSON } = await render(<Checkbox checked={false} />);
    const unchecked = JSON.stringify(toJSON());
    await rerender(<Checkbox checked size="sm" />);
    expect(JSON.stringify(toJSON())).not.toBe(unchecked);
    // It shows state only; the row or cell around it gives the accessibility state.
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("ButtonRow", () => {
  it("renders each button", async () => {
    await render(
      <ButtonRow>
        <Button
          label="Cancel"
          variant="secondary"
          fullWidth
          onPress={jest.fn()}
        />
        <Button label="Create" fullWidth onPress={jest.fn()} />
      </ButtonRow>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});

describe("ListRow", () => {
  it("renders the title and the subtitle, and calls onPress", async () => {
    const onPress = jest.fn();
    await render(
      <ListRow
        icon="folder"
        title="Goa 2024"
        subtitle="148 items · 2.4 GB"
        trailing="chevron"
        onPress={onPress}
      />,
    );
    expect(screen.getByText("148 items · 2.4 GB")).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole("button", { name: "Goa 2024, 148 items · 2.4 GB" }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is not a button without onPress", async () => {
    await render(<ListRow title="Goa 2024" />);
    expect(screen.queryByRole("button")).not.toBeOnTheScreen();
  });
});

describe("RowList", () => {
  it("renders the header and a row for each item", async () => {
    await render(
      <RowList
        data={["A", "B"]}
        keyExtractor={(x) => x}
        header={<SectionHeader title="2 Folders · 0 B" />}
        renderItem={({ item }) => <ListRow title={item} />}
      />,
    );
    expect(screen.getByText("2 Folders · 0 B")).toBeOnTheScreen();
    expect(screen.getByText("A")).toBeOnTheScreen();
    expect(screen.getByText("B")).toBeOnTheScreen();
  });
});

describe("SearchField", () => {
  it("reports changes, and clears with the clear button", async () => {
    const onChange = jest.fn();
    await render(
      <SearchField value="" onChangeText={onChange} placeholder="Search" />,
    );
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText("Search"), "goa");
    expect(onChange).toHaveBeenCalledWith("goa");

    await render(
      <SearchField value="goa" onChangeText={onChange} placeholder="Search" />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});

describe("SectionHeader", () => {
  it("renders the title as a header and the subtitle", async () => {
    await render(<SectionHeader title="Downloads" subtitle="2 active" />);
    expect(screen.getByRole("header", { name: "Downloads" })).toBeOnTheScreen();
    expect(screen.getByText("2 active")).toBeOnTheScreen();
  });
});

describe("SheetGrabber", () => {
  const os = Platform.OS;
  afterEach(() => {
    Platform.OS = os;
  });

  it("renders on Android, and not on iOS (the native grabber shows there)", async () => {
    Platform.OS = "android";
    const { toJSON, rerender } = await render(<SheetGrabber />);
    expect(toJSON()).not.toBeNull();
    Platform.OS = "ios";
    await rerender(<SheetGrabber />);
    expect(toJSON()).toBeNull();
  });
});

describe("InputField", () => {
  it("shows the label and reports changes", async () => {
    const onChangeText = jest.fn();
    await render(
      <InputField label="Phone number" value="" onChangeText={onChangeText} />,
    );
    await fireEvent.changeText(screen.getByLabelText("Phone number"), "98765");
    expect(onChangeText).toHaveBeenCalledWith("98765");
  });

  it("edits the prefix separately", async () => {
    const onChangePrefix = jest.fn();
    await render(
      <InputField
        label="Phone number"
        value=""
        onChangeText={jest.fn()}
        prefix="+91"
        onChangePrefix={onChangePrefix}
      />,
    );
    await fireEvent.changeText(
      screen.getByLabelText("Phone number country code"),
      "+44",
    );
    expect(onChangePrefix).toHaveBeenCalledWith("+44");
  });

  it("toggles a secure value", async () => {
    await render(
      <InputField
        label="Password"
        value="secret"
        onChangeText={jest.fn()}
        secure
      />,
    );
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
    await fireEvent.press(
      screen.getByRole("button", { name: "Show password" }),
    );
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
  });

  it("shows the error instead of the hint", async () => {
    await render(
      <InputField
        label="Password"
        value=""
        onChangeText={jest.fn()}
        hint="Hint"
        error="Wrong"
      />,
    );
    expect(screen.getByText("Wrong")).toBeOnTheScreen();
    expect(screen.queryByText("Hint")).not.toBeOnTheScreen();
  });

  it("shows a hint with an icon", async () => {
    await render(
      <InputField
        label="Name"
        value=""
        onChangeText={jest.fn()}
        hint="A note"
        hintIcon="info"
      />,
    );
    expect(screen.getByText("A note")).toBeOnTheScreen();
  });
});

describe("TitleBlock", () => {
  it("renders the title as a header and the body", async () => {
    await render(
      <TitleBlock
        icon="cloud"
        title="Sign in with Telegram"
        body="Files are stored."
      />,
    );
    expect(
      screen.getByRole("header", { name: "Sign in with Telegram" }),
    ).toBeOnTheScreen();
    expect(screen.getByText("Files are stored.")).toBeOnTheScreen();
  });

  it("renders the centred empty state with its action", async () => {
    const onPress = jest.fn();
    await render(
      <TitleBlock
        align="center"
        icon="folder-open"
        title="No folders yet"
        body="Create a folder."
        action={<Button label="New folder" onPress={onPress} />}
      />,
    );
    expect(
      screen.getByRole("header", { name: "No folders yet" }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "New folder" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("Banner", () => {
  it("renders the text", async () => {
    await render(
      <Banner icon="shield-check" text="Stored only on this device." />,
    );
    expect(screen.getByText("Stored only on this device.")).toBeOnTheScreen();
  });

  it("is an alert in the warn tone", async () => {
    await render(
      <Banner
        icon="timer"
        tone="warn"
        text="Rate-limited — resuming in 4:12"
      />,
    );
    expect(screen.getByRole("alert")).toBeOnTheScreen();
  });
});

describe("Screen", () => {
  it("renders the children, the footer, and the footer note", async () => {
    await render(
      <Screen
        footer={<Button label="Continue" onPress={jest.fn()} />}
        footerNote="A note"
      >
        <TitleBlock title="Title" />
      </Screen>,
    );
    expect(screen.getByText("Title")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Continue" })).toBeOnTheScreen();
    expect(screen.getByText("A note")).toBeOnTheScreen();
  });

  it("renders a fit screen with a muted background", async () => {
    await render(
      <Screen
        fit
        background="muted"
        footer={<Button label="Create" onPress={jest.fn()} />}
      >
        <TitleBlock title="Sheet" />
      </Screen>,
    );
    expect(screen.getByText("Sheet")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Create" })).toBeOnTheScreen();
  });
});
