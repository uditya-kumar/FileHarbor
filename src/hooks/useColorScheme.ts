import { useColorScheme as useRNColorScheme } from "react-native";

import { Colors, type ColorScheme, type ColorTokens } from "@/constants/Colors";

// RN can return "unspecified" or null; the design defines only light and dark.
export function useColorScheme(): { scheme: ColorScheme; colors: ColorTokens } {
  const scheme: ColorScheme = useRNColorScheme() === "dark" ? "dark" : "light";
  return { scheme, colors: Colors[scheme] };
}
