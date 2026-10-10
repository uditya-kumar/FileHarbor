import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";

import { Icon } from "./Icon";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  clearLabel?: string;
};

// The search box at the top of a list (04). Not InputField: it has no label, hint, or error,
// and it has a search icon and a clear button.
export function SearchField({
  value,
  onChangeText,
  placeholder,
  clearLabel = "Clear search",
}: Props) {
  const { colors } = useColorScheme();

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      <Icon name="search" size={19} color={colors.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[styles.input, { color: colors.textPrimary }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
        >
          <Icon name="x" size={17} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: Layout.control.searchHeight,
    paddingHorizontal: 14,
    gap: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: Layout.hairline,
    borderRadius: Layout.radius.banner,
  },
  input: { flex: 1, fontSize: 15, padding: 0 },
});
