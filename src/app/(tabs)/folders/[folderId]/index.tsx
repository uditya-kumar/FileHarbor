import { Stack, useLocalSearchParams } from "expo-router";

import { GalleryGrid } from "@components/fileHarbourComponent/gallery/GalleryGrid";
import { SelectionToolbar } from "@components/fileHarbourComponent/gallery/SelectionToolbar";
import { Banner } from "@components/fileHarbourComponent/shared/Banner";
import { Button } from "@components/fileHarbourComponent/shared/Button";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { SectionHeader } from "@components/fileHarbourComponent/shared/SectionHeader";
import { TitleBlock } from "@components/fileHarbourComponent/shared/TitleBlock";
import { useFolderContents } from "@/hooks/useFolderContents";
import { useSelection } from "@/hooks/useSelection";

// 07 folder grid and 08 multi-select. `folderId` is the folder path from the captions, e.g.
// "Holiday/Beach" (spec §1). The viewer (09, 10) and sheet 11 open from a cell in tasks 7.10
// and 7.11. The More menu comes with the folder operations (Phase 8).

export default function FolderScreen() {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  const selection = useSelection();
  const folder = useFolderContents(
    folderId ?? "",
    selection.active ? selection.selected : null,
  );
  const picked = folder.selection;
  const notice = folder.notice;
  // flood_wait uses warn, never danger: red makes users retry (CLAUDE.md §6).
  const rateLimited = notice?.kind === "rate_limited";

  const pressCell = (key: string): void => {
    if (selection.active) selection.toggle(key);
  };
  const longPressCell = (key: string): void => {
    if (selection.active) selection.toggle(key);
    else selection.start(key);
  };

  return (
    <Screen background="muted">
      <Stack.Screen
        options={
          picked
            ? {
                title: picked.title,
                headerBackVisible: false,
                headerLeft: () => (
                  <Button
                    variant="header"
                    icon="x"
                    accessibilityLabel="Close selection"
                    onPress={selection.exit}
                  />
                ),
                headerRight: () => (
                  <Button
                    variant="header"
                    icon="list-checks"
                    accessibilityLabel={
                      picked.allSelected ? "Select none" : "Select all"
                    }
                    onPress={() => selection.toggleAll(folder.keys)}
                  />
                ),
              }
            : {
                title: folder.title,
                headerBackVisible: true,
                headerLeft: undefined,
                headerRight:
                  folder.status === "grid"
                    ? () => (
                        <Button
                          variant="header"
                          icon="square-check"
                          accessibilityLabel="Select"
                          onPress={() => selection.start()}
                        />
                      )
                    : undefined,
              }
        }
      />

      {folder.status === "loading" ? (
        <TitleBlock align="center" icon="cloud" title="Loading the files" />
      ) : null}

      {folder.status === "error" && notice ? (
        <TitleBlock
          align="center"
          icon={rateLimited ? "timer" : "triangle-alert"}
          title="The files did not load"
          body={notice.text}
          action={
            <Button
              label="Try again"
              variant="outline"
              size="sm"
              onPress={folder.refresh}
            />
          }
        />
      ) : null}

      {folder.status === "empty" ? (
        <TitleBlock
          align="center"
          icon="folder-open"
          title="No files yet"
          body="Photos and videos that you upload to this folder show here."
        />
      ) : null}

      {folder.status === "grid" ? (
        <GalleryGrid
          cells={folder.cells}
          onPressCell={pressCell}
          onLongPressCell={longPressCell}
          onVisibleChange={folder.onVisible}
          refreshing={folder.refreshing}
          onRefresh={picked ? undefined : folder.refresh}
          header={
            <>
              <SectionHeader title={picked ? picked.summary : folder.summary} />
              {notice ? (
                <Banner
                  text={notice.text}
                  icon={rateLimited ? "timer" : "triangle-alert"}
                  tone={rateLimited ? "warn" : "danger"}
                />
              ) : null}
            </>
          }
        />
      ) : null}

      {/* Download connects in task 7.12 (useDownloads). Delete is a Telegram write: it comes
          with the trash in Phase 8, after the write path. */}
      {picked && folder.status === "grid" ? (
        <SelectionToolbar downloadLabel={picked.downloadLabel} />
      ) : null}
    </Screen>
  );
}
