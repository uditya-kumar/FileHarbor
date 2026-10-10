import { useState } from "react";

import { Banner } from "@components/fileHarbourComponent/shared/Banner";
import { Button } from "@components/fileHarbourComponent/shared/Button";
import { FormBody } from "@components/fileHarbourComponent/shared/FormBody";
import { InputField } from "@components/fileHarbourComponent/shared/InputField";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { TitleBlock } from "@components/fileHarbourComponent/shared/TitleBlock";
import { useAuthFlow } from "@/hooks/useAuthFlow";

// 03 Auth — Two-Step Password
export default function PasswordScreen() {
  const { step, busy, message, clearMessage, submitPassword } = useAuthFlow("password");
  const [password, setPassword] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);

  const hint = step.step === "password" && step.hint ? `Hint: ${step.hint}` : undefined;
  const submit = (): void => {
    if (password.length > 0 && !busy) void submitPassword(password);
  };

  return (
    <Screen
      footer={
        <>
          <Button
            label="Continue"
            onPress={submit}
            loading={busy}
            disabled={password.length === 0}
            fullWidth
          />
          <Button variant="ghost" label="Forgot password?" onPress={() => setShowRecovery(true)} />
        </>
      }
    >
      <FormBody>
        <TitleBlock
          title="Two-step verification"
          body="This account has a cloud password. Enter it to finish signing in."
        />
        <InputField
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            clearMessage();
          }}
          secure
          hint={hint}
          error={message?.tone === "danger" ? message.text : undefined}
          autoComplete="current-password"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        {message?.tone === "warn" ? <Banner tone="warn" icon="timer" text={message.text} /> : null}
        {showRecovery ? (
          <Banner
            icon="shield-check"
            text="To reset the password, open Telegram on a signed-in device: Settings → Privacy and Security → Two-Step Verification."
          />
        ) : null}
      </FormBody>
    </Screen>
  );
}
