import { DeviceEventEmitter, NativeModules } from "react-native";

/** A fake TdLibModule. Each method is a jest.fn; `emit` sends a tdlib-update event. */
export function installFakeTdLib() {
  const td = {
    startTdLib: jest.fn().mockResolvedValue("ok"),
    getAuthorizationState: jest
      .fn()
      .mockResolvedValue(JSON.stringify({ "@type": "authorizationStateWaitTdlibParameters" })),
    login: jest.fn().mockResolvedValue("Phone number set successfully"),
    verifyPhoneNumber: jest.fn().mockResolvedValue("Verification successful"),
    verifyPassword: jest.fn().mockResolvedValue("Password verification successful"),
    logout: jest.fn().mockResolvedValue("Logout successful"),
    td_json_client_send: jest.fn().mockResolvedValue("Request sent successfully"),
    td_json_client_execute: jest.fn().mockResolvedValue(JSON.stringify({ "@type": "ok" })),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
  NativeModules.TdLibModule = td;
  const emit = (update: { "@type": string } & Record<string, unknown>): void => {
    DeviceEventEmitter.emit("tdlib-update", {
      type: update["@type"],
      raw: JSON.stringify(update),
    });
  };
  return { td, emit };
}

export function removeFakeTdLib(): void {
  delete NativeModules.TdLibModule;
}
