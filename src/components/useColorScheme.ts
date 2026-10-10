import { useColorScheme as useRNColorScheme } from 'react-native';

// React Native's `useColorScheme` can return `'unspecified'` in addition to
// `'light' | 'dark' | null`. Narrow it so callers only ever deal with the two
// schemes our theme defines.
export function useColorScheme(): 'light' | 'dark' | null {
  const scheme = useRNColorScheme();
  return scheme === 'light' || scheme === 'dark' ? scheme : null;
}
