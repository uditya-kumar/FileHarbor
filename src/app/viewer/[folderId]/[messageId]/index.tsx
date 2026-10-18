import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { Screen } from "@components/fileHarbourComponent/shared/Screen";
import { PhotoViewer } from "@components/fileHarbourComponent/viewer/PhotoViewer";
import { VideoScrubber } from "@components/fileHarbourComponent/viewer/VideoScrubber";
import { VideoViewer } from "@components/fileHarbourComponent/viewer/VideoViewer";
import {
  ViewerActionRow,
  type ViewerAction,
} from "@components/fileHarbourComponent/viewer/ViewerActionRow";
import { ViewerFileMeta } from "@components/fileHarbourComponent/viewer/ViewerFileMeta";
import { ViewerFilmstrip } from "@components/fileHarbourComponent/viewer/ViewerFilmstrip";
import { useMediaPermissions } from "@/hooks/useMediaPermissions";
import { useVideoPlayback } from "@/hooks/useVideoPlayback";
import { useViewer } from "@/hooks/useViewer";

// 09 photo and 10 video viewer, outside the tabs. `folderId` is the folder path and
// `messageId` the file that the user opened in 07. A tap shows or hides the bars.

// The actions show disabled until they work. Share and Copy need a library that spec §2 does
// not list; Delete is a Telegram write (Phase 8). Save works (7.16): it gets its onPress below.
const ACTIONS: readonly ViewerAction[] = [
  { key: "share", icon: "share-2", label: "Share" },
  { key: "save", icon: "arrow-down-to-line", label: "Save" },
  { key: "copy", icon: "copy", label: "Copy" },
  { key: "delete", icon: "trash-2", label: "Delete", destructive: true },
];

export default function ViewerScreen() {
  const router = useRouter();
  const { folderId, messageId } = useLocalSearchParams<{
    folderId: string;
    messageId: string;
  }>();
  const viewer = useViewer(folderId ?? "", Number(messageId));
  const media = useMediaPermissions("Save");
  const open = viewer.open;
  const save = viewer.save;
  // Android asks for gallery access on the tap, not when the viewer opens.
  const actions = ACTIONS.map((a) =>
    a.key === "save" && save
      ? {
          ...a,
          onPress: () =>
            void media.ensureSave().then((ok) => {
              if (ok) save();
            }),
        }
      : a,
  );
  const video = useVideoPlayback(
    open?.kind === "video" ? open.key : null,
    open?.videoUri ?? null,
  );
  const chrome = viewer.chromeVisible || viewer.status !== "ready";

  const failure =
    viewer.status === "error"
      ? { name: "The file did not load", meta: viewer.errorText ?? "" }
      : viewer.status === "missing"
        ? {
            name: "This file is not here now",
            meta: "It was moved or deleted. Go back and refresh the folder.",
          }
        : null;

  return (
    <Screen background="viewer">
      <StatusBar style="light" hidden={!chrome} />
      <Stack.Screen options={{ title: viewer.title, headerShown: chrome }} />

      {viewer.status === "ready" ? (
        <PhotoViewer
          pages={viewer.pages}
          index={viewer.index}
          onIndexChange={viewer.setIndex}
          onTap={viewer.toggleChrome}
          onSwipeToClose={router.back}
          video={
            open?.kind === "video" ? (
              <VideoViewer
                player={video.player}
                posterUri={open.posterUri}
                recyclingKey={open.key}
                playing={video.playing}
                onTogglePlay={video.toggle}
                onPressPage={viewer.toggleChrome}
                controlsVisible={chrome}
              />
            ) : null
          }
        />
      ) : null}

      {failure ? (
        <ViewerActionRow actions={ACTIONS}>
          <ViewerFileMeta name={failure.name} meta={failure.meta} />
        </ViewerActionRow>
      ) : null}

      {chrome && open && viewer.status === "ready" ? (
        <ViewerActionRow actions={actions}>
          {open.kind === "video" ? (
            <VideoScrubber
              bufferText={media.notice ?? open.downloadText}
              played={video.played}
              elapsed={video.elapsed}
              total={video.total}
              onSeek={video.seek}
            />
          ) : (
            <>
              <ViewerFileMeta
                name={open.name}
                meta={media.notice ?? open.meta}
              />
              <ViewerFilmstrip
                items={viewer.strip}
                activeKey={open.key}
                onPressItem={viewer.select}
              />
            </>
          )}
        </ViewerActionRow>
      ) : null}
    </Screen>
  );
}
