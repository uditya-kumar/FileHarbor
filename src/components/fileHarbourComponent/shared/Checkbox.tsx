import { StyleSheet, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

import { Icon } from "./Icon";

type Props = {
  checked: boolean;
  /** "sm": on a photo, with a white ring (08 grid). "lg": in a row (14 transfer list). */
  size?: "sm" | "lg";
};

// A round check mark. It shows state only: the cell or the row around it takes the press and
// carries the accessibility state.
export function Checkbox({ checked, size = "lg" }: Props) {
  const { colors } = useColorScheme();
  const sm = size === "sm";
  const box = sm ? Layout.check.sm : Layout.check.lg;

  return (
    <View
      accessible={false}
      style={[
        styles.base,
        { width: box, height: box, borderRadius: box / 2 },
        checked
          ? {
              backgroundColor: colors.accent,
              borderWidth: sm ? Layout.check.smRing : 0,
              borderColor: colors.onAccent,
            }
          : { borderWidth: Layout.hairline, borderColor: colors.borderStrong },
      ]}
    >
      {checked ? (
        <Icon
          name="check"
          size={sm ? Layout.check.smTick : Layout.check.lgTick}
          color={colors.onAccent}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
});
