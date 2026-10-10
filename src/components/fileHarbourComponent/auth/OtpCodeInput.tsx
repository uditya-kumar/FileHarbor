import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  /** Number of boxes. */
  length: number;
  /** Called once when the last digit is typed. */
  onComplete?: (code: string) => void;
  error?: boolean;
  autoFocus?: boolean;
  accessibilityLabel?: string;
};

// One hidden TextInput takes the input (paste and SMS autofill work); the boxes only show it.
export function OtpCodeInput({
  value,
  onChangeText,
  length,
  onComplete,
  error = false,
  autoFocus = false,
  accessibilityLabel = "Login code",
}: Props) {
  const { colors } = useColorScheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);

  const change = (text: string): void => {
    const digits = text.replace(/\D/g, "").slice(0, length);
    onChangeText(digits);
    if (digits.length === length && value.length < length) onComplete?.(digits);
  };

  return (
    <Pressable onPress={() => input.current?.focus()} style={styles.row}>
      {Array.from({ length }, (_, i) => {
        const active = focused && i === Math.min(value.length, length - 1) && value.length < length;
        const borderColor = error ? colors.danger : active ? colors.accent : colors.border;
        return (
          <View
            key={i}
            style={[
              styles.box,
              { backgroundColor: active ? colors.bg : colors.bgMuted, borderColor },
            ]}
          >
            {value[i] ? (
              <Text style={[styles.digit, { color: colors.textPrimary }]}>{value[i]}</Text>
            ) : active ? (
              <View style={[styles.caret, { backgroundColor: colors.accent }]} />
            ) : null}
          </View>
        );
      })}
      <TextInput
        ref={input}
        value={value}
        onChangeText={change}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus={autoFocus}
        caretHidden
        accessibilityLabel={accessibilityLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  box: {
    width: 58,
    height: 62,
    flexShrink: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: Layout.hairline,
    borderRadius: Layout.radius.card,
  },
  digit: { fontSize: 22, fontWeight: "600" },
  caret: { width: 2, height: 24, borderRadius: 1 },
  hidden: { ...StyleSheet.absoluteFill, opacity: 0 },
});
