import { fireEvent, render, screen } from "@testing-library/react-native";

import NewFolderScreen from "@/app/(tabs)/folders/new";
import { addLocalDir } from "@/index/db";

import { mockRouter, resetAuthMocks } from "./authMocks";

jest.mock("expo-router", () => require("./authMocks").expoRouterModule);
jest.mock("@/index/db", () => ({ addLocalDir: jest.fn() }));

const add = addLocalDir as jest.Mock;

beforeEach(() => {
  resetAuthMocks();
  add.mockReset().mockResolvedValue({ ok: true, value: "added" });
});

async function typeName(name: string): Promise<void> {
  await fireEvent.changeText(screen.getByLabelText("Name"), name);
}

const create = () => screen.getByRole("button", { name: "Create" });

describe("New folder 06", () => {
  it("shows the title, the field, and the caption note", async () => {
    await render(<NewFolderScreen />);
    expect(screen.getByText("New folder")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "The folder is saved on Telegram with its first file. Its name goes into the caption of each file in it.",
      ),
    ).toBeOnTheScreen();
    expect(create()).toBeDisabled();
  });

  it("adds the trimmed name in the root and closes", async () => {
    await render(<NewFolderScreen />);
    await typeName("  Goa 2024 ");
    await fireEvent.press(create());
    expect(add).toHaveBeenCalledWith("Goa 2024");
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("does not add a name with a slash", async () => {
    await render(<NewFolderScreen />);
    await typeName("a/b");
    await fireEvent.press(create());
    expect(
      screen.getByText('A folder name cannot have "/".'),
    ).toBeOnTheScreen();
    expect(add).not.toHaveBeenCalled();
  });

  it("does not add . or ..", async () => {
    await render(<NewFolderScreen />);
    await typeName("..");
    await fireEvent.press(create());
    expect(screen.getByText("This name is not allowed.")).toBeOnTheScreen();
    expect(add).not.toHaveBeenCalled();
  });

  it("tells when the folder exists, and clears the error on a change", async () => {
    add.mockResolvedValue({ ok: true, value: "exists" });
    await render(<NewFolderScreen />);
    await typeName("Goa");
    await fireEvent.press(create());
    expect(
      await screen.findByText('A folder named "Goa" exists.'),
    ).toBeOnTheScreen();
    expect(mockRouter.back).not.toHaveBeenCalled();
    await typeName("Goa 2");
    expect(
      screen.queryByText('A folder named "Goa" exists.'),
    ).not.toBeOnTheScreen();
  });

  it("shows a database error", async () => {
    add.mockResolvedValue({ ok: false, message: "disk full" });
    await render(<NewFolderScreen />);
    await typeName("Goa");
    await fireEvent.press(create());
    expect(
      await screen.findByText("The folder was not saved (disk full)."),
    ).toBeOnTheScreen();
  });

  it("closes on Cancel", async () => {
    await render(<NewFolderScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(mockRouter.back).toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
  });
});
