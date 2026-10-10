import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import * as auth from "@/telegram/auth";
import type { AuthStep, ServiceError, ServiceResult } from "@/types/domain";

import { formatSeconds } from "./useCountdown";

type AuthScreen = "phone" | "code" | "password";

// The country code from 01, so 02 can split "+91 98765 43210". TDLib gives digits only.
let lastCountryCode: string | undefined;

type TelegramExtra = { apiId?: number; apiHash?: string };

function credentials(): { apiId: number; apiHash: string } {
  const extra = Constants.expoConfig?.extra?.telegram as TelegramExtra | undefined;
  return { apiId: extra?.apiId ?? 0, apiHash: extra?.apiHash ?? "" };
}

/** The current auth step. The first caller starts TDLib; later calls only read. */
export function useAuthStep(): AuthStep {
  useEffect(() => {
    void auth.startAuth({ ...credentials(), appVersion: Constants.expoConfig?.version });
  }, []);
  return useSyncExternalStore(auth.subscribeAuth, auth.getAuthStep);
}

function screenFor(step: AuthStep): AuthScreen | null {
  return step.step === "phone" || step.step === "code" || step.step === "password"
    ? step.step
    : null;
}

export type AuthMessage = { text: string; tone: "danger" | "warn" };

/** The text for an auth error. Flood waits use warn, never danger (CLAUDE.md §6). */
export function authMessage(error: ServiceError): AuthMessage {
  if (error.kind === "rate_limited") {
    const wait = error.retryAfter ? ` Try again in ${formatSeconds(error.retryAfter)}.` : "";
    return { text: `Too many attempts.${wait}`, tone: "warn" };
  }
  if (error.kind === "unavailable") {
    return { text: "Telegram is not available in this build.", tone: "danger" };
  }
  switch (error.code) {
    case "PHONE_NUMBER_INVALID":
      return { text: "This phone number is not valid. Check the country code.", tone: "danger" };
    case "PHONE_NUMBER_BANNED":
      return { text: "Telegram has banned this phone number.", tone: "danger" };
    case "PHONE_CODE_INVALID":
      return { text: "The code is not correct. Try again.", tone: "danger" };
    case "PHONE_CODE_EXPIRED":
      return { text: "The code has expired. Request a new code.", tone: "danger" };
    case "PASSWORD_HASH_INVALID":
      return { text: "The password is not correct.", tone: "danger" };
    default:
      return { text: `Telegram did not accept this (${error.code}). Try again.`, tone: "danger" };
  }
}

/** "919876543210" with "+91" → "+91 98765 43210". */
export function formatPhone(digits: string, countryCode?: string): string {
  const cc = countryCode?.replace(/\D/g, "");
  if (!cc || !digits.startsWith(cc)) return digits ? `+${digits}` : "";
  const national = digits.slice(cc.length);
  const grouped = national.length === 10 ? `${national.slice(0, 5)} ${national.slice(5)}` : national;
  return `+${cc} ${grouped}`;
}

/**
 * Handlers and error state for one auth screen. TDLib drives the flow: when a new state
 * arrives while this screen is focused, the hook goes to the screen for that state. Only a
 * new state object counts, so going back from 02 to change the number does not bounce.
 */
export function useAuthFlow(screen: AuthScreen) {
  const router = useRouter();
  const step = useAuthStep();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const handled = useRef<AuthStep | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (handled.current === step) return;
      handled.current = step;
      const target = screenFor(step);
      if (!target || target === screen) return;
      if (target === "phone") router.dismissTo("/phone");
      else if (screen === "phone") router.push(`/${target}`);
      else router.replace(`/${target}`);
    }, [step, screen, router]),
  );

  const run = useCallback(async (action: () => Promise<ServiceResult<void>>) => {
    setBusy(true);
    setMessage(null);
    const res = await action();
    setBusy(false);
    if (!res.ok) setMessage(authMessage(res.error));
  }, []);

  return {
    step,
    /** The number on screen 02, e.g. "+91 98765 43210". */
    phone: step.step === "code" ? formatPhone(step.phone, lastCountryCode) : "",
    busy,
    message,
    clearMessage: useCallback(() => setMessage(null), []),
    submitPhone: useCallback(
      (countryCode: string, number: string) => {
        const cc = `+${countryCode.replace(/\D/g, "")}`;
        lastCountryCode = cc;
        return run(() => auth.submitPhone(cc, number.replace(/\D/g, "")));
      },
      [run],
    ),
    submitCode: useCallback((code: string) => run(() => auth.submitCode(code)), [run]),
    submitPassword: useCallback(
      (password: string) => run(() => auth.submitPassword(password)),
      [run],
    ),
    resendCode: useCallback(() => run(auth.resendCode), [run]),
  };
}
