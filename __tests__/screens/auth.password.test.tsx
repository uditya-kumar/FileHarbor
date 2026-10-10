import { fireEvent, render, screen } from "@testing-library/react-native";

import PasswordScreen from "@/app/(auth)/password";

import { authModule, resetAuthMocks, setAuthStep } from "./authMocks";

jest.mock("@/telegram/auth", () => require("./authMocks").authModule);
jest.mock("expo-router", () => require("./authMocks").expoRouterModule);

beforeEach(() => {
  resetAuthMocks();
  setAuthStep({ step: "password", hint: "first pet" });
});

describe("03 Auth — Two-Step Password", () => {
  it("shows the design text and the hint", async () => {
    await render(<PasswordScreen />);
    expect(screen.getByText("Two-step verification")).toBeOnTheScreen();
    expect(screen.getByText(/This account has a cloud password/)).toBeOnTheScreen();
    expect(screen.getByText("Password")).toBeOnTheScreen();
    expect(screen.getByText("Hint: first pet")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("hides the hint line when the account has no hint", async () => {
    setAuthStep({ step: "password", hint: "" });
    await render(<PasswordScreen />);
    expect(screen.queryByText(/^Hint:/)).toBeNull();
  });

  it("submits the password", async () => {
    await render(<PasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), "hunter2");
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(authModule.submitPassword).toHaveBeenCalledWith("hunter2");
  });

  it("shows a wrong password under the field", async () => {
    authModule.submitPassword.mockResolvedValueOnce({
      ok: false,
      error: { kind: "failed", code: "PASSWORD_HASH_INVALID" },
    });
    await render(<PasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), "nope");
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("The password is not correct.")).toBeOnTheScreen();
  });

  it("shows a flood wait as a warning", async () => {
    authModule.submitPassword.mockResolvedValueOnce({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_5", retryAfter: 5 },
    });
    await render(<PasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), "x");
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Too many attempts. Try again in 0:05.");
  });

  it("explains recovery on Forgot password", async () => {
    await render(<PasswordScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByText(/To reset the password/)).toBeOnTheScreen();
  });
});
