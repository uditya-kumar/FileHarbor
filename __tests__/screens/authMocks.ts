import { useEffect } from "react";

import type { AuthStep, ServiceResult } from "@/types/domain";

// Stand-ins for @/telegram/auth and expo-router. Use them from jest.mock factories:
//   jest.mock("@/telegram/auth", () => require("./authMocks").authModule);

type Listener = (step: AuthStep) => void;
const listeners = new Set<Listener>();
let current: AuthStep = { step: "phone" };
const ok: ServiceResult<void> = { ok: true, value: undefined };

export const authModule = {
  startAuth: jest.fn(async () => {}),
  getAuthStep: () => current,
  subscribeAuth: (l: Listener) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  submitPhone: jest.fn(async (): Promise<ServiceResult<void>> => ok),
  submitCode: jest.fn(async (): Promise<ServiceResult<void>> => ok),
  submitPassword: jest.fn(async (): Promise<ServiceResult<void>> => ok),
  resendCode: jest.fn(async (): Promise<ServiceResult<void>> => ok),
};

/** Sets the auth step before render, or pushes a new one after it. */
export function setAuthStep(step: AuthStep): void {
  current = step;
  listeners.forEach((l) => l(step));
}

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: jest.fn(() => false),
};

/** Records the href of each rendered <Redirect />. */
export const mockRedirect = jest.fn((_href: string): null => null);

export const expoRouterModule = {
  useRouter: () => mockRouter,
  // The screen under test is always focused.
  useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  Redirect: ({ href }: { href: string }) => mockRedirect(href),
};

export function resetAuthMocks(): void {
  listeners.clear();
  current = { step: "phone" };
  jest.clearAllMocks();
}
