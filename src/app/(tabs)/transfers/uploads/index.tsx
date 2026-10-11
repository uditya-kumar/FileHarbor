import { useRouter } from "expo-router";

import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { SegmentedControl } from "@components/fileHarbourComponent/shared/SegmentedControl";
import { TitleBlock } from "@components/fileHarbourComponent/shared/TitleBlock";

// Placeholder. Phase 9 builds frame 13 on useUploadQueue. The switch goes back to 12.

const TRANSFER_TABS = [
  { key: "downloads", label: "Downloads" },
  { key: "uploads", label: "Uploads" },
] as const;

export default function UploadsScreen() {
  const router = useRouter();

  return (
    <Screen background="muted">
      <SegmentedControl
        options={TRANSFER_TABS}
        value="uploads"
        onChange={() => router.replace("/transfers/downloads")}
      />
      <TitleBlock
        align="center"
        icon="cloud"
        title="Uploads come later"
        body="The app cannot upload files yet."
      />
    </Screen>
  );
}
