import { act, fireEvent, render, screen } from "@testing-library/react-native";

import PhoneScreen from "@/app/(auth)/phone";

import { authModule, mockRouter, resetAuthMocks, setAuthStep } from "./authMocks";

jest.mock("@/telegram/auth", () => require("./authMocks").authModule);
jest.mock("expo-router", () => require("./authMocks").expoRouterModule);

beforeEach(resetAuthMocks);

const continueButton = () => screen.getByRole("button", { name: "Continue" });

describe("01 Auth — Phone Number", () => {
  it("shows the design text", async () => {
    await render(<PhoneScreen />);
    expect(screen.getByText("Sign in with Telegram")).toBeOnTheScreen();
    expect(screen.getByText(/there is no server in between/)).toBeOnTheScreen();
    expect(screen.getByText("Phone number")).toBeOnTheScreen();
    expect(screen.getByLabelText("Phone number country code").props.value).toBe("+91");
    expect(screen.getByText(/never transmitted anywhere/)).toBeOnTheScreen();
    expect(screen.getByText("Telegram will send a login code to this number.")).toBeOnTheScreen();
  });

  it("keeps Continue off while TDLib starts and while the number is short", async () => {
    setAuthStep({ step: "starting" });
    await render(<PhoneScreen />);
    expect(continueButton()).toBeDisabled();
    await act(async () => setAuthStep({ step: "phone" }));
    await fireEvent.changeText(screen.getByLabelText("Phone number"), "987");
    expect(continueButton()).toBeDisabled();
  });

  it("submits the country code with + and the digits only", async () => {
    await render(<PhoneScreen />);
    await fireEvent.changeText(screen.getByLabelText("Phone number country code"), "91");
    await fireEvent.changeText(screen.getByLabelText("Phone number"), "98765 43210");
    await fireEvent.press(continueButton());
    expect(authModule.submitPhone).toHaveBeenCalledWith("+91", "9876543210");
  });

  it("shows an invalid number under the field", async () => {
    authModule.submitPhone.mockResolvedValueOnce({
      ok: false,
      error: { kind: "failed", code: "PHONE_NUMBER_INVALID" },
    });
    await render(<PhoneScreen />);
    await fireEvent.changeText(screen.getByLabelText("Phone number"), "98765 43210");
    await fireEvent.press(continueButton());
    expect(screen.getByText(/This phone number is not valid/)).toBeOnTheScreen();
  });

  it("shows a flood wait as a warning with the wait time", async () => {
    authModule.submitPhone.mockResolvedValueOnce({
      ok: false,
      error: { kind: "rate_limited", code: "FLOOD_WAIT_252", retryAfter: 252 },
    });
    await render(<PhoneScreen />);
    await fireEvent.changeText(screen.getByLabelText("Phone number"), "98765 43210");
    await fireEvent.press(continueButton());
    expect(screen.getByRole("alert")).toHaveTextContent("Too many attempts. Try again in 4:12.");
  });

  it("shows an error state when TDLib is not available", async () => {
    setAuthStep({ step: "unavailable", error: { kind: "unavailable", code: "TdLibModule not linked" } });
    await render(<PhoneScreen />);
    expect(screen.getByText("Telegram is not available in this build.")).toBeOnTheScreen();
    expect(continueButton()).toBeDisabled();
  });

  it("goes to 02 when TDLib asks for the code", async () => {
    await render(<PhoneScreen />);
    await act(async () =>
      setAuthStep({
        step: "code",
        phone: "919876543210",
        codeLength: 5,
        delivery: "telegram",
        resendAfter: 42,
        canResend: true,
      }),
    );
    expect(mockRouter.push).toHaveBeenCalledWith("/code");
  });
});
