import { act, fireEvent, render, screen } from "@testing-library/react-native";

import CodeScreen from "@/app/(auth)/code";
import { formatPhone } from "@/hooks/useAuthFlow";
import type { AuthStep } from "@/types/domain";

import { authModule, mockRouter, resetAuthMocks, setAuthStep } from "./authMocks";

jest.mock("@/telegram/auth", () => require("./authMocks").authModule);
jest.mock("expo-router", () => require("./authMocks").expoRouterModule);

const codeStep: AuthStep = {
  step: "code",
  phone: "919876543210",
  codeLength: 5,
  delivery: "telegram",
  resendAfter: 42,
  canResend: true,
};

beforeEach(() => {
  resetAuthMocks();
  setAuthStep(codeStep);
});

describe("formatPhone", () => {
  it("splits the number like the design", () => {
    expect(formatPhone("919876543210", "+91")).toBe("+91 98765 43210");
    expect(formatPhone("919876543210")).toBe("+919876543210");
    expect(formatPhone("4915112345678", "+91")).toBe("+4915112345678");
  });
});

describe("02 Auth — Login Code", () => {
  it("shows the design text", async () => {
    await render(<CodeScreen />);
    expect(screen.getByText("Enter the code")).toBeOnTheScreen();
    expect(
      screen.getByText("We sent a 5-digit code to +919876543210 inside Telegram."),
    ).toBeOnTheScreen();
    expect(screen.getByText("Resend code in 0:42")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });

  it("counts the resend timer down, then allows a resend", async () => {
    jest.useFakeTimers();
    await render(<CodeScreen />);
    for (let i = 0; i < 42; i++) await act(async () => jest.advanceTimersByTime(1000));
    await fireEvent.press(screen.getByRole("button", { name: "Resend code" }));
    expect(authModule.resendCode).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("submits when the last digit is typed", async () => {
    await render(<CodeScreen />);
    await fireEvent.changeText(screen.getByLabelText("Login code"), "37512");
    expect(authModule.submitCode).toHaveBeenCalledWith("37512");
  });

  it("shows a wrong code as an error", async () => {
    authModule.submitCode.mockResolvedValueOnce({
      ok: false,
      error: { kind: "failed", code: "PHONE_CODE_INVALID" },
    });
    await render(<CodeScreen />);
    await fireEvent.changeText(screen.getByLabelText("Login code"), "11111");
    expect(screen.getByRole("alert")).toHaveTextContent("The code is not correct. Try again.");
  });

  it("shows a flood wait as a warning", async () => {
    authModule.submitCode.mockResolvedValueOnce({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_60", retryAfter: 60 },
    });
    await render(<CodeScreen />);
    await fireEvent.changeText(screen.getByLabelText("Login code"), "11111");
    expect(screen.getByRole("alert")).toHaveTextContent("Too many attempts. Try again in 1:00.");
  });

  it("replaces itself with 03 when TDLib asks for the password", async () => {
    await render(<CodeScreen />);
    await act(async () => setAuthStep({ step: "password", hint: "" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/password");
  });

  it("goes back to 01 when TDLib asks for the number again", async () => {
    await render(<CodeScreen />);
    await act(async () => setAuthStep({ step: "phone" }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/phone");
  });
});
