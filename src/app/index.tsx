import { Redirect } from "expo-router";

import { Screen } from "@components/fileHarbourComponent/shared/Screen";

import { useAuthStep } from "@/hooks/useAuthFlow";

/**
 * The root gate. It sends the user to the tabs or to the auth group from the TDLib auth state.
 * The root layout also guards both groups, so a state change moves the user even from a deep
 * screen: a denied guard returns to this route, and this route redirects again.
 */
export default function IndexScreen() {
  const step = useAuthStep();

  if (step.step === "starting") {
    // The splash covers this route until the first auth state arrives. The empty screen keeps
    // the background colour if the splash times out first.
    return <Screen headerShown={false}>{null}</Screen>;
  }

  return <Redirect href={step.step === "ready" ? "/folders" : "/phone"} />;
}
