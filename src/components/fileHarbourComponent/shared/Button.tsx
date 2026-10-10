import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { ColorTokens } from "@/constants/Colors";
import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

import { Icon, type IconName } from "./Icon";

type Variant =
  "primary" | "secondary" | "destructive" | "outline" | "ghost" | "header";
type Size = "lg" | "md" | "sm";

type Props = {
  label?: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Required when there is no label. */
  accessibilityLabel?: string;
};

type Look = {
  bg?: string;
  border?: string;
  fg: string;
  weight: "400" | "500" | "600";
};

function lookFor(
  variant: Variant,
  colors: ColorTokens,
  disabled: boolean,
): Look {
  switch (variant) {
    case "primary":
      return { bg: colors.accent, fg: colors.onAccent, weight: "600" };
    case "secondary":
      return {
        bg: colors.bgMuted,
        border: colors.border,
        fg: colors.textPrimary,
        weight: "500",
      };
    case "destructive":
      return {
        bg: colors.bg,
        border: colors.border,
        fg: colors.danger,
        weight: "600",
      };
    case "outline":
      return {
        bg: colors.bg,
        border: colors.borderStrong,
        fg: colors.textPrimary,
        weight: "600",
      };
    case "ghost":
      // A disabled ghost is a countdown note (02 "Resend code in 0:42"), not a faded link.
      return disabled
        ? { fg: colors.textTertiary, weight: "400" }
        : { fg: colors.accent, weight: "500" };
    case "header":
      // An action in the native header (04 new folder): the header tint, no box.
      return { fg: colors.textPrimary, weight: "500" };
  }
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
}: Props) {
  const { colors } = useColorScheme();
  const look = lookFor(variant, colors, disabled);
  const ghost = variant === "ghost";
  // ghost and header have no box, so they ignore size.
  const bare = ghost || variant === "header";
  const inactive = disabled || loading;
  const fontSize =
    ghost && size === "sm" ? 13 : size === "sm" ? 14 : ghost ? 14 : 15;
  const iconSize =
    variant === "header" ? 24 : ghost ? 14 : size === "sm" ? 16 : 17;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={bare ? 8 : undefined}
      style={({ pressed }) => [
        styles.base,
        !bare && sizeStyles[size],
        fullWidth && styles.fullWidth,
        {
          backgroundColor: look.bg,
          borderColor: look.border,
          borderWidth: look.border ? Layout.hairline : 0,
          opacity: pressed ? 0.7 : disabled && !ghost ? 0.4 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <View style={[styles.content, ghost && styles.contentGhost]}>
          {icon ? <Icon name={icon} size={iconSize} color={look.fg} /> : null}
          {label ? (
            <Text style={{ color: look.fg, fontSize, fontWeight: look.weight }}>
              {label}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  fullWidth: { alignSelf: "stretch" },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  contentGhost: { gap: 6 },
});

const sizeStyles = StyleSheet.create({
  lg: {
    height: Layout.control.buttonHeight,
    paddingHorizontal: 18,
    borderRadius: Layout.radius.card,
  },
  md: {
    height: Layout.control.buttonHeightCompact,
    paddingHorizontal: 18,
    borderRadius: Layout.radius.card,
  },
  sm: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: Layout.radius.banner,
  },
});
