import { Stack, useRouter } from "expo-router";

import { Button } from "@components/fileHarbourComponent/shared/Button";
import { FormBody } from "@components/fileHarbourComponent/shared/FormBody";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { TitleBlock } from "@components/fileHarbourComponent/shared/TitleBlock";

export default function NotFoundScreen() {
  const router = useRouter();
  // "/" is the gate: it sends the user to the tabs or to the auth group from the auth state.
  const goBack = (): void => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <Screen footer={<Button label="Go back" onPress={goBack} fullWidth />}>
      <Stack.Screen options={{ title: "" }} />
      <FormBody>
        <TitleBlock title="Page not found" body="This screen does not exist." />
      </FormBody>
    </Screen>
  );
}
