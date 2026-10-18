import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useColorScheme } from "@/hooks/useColorScheme";
import { useDownloadBadge } from "@/hooks/useDownloads";

export const unstable_settings = {
  anchor: "folders",
};

export default function TabsLayout() {
  const { colors } = useColorScheme();
  const downloading = useDownloadBadge();

  return (
    <NativeTabs
      backgroundColor={colors.bg}
      tintColor={colors.accent}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      indicatorColor={colors.accentSoft}
      rippleColor={colors.accentSoft}
      badgeBackgroundColor={colors.accent}
      badgeTextColor={colors.onAccent}
    >
      <NativeTabs.Trigger name="folders">
        <NativeTabs.Trigger.Label>Folders</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="folder" md="folder" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transfers">
        <NativeTabs.Trigger.Label>Downloads</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="arrow.down.circle" md="download" />
        {/* expo-router ignores `hidden` when the badge has a value: "0" showed. No value at 0. */}
        <NativeTabs.Trigger.Badge hidden={downloading === 0}>
          {downloading > 0 ? String(downloading) : undefined}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
