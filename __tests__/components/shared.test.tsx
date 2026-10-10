import { fireEvent, render, screen } from "@testing-library/react-native";

import { Banner } from "@components/fileHarbourComponent/shared/Banner";
import { Button } from "@components/fileHarbourComponent/shared/Button";
import { InputField } from "@components/fileHarbourComponent/shared/InputField";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
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
    const { rerender } = await render(<Button label="Continue" onPress={onPress} disabled />);
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
    await render(<Button icon="log-out" accessibilityLabel="Log out" onPress={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Log out" })).toBeOnTheScreen();
  });
});

describe("InputField", () => {
  it("shows the label and reports changes", async () => {
    const onChangeText = jest.fn();
    await render(<InputField label="Phone number" value="" onChangeText={onChangeText} />);
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
    await fireEvent.changeText(screen.getByLabelText("Phone number country code"), "+44");
    expect(onChangePrefix).toHaveBeenCalledWith("+44");
  });

  it("toggles a secure value", async () => {
    await render(<InputField label="Password" value="secret" onChangeText={jest.fn()} secure />);
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
  });

  it("shows the error instead of the hint", async () => {
    await render(
      <InputField label="Password" value="" onChangeText={jest.fn()} hint="Hint" error="Wrong" />,
    );
    expect(screen.getByText("Wrong")).toBeOnTheScreen();
    expect(screen.queryByText("Hint")).not.toBeOnTheScreen();
  });
});

describe("TitleBlock", () => {
  it("renders the title as a header and the body", async () => {
    await render(<TitleBlock icon="cloud" title="Sign in with Telegram" body="Files are stored." />);
    expect(screen.getByRole("header", { name: "Sign in with Telegram" })).toBeOnTheScreen();
    expect(screen.getByText("Files are stored.")).toBeOnTheScreen();
  });
});

describe("Banner", () => {
  it("renders the text", async () => {
    await render(<Banner icon="shield-check" text="Stored only on this device." />);
    expect(screen.getByText("Stored only on this device.")).toBeOnTheScreen();
  });

  it("is an alert in the warn tone", async () => {
    await render(<Banner icon="timer" tone="warn" text="Rate-limited — resuming in 4:12" />);
    expect(screen.getByRole("alert")).toBeOnTheScreen();
  });
});

describe("Screen", () => {
  it("renders the children, the footer, and the footer note", async () => {
    await render(
      <Screen footer={<Button label="Continue" onPress={jest.fn()} />} footerNote="A note">
        <TitleBlock title="Title" />
      </Screen>,
    );
    expect(screen.getByText("Title")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Continue" })).toBeOnTheScreen();
    expect(screen.getByText("A note")).toBeOnTheScreen();
  });
});
