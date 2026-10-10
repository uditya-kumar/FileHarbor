import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

import { Icon } from "./Icon";

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Editable lead-in before a divider, e.g. the country code "+91" in 01. */
  prefix?: string;
  onChangePrefix?: (value: string) => void;
  /** Hides the text and shows an eye toggle (03). */
  secure?: boolean;
  hint?: string;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: TextInputProps["autoComplete"];
  autoFocus?: boolean;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
  showLabel?: string;
  hideLabel?: string;
};

export function InputField({
  label,
  value,
  onChangeText,
  prefix,
  onChangePrefix,
  secure = false,
  hint,
  error,
  placeholder,
  keyboardType,
  autoComplete,
  autoFocus,
  returnKeyType,
  onSubmitEditing,
  showLabel = "Show password",
  hideLabel = "Hide password",
}: Props) {
  const { colors } = useColorScheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hidden = secure && !revealed;
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.borderStrong;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textTertiary }]}>{label}</Text>
      <View style={[styles.box, { backgroundColor: colors.bg, borderColor }]}>
        {prefix !== undefined ? (
          <>
            <TextInput
              value={prefix}
              onChangeText={onChangePrefix}
              keyboardType="phone-pad"
              maxLength={5}
              accessibilityLabel={`${label} country code`}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={[styles.input, styles.prefix, { color: colors.textPrimary }]}
            />
            <View style={[styles.divider, { backgroundColor: colors.borderStrong }]} />
          </>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={hidden}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            styles.main,
            hidden && value.length > 0 && styles.dots,
            { color: colors.textPrimary },
          ]}
        />
        {secure ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={revealed ? hideLabel : showLabel}
          >
            <Icon name={revealed ? "eye-off" : "eye"} size={18} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.hint, { color: colors.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: colors.textTertiary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Layout.section.headingGap },
  label: { fontSize: 12, fontWeight: "500" },
  box: {
    height: Layout.control.height,
    paddingHorizontal: 14,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: Layout.hairline,
    borderRadius: Layout.radius.card,
  },
  input: { fontSize: 16, padding: 0 },
  prefix: { fontWeight: "500", minWidth: 28 },
  main: { flex: 1 },
  dots: { fontSize: 17, fontWeight: "600" },
  divider: { width: Layout.hairline, height: 22 },
  hint: { fontSize: 12 },
});
