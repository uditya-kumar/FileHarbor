import { useState } from "react";

import { OtpCodeInput } from "@components/fileHarbourComponent/auth/OtpCodeInput";
import { Banner } from "@components/fileHarbourComponent/shared/Banner";
import { Button } from "@components/fileHarbourComponent/shared/Button";
import { FormBody } from "@components/fileHarbourComponent/shared/FormBody";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { TitleBlock } from "@components/fileHarbourComponent/shared/TitleBlock";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { formatSeconds, useCountdown } from "@/hooks/useCountdown";
import type { CodeDelivery } from "@/types/domain";

const DEFAULT_LENGTH = 5;

const deliveryText: Record<CodeDelivery, string> = {
  telegram: " inside Telegram",
  sms: " by SMS",
  call: " by a phone call",
  other: "",
};

// 02 Auth — Login Code
export default function CodeScreen() {
  const { step, phone, busy, message, clearMessage, submitCode, resendCode } =
    useAuthFlow("code");
  const [code, setCode] = useState("");
  // A new WaitCode state (after a resend) restarts the timer.
  const codeStep = step.step === "code" ? step : null;
  const resendLeft = useCountdown(codeStep?.resendAfter ?? 0, step);

  const length = codeStep?.codeLength || DEFAULT_LENGTH;
  const sizeText = codeStep?.codeLength ? `a ${codeStep.codeLength}-digit code` : "a code";
  const toText = phone ? ` to ${phone}` : "";
  const via = deliveryText[codeStep?.delivery ?? "other"];

  const verify = (value: string = code): void => {
    if (value.length === length && !busy) void submitCode(value);
  };
  const resend = (): void => {
    setCode("");
    void resendCode();
  };

  return (
    <Screen
      footer={
        <Button
          label="Verify"
          onPress={() => verify()}
          loading={busy}
          disabled={code.length < length}
          fullWidth
        />
      }
    >
      <FormBody>
        <TitleBlock title="Enter the code" body={`We sent ${sizeText}${toText}${via}.`} />
        <OtpCodeInput
          value={code}
          onChangeText={(v) => {
            setCode(v);
            clearMessage();
          }}
          length={length}
          onComplete={verify}
          error={message?.tone === "danger"}
          autoFocus
        />
        {message ? (
          <Banner
            tone={message.tone}
            icon={message.tone === "warn" ? "timer" : "shield-check"}
            text={message.text}
          />
        ) : null}
        {codeStep?.canResend ? (
          resendLeft > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              icon="timer"
              label={`Resend code in ${formatSeconds(resendLeft)}`}
              onPress={resend}
              disabled
            />
          ) : (
            <Button variant="ghost" size="sm" icon="timer" label="Resend code" onPress={resend} />
          )
        ) : null}
      </FormBody>
    </Screen>
  );
}
