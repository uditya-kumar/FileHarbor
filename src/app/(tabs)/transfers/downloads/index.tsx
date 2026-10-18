import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";

import { Button } from "@components/fileHarbourComponent/shared/Button";
import type { IconName } from "@components/fileHarbourComponent/shared/Icon";
import { RowList } from "@components/fileHarbourComponent/shared/RowList";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { SectionHeader } from "@components/fileHarbourComponent/shared/SectionHeader";
import { SegmentedControl } from "@components/fileHarbourComponent/shared/SegmentedControl";
import { TitleBlock } from "@components/fileHarbourComponent/shared/TitleBlock";
import { TransferRow } from "@components/fileHarbourComponent/transfers/TransferRow";
import { useDownloads, type DownloadRow } from "@/hooks/useDownloads";
import { useSelection } from "@/hooks/useSelection";
import type { DownloadStatus, MediaKind } from "@/types/domain";

// 12: the files that the user downloads from 08 (spec §8.6). TDLib downloads them; each row
// shows the progress from updateFile as text. 14: a long press selects files; the header action
// takes them out of the list.

const TRANSFER_TABS = [
  { key: "downloads", label: "Downloads" },
  { key: "uploads", label: "Uploads" },
] as const;

const KIND_ICON = {
  photo: "image",
  video: "video",
  other: "file-text",
} as const satisfies Record<MediaKind, IconName>;

/**
 * The round button of each row. A queued file waits for a free place, and a saving file is
 * almost done: their buttons are off.
 */
const ACTION = {
  downloading: { icon: "pause", label: "Pause" },
  paused: { icon: "play", label: "Resume" },
  queued: { icon: "play", label: "Queued" },
  saving: { icon: "download", label: "Saving" },
  failed: { icon: "rotate-ccw", label: "Try again" },
} as const satisfies Record<DownloadStatus, { icon: IconName; label: string }>;

export default function DownloadsScreen() {
  const router = useRouter();
  const selection = useSelection();
  const downloads = useDownloads(selection.active ? selection.selected : null);
  const picked = downloads.selection;
  const { empty } = downloads;
  const { active, exit } = selection;

  // The last file completed or left: there is nothing to select.
  useEffect(() => {
    if (empty && active) exit();
  }, [empty, active, exit]);

  const pressRow = (key: string): void => {
    if (active) selection.toggle(key);
  };
  const longPressRow = (key: string): void => {
    if (active) selection.toggle(key);
    else selection.start(key);
  };

  const actionFor = (row: DownloadRow): (() => void) | undefined => {
    switch (row.status) {
      case "downloading":
        return () => downloads.pause(row.fileId);
      case "paused":
      case "failed":
        return () => downloads.resume(row.fileId);
      case "queued":
      case "saving":
        return undefined;
    }
  };

  return (
    <Screen background="muted">
      <Stack.Screen
        options={
          picked
            ? {
                title: picked.title,
                headerLeft: () => (
                  <Button
                    variant="header"
                    icon="x"
                    headerLeading
                    accessibilityLabel="Close selection"
                    onPress={exit}
                  />
                ),
                headerRight: () => (
                  <Button
                    variant="header"
                    icon="trash-2"
                    accessibilityLabel="Remove from Downloads"
                    disabled={picked.fileIds.length === 0}
                    onPress={() => {
                      downloads.remove(picked.fileIds);
                      exit();
                    }}
                  />
                ),
              }
            : {
                title: "Transfers",
                headerLeft: undefined,
                headerRight: undefined,
              }
        }
      />
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
              title={picked ? picked.summary : downloads.summary}
              subtitle={picked ? picked.hint : downloads.hint}
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
              selected={item.selected}
              onPress={active ? () => pressRow(item.key) : undefined}
              onLongPress={() => longPressRow(item.key)}
            />
          )}
        />
      )}
    </Screen>
  );
}
