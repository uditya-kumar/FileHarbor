import { Stack, useRouter } from "expo-router";

import { Banner } from "@components/fileHarbourComponent/shared/Banner";
import { Button } from "@components/fileHarbourComponent/shared/Button";
import { ListRow } from "@components/fileHarbourComponent/shared/ListRow";
import { RowList } from "@components/fileHarbourComponent/shared/RowList";
import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { SectionHeader } from "@components/fileHarbourComponent/shared/SectionHeader";
import { TitleBlock } from "@components/fileHarbourComponent/shared/TitleBlock";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useFolderList, type FolderListNotice } from "@/hooks/useFolderList";

// 04 folder list and 05 empty state. The folders in the root come from the captions (spec §1).
// A file in the root has no row here. The app always uploads into a folder.

function NoticeBanner({ notice }: { notice: FolderListNotice }) {
  // flood_wait uses warn, never danger: red makes users retry (CLAUDE.md §6).
  return notice.kind === "rate_limited" ? (
    <Banner text={notice.text} icon="timer" tone="warn" />
  ) : (
    <Banner text={notice.text} icon="triangle-alert" tone="danger" />
  );
}

export default function FoldersScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const list = useFolderList();

  const openNewFolder = (): void => router.push("/folders/new");

  return (
    <Screen background="muted">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              variant="header"
              icon="circle-plus"
              accessibilityLabel="New folder"
              onPress={openNewFolder}
            />
          ),
        }}
      />
      {list.status === "list" ? (
        // Expo's native header search (CLAUDE.md §3), not the in-content field of frame 04.
        <Stack.SearchBar
          placeholder="Search folders by name"
          onChangeText={(e) => list.setQuery(e.nativeEvent.text)}
          onClose={() => list.setQuery("")}
          autoCapitalize="none"
          hideWhenScrolling={false}
          textColor={colors.textPrimary}
          hintTextColor={colors.textTertiary}
          headerIconColor={colors.textPrimary}
          tintColor={colors.accent}
        />
      ) : null}

      {list.status === "loading" ? (
        <TitleBlock
          align="center"
          icon="cloud"
          title="Reading Saved Messages"
          body={list.loadingText}
        />
      ) : null}

      {list.status === "error" && list.notice ? (
        <TitleBlock
          align="center"
          icon={
            list.notice.kind === "rate_limited" ? "timer" : "triangle-alert"
          }
          title="The folders did not load"
          body={list.notice.text}
          action={
            <Button
              label="Try again"
              variant="outline"
              size="sm"
              onPress={list.refresh}
            />
          }
        />
      ) : null}

      {list.status === "empty" ? (
        <TitleBlock
          align="center"
          icon="folder-open"
          title="No folders yet"
          body="Create a folder, then upload photos and videos into it."
          action={
            <Button
              label="New folder"
              icon="folder-plus"
              variant="outline"
              size="sm"
              onPress={openNewFolder}
            />
          }
        />
      ) : null}

      {list.status === "list" ? (
        <RowList
          data={list.rows}
          keyExtractor={(row) => row.dirPath}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          header={
            <>
              <SectionHeader title={list.summary} />
              {list.notice ? <NoticeBanner notice={list.notice} /> : null}
              {list.noMatchText ? (
                <Banner text={list.noMatchText} icon="info" />
              ) : null}
            </>
          }
          // The folder screen (07) comes in task 7.6.
          renderItem={({ item }) => (
            <ListRow
              icon={item.kind === "documents" ? "file-text" : "folder"}
              title={item.title}
              subtitle={item.subtitle}
              trailing="chevron"
            />
          )}
        />
      ) : null}
    </Screen>
  );
}
