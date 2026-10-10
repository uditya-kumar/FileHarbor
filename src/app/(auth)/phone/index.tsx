import { useState } from "react";

import { Banner } from "@components/fileHarbourComponent/shared/Banner";
import { Button } from "@components/fileHarbourComponent/shared/Button";
import { FormBody } from "@components/fileHarbourComponent/shared/FormBody";
import { InputField } from "@components/fileHarbourComponent/shared/InputField";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { TitleBlock } from "@components/fileHarbourComponent/shared/TitleBlock";
import { authMessage, useAuthFlow } from "@/hooks/useAuthFlow";

// 01 Auth — Phone Number
export default function PhoneScreen() {
  const { step, busy, message, clearMessage, submitPhone } = useAuthFlow("phone");
  const [countryCode, setCountryCode] = useState("+91");
  const [number, setNumber] = useState("");

  const starting = step.step === "starting";
  const blocked = step.step === "unavailable" ? authMessage(step.error) : null;
  const canSubmit =
    step.step === "phone" &&
    countryCode.replace(/\D/g, "").length > 0 &&
    number.replace(/\D/g, "").length >= 5;

  const submit = (): void => {
    if (canSubmit && !busy) void submitPhone(countryCode, number);
  };
  const edit =
    (set: (v: string) => void) =>
    (v: string): void => {
      set(v);
      clearMessage();
    };

  return (
    <Screen
      headerShown={false}
      footer={
        <Button
          label="Continue"
          onPress={submit}
          loading={busy || starting}
          disabled={!canSubmit}
          fullWidth
        />
      }
      footerNote="Telegram will send a login code to this number."
    >
      <FormBody belowHeader={false}>
        <TitleBlock
          icon="cloud"
          title="Sign in with Telegram"
          body="Files are stored in your own Saved Messages. The app talks to Telegram directly — there is no server in between."
        />
        <InputField
          label="Phone number"
          prefix={countryCode}
          onChangePrefix={edit(setCountryCode)}
          value={number}
          onChangeText={edit(setNumber)}
          placeholder="98765 43210"
          keyboardType="phone-pad"
          autoComplete="tel"
          returnKeyType="done"
          onSubmitEditing={submit}
          error={message?.tone === "danger" ? message.text : undefined}
        />
        {blocked ? <Banner tone="danger" icon="shield-check" text={blocked.text} /> : null}
        {step.step === "unsupported" ? (
          <Banner
            tone="warn"
            icon="shield-check"
            text="This number needs a sign-in step that FileHarbor does not support. Finish it in the Telegram app, then try again."
          />
        ) : null}
        {message?.tone === "warn" ? <Banner tone="warn" icon="timer" text={message.text} /> : null}
        <Banner
          icon="shield-check"
          text="The session is stored only on this device and is never transmitted anywhere."
        />
      </FormBody>
    </Screen>
  );
}
