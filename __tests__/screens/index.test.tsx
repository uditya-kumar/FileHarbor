import { render } from "@testing-library/react-native";

import IndexScreen from "@/app/index";

import { mockRedirect, resetAuthMocks, setAuthStep } from "./authMocks";

jest.mock("@/telegram/auth", () => require("./authMocks").authModule);
jest.mock("expo-router", () => require("./authMocks").expoRouterModule);

beforeEach(resetAuthMocks);

describe("Root gate", () => {
  it("waits while TDLib starts", async () => {
    setAuthStep({ step: "starting" });
    await render(<IndexScreen />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("sends a signed-in user to the folders tab", async () => {
    setAuthStep({ step: "ready" });
    await render(<IndexScreen />);
    expect(mockRedirect).toHaveBeenCalledWith("/folders");
  });

  it("sends a user without a session to screen 01", async () => {
    setAuthStep({ step: "phone" });
    await render(<IndexScreen />);
    expect(mockRedirect).toHaveBeenCalledWith("/phone");
  });

  it("sends a user to screen 01 when TDLib is not available", async () => {
    setAuthStep({ step: "unavailable", error: { kind: "unavailable", code: "NOT_LINKED" } });
    await render(<IndexScreen />);
    expect(mockRedirect).toHaveBeenCalledWith("/phone");
  });

  it("sends a user to screen 01 while the session logs out", async () => {
    setAuthStep({ step: "loggingOut" });
    await render(<IndexScreen />);
    expect(mockRedirect).toHaveBeenCalledWith("/phone");
  });
});
