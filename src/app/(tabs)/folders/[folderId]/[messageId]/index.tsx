import { useLocalSearchParams, useRouter } from "expo-router";

import { Banner } from "@components/fileHarbourComponent/shared/Banner";
import { Button } from "@components/fileHarbourComponent/shared/Button";
import { FormBody } from "@components/fileHarbourComponent/shared/FormBody";
import { ListRow } from "@components/fileHarbourComponent/shared/ListRow";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { SheetGrabber } from "@components/fileHarbourComponent/shared/SheetGrabber";
import { useFileSheet, type FileSheetNotice } from "@/hooks/useFileSheet";

// 11 unsupported-file sheet: a 07 file that is not a photo or a video (spec §8.5). The app
// does not open it; "Download to device" saves it in a folder that the user picks.

/** The Banner look of each notice. flood_wait uses warn, never danger (CLAUDE.md §6). */
const NOTICE_LOOK = {
  note: { tone: "info", icon: "eye-off" },
  progress: { tone: "info", icon: "cloud-download" },
  saved: { tone: "success", icon: "check" },
  rate_limited: { tone: "warn", icon: "timer" },
  failed: { tone: "danger", icon: "triangle-alert" },
} as const satisfies Record<FileSheetNotice["kind"], object>;

export default function FileSheetScreen() {
  const router = useRouter();
  const { folderId, messageId } = useLocalSearchParams<{
    folderId: string;
    messageId: string;
  }>();
  const sheet = useFileSheet(folderId ?? "", Number(messageId));
  const look = NOTICE_LOOK[sheet.notice.kind];

  return (
    <Screen
      fit
      footer={
        <>
          <Button
            label="Download to device"
            icon="arrow-down-to-line"
            fullWidth
            loading={sheet.busy}
            disabled={!sheet.canSave}
            onPress={() => void sheet.save()}
          />
          <Button
            label={sheet.closeLabel}
            variant="secondary"
            size="md"
            fullWidth
            onPress={() => router.back()}
          />
        </>
      }
    >
      <SheetGrabber />
      <FormBody dense>
        {sheet.file ? (
          <ListRow
            variant="plain"
            icon="file-text"
            title={sheet.file.name}
            subtitle={sheet.file.details}
          />
        ) : null}
        <Banner text={sheet.notice.text} icon={look.icon} tone={look.tone} />
      </FormBody>
    </Screen>
  );
}
