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
  | "primary"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "header"
  | "viewer"
  | "viewerDestructive"
  /** A sunken circle in a row (12 pause and play). Disabled, its icon is tertiary. */
  | "sunken";
/**
 * "pill": 52 high and fully round (08 action bar). With no label it is a 52 circle.
 * "round": a 36 circle for an icon only (12 transfer row).
 */
type Size = "lg" | "md" | "sm" | "pill" | "round";

type Props = {
  label?: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  /** "top" puts a small label under the icon (09 viewer actions). */
  iconPosition?: "left" | "top";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /**
   * In `headerLeft`: keeps the 08 gap to the title. Android puts the title right after the
   * left slot, with no margin.
   */
  headerLeading?: boolean;
  /** Required when there is no label. */
  accessibilityLabel?: string;
};

type Look = {
  bg?: string;
  border?: string;
  fg: string;
  /** The label colour when it is not fg. */
  labelFg?: string;
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
    case "viewer":
      // On the dark viewer in both schemes: a white icon over a dimmer label.
      return {
        fg: colors.viewerText,
        labelFg: colors.viewerTextSecondary,
        weight: "500",
      };
    case "viewerDestructive":
      return { fg: colors.viewerDanger, weight: "500" };
    case "sunken":
      return {
        bg: colors.bgSunken,
        fg: disabled ? colors.textTertiary : colors.textPrimary,
        weight: "500",
      };
  }
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  fullWidth = false,
  headerLeading = false,
  accessibilityLabel,
}: Props) {
  const { colors } = useColorScheme();
  const look = lookFor(variant, colors, disabled);
  const ghost = variant === "ghost";
  // These variants show disabled with a colour, not with a lower opacity.
  const tintDisabled = ghost || variant === "sunken";
  const top = iconPosition === "top";
  // ghost, header, and the viewer variants have no box, so they ignore size.
  const bare =
    ghost ||
    variant === "header" ||
    variant === "viewer" ||
    variant === "viewerDestructive";
  const inactive = disabled || loading;
  const fontSize = top
    ? 10
    : ghost && size === "sm"
      ? 13
      : size === "sm"
        ? 14
        : ghost
          ? 14
          : 15;
  const iconSize = top
    ? Layout.viewer.actionIcon
    : bare && !ghost
      ? 24
      : ghost
        ? 14
        : size === "sm"
          ? 16
          : size === "round"
            ? Layout.transfer.actionIcon
            : size === "pill"
              ? label
                ? 18
                : 19
              : 17;

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
        !bare && size === "pill" && !label && styles.circle,
        fullWidth && styles.fullWidth,
        headerLeading && styles.headerLeading,
        {
          backgroundColor: look.bg,
          borderColor: look.border,
          borderWidth: look.border ? Layout.hairline : 0,
          opacity: pressed ? 0.7 : disabled && !tintDisabled ? 0.4 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <View
          style={[
            styles.content,
            ghost && styles.contentGhost,
            top && styles.contentTop,
          ]}
        >
          {icon ? <Icon name={icon} size={iconSize} color={look.fg} /> : null}
          {label ? (
            <Text
              style={{
                color: look.labelFg ?? look.fg,
                fontSize,
                fontWeight: look.weight,
              }}
            >
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
  headerLeading: { marginEnd: Layout.header.leadingGap },
  circle: { width: Layout.control.height, paddingHorizontal: 0 },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  contentGhost: { gap: 6 },
  contentTop: { flexDirection: "column", gap: Layout.viewer.actionGap },
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
  pill: {
    height: Layout.control.height,
    paddingHorizontal: 18,
    borderRadius: Layout.radius.pill,
  },
  round: {
    width: Layout.transfer.action,
    height: Layout.transfer.action,
    borderRadius: Layout.transfer.action / 2,
  },
  sm: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: Layout.radius.banner,
  },
});
