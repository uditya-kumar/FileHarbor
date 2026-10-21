import { StyleSheet, View } from "react-native";

import { Layout } from "@/constants/Layout";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Button } from "@components/fileHarbourComponent/shared/Button";

type Props = {
  onPress: () => void;
  /** While a file uploads: one upload at a time (spec §11 step 5). */
  disabled?: boolean;
};

// The 07 upload button: a pill under the grid, at the end of the row, with an accent shadow.
// Not shared/: it is the pill Button plus the 07 bar layout and shadow, which only 07 has.
export function UploadButton({ onPress, disabled = false }: Props) {
  const { colors } = useColorScheme();

  return (
    <View style={styles.bar}>
      <View
        style={[
          styles.shadow,
          {
            boxShadow: [
              {
                offsetX: 0,
                offsetY: Layout.uploadBar.shadowY,
                blurRadius: Layout.uploadBar.shadowBlur,
                color: colors.accentShadow,
              },
            ],
          },
        ]}
      >
        <Button
          size="pill"
          icon="plus"
          accessibilityLabel="Upload a photo or video"
          onPress={onPress}
          disabled={disabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "flex-end",
    paddingTop: Layout.uploadBar.padTop,
    paddingBottom: Layout.uploadBar.padBottom,
    paddingHorizontal: Layout.pad,
  },
  shadow: { borderRadius: Layout.radius.pill },
});
