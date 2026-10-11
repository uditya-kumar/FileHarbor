import { useRouter } from "expo-router";

import type { IconName } from "@components/fileHarbourComponent/shared/Icon";
import { RowList } from "@components/fileHarbourComponent/shared/RowList";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { SectionHeader } from "@components/fileHarbourComponent/shared/SectionHeader";
import { SegmentedControl } from "@components/fileHarbourComponent/shared/SegmentedControl";
import { TitleBlock } from "@components/fileHarbourComponent/shared/TitleBlock";
import { TransferRow } from "@components/fileHarbourComponent/transfers/TransferRow";
import { useDownloads, type DownloadRow } from "@/hooks/useDownloads";
import type { DownloadStatus, MediaKind } from "@/types/domain";

// 12: the files that the user downloads from 08 (spec §8.6). TDLib downloads them; each row
// shows the progress from updateFile as text.

const TRANSFER_TABS = [
  { key: "downloads", label: "Downloads" },
  { key: "uploads", label: "Uploads" },
] as const;

const KIND_ICON = {
  photo: "image",
  video: "video",
  other: "file-text",
} as const satisfies Record<MediaKind, IconName>;

/** The round button of each row. A queued file waits for a free place: its button is off. */
const ACTION = {
  downloading: { icon: "pause", label: "Pause" },
  paused: { icon: "play", label: "Resume" },
  queued: { icon: "play", label: "Queued" },
  failed: { icon: "rotate-ccw", label: "Try again" },
} as const satisfies Record<DownloadStatus, { icon: IconName; label: string }>;

export default function DownloadsScreen() {
  const router = useRouter();
  const downloads = useDownloads();

  const actionFor = (row: DownloadRow): (() => void) | undefined => {
    switch (row.status) {
      case "downloading":
        return () => downloads.pause(row.fileId);
      case "paused":
      case "failed":
        return () => downloads.resume(row.fileId);
      case "queued":
        return undefined;
    }
  };

  return (
    <Screen background="muted">
      <SegmentedControl
        options={TRANSFER_TABS}
        value="downloads"
        onChange={() => router.replace("/transfers/uploads")}
      />
      {downloads.empty ? (
        <TitleBlock
          align="center"
          icon="download"
          title="No downloads"
          body="Select files in a folder, then tap Download. They show here until they are on this phone."
        />
      ) : (
        <RowList
          data={downloads.rows}
          keyExtractor={(row) => row.key}
          header={
            <SectionHeader
              title={downloads.summary}
              subtitle={downloads.hint}
            />
          }
          renderItem={({ item }) => (
            <TransferRow
              name={item.name}
              detail={item.detail}
              detailTone={item.detailTone}
              icon={KIND_ICON[item.kind]}
              thumbnailUri={item.thumbnailUri}
              placeholderUri={item.placeholderUri}
              recyclingKey={item.key}
              actionIcon={ACTION[item.status].icon}
              actionLabel={`${ACTION[item.status].label} ${item.name}`}
              onAction={actionFor(item)}
            />
          )}
        />
      )}
    </Screen>
  );
}
