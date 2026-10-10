# FileHarbor — Task List

This list divides the work into small tasks. Each task uses the result of the tasks before it.
Do the tasks in sequence. Mark a task `[x]` when it is complete and its checks pass.

References:
- **Spec** = `TELEGRAM_STORAGE_TECHNICAL_SPEC.md`
- **Rules** = `CLAUDE.md`
- **Frame NN** = the screen frame NN in `Design.pen` (open it only with the `pencil` MCP)

Legend:
- 📱 = needs a real Android device
- 👤 = needs an action or an approval from the user

---

## Screen checks (do these for each screen — Rules §7)

When a task says "Do the screen checks", do all of these steps:

1. Run `npx tsc --noEmit`. It must pass.
2. Run `npm run lint`. It must pass. Do not add `any`.
3. Write `__tests__/screens/<route>.test.tsx`. Mock the services.
   Assert the key text and these states: loaded, empty, selection, error, rate-limited.
   Test only the states that the screen has.
4. Compare the screen to its frame, in light and in dark.
5. Audit the boundaries:
   - no upward import;
   - no colour literal outside `Colors.ts`;
   - no `fontFamily`;
   - only lucide icons (through `shared/Icon`);
   - one `tdlib-update` listener;
   - no custom top bar, tab bar, status bar, or sheet container;
   - `recyclingKey` on each `expo-image` in a list or grid.
6. Audit reuse (Rules §3). For each new feature-folder component, write one line that tells why
   `shared/` plus props cannot do it.

---

## Phase 0 — Read and prepare

- [x] 0.1 Read `CLAUDE.md`.
- [x] 0.2 Read the spec.
- [x] 0.3 Get the list of frames and the design tokens from `Design.pen`.
- [x] 0.4 Get the node data and screenshots for frames 01, 02, 03 and the component frames.
- [ ] 0.5 Get the node data and screenshots for frames 04–15. Do this before you start each screen.

## Phase 1 — Project setup

- [x] 1.1 Move `app.json` into `app.config.ts`. Remove the `expo-font` plugin.
      Keep `userInterfaceStyle: "automatic"`. Set `android.allowBackup: false` (spec §3.2.4).
- [ ] 1.2 Read the SDK 57 docs with `expo-mcp` for each library in spec §2.
      Status: partly done. Read the docs for each library before its first use.
      Note: SDK 57 `expo-media-library` has a new API (`Asset`, `Album`, `Query`). Spec §2 `getAssetsAsync` can be legacy.
- [x] 1.3 Install the spec §2 libraries with `npx expo install`. Install no other library.
      Note: the gallery library is not installed. Its peer is `react-native-worklets-core`, which is
      prohibited. Decide on it in Phase 7 (task 7.9).
- [x] 1.4 Install `expo-dev-client` and `patch-package`. Add `"postinstall": "patch-package"`.
- [x] 1.5 Make Patch 1 for `react-native-tdlib/react-native.config.js` (spec §3.3).
      Save it in `patches/`.
- [x] 1.6 Run `npx expo-modules-autolinking react-native-config --platform android`.
      Make sure that `react-native-tdlib` has an `android` entry.
- [x] 1.7 Remove the template files: `src/components/Themed.tsx`, `src/components/useColorScheme.ts`,
      `src/app/(tabs)/index.tsx`, `src/app/(tabs)/profile.tsx`, `src/app/message.tsx`.
- [x] 1.8 Add `jest-expo` and `@testing-library/react-native`. Add a `test` script.
- [x] 1.9 Run `npx tsc --noEmit` and `npm run lint`. Both must pass.

## Phase 2 — Design foundation

- [x] 2.1 Write `src/constants/Colors.ts` with the `light`, `dark`, and `viewer*` tokens (Rules §6).
- [x] 2.2 Write `src/constants/Layout.ts`: radius 12 / 8, padding 20, grid sizes.
- [x] 2.3 Write `src/hooks/useColorScheme.ts`. It returns `{ scheme, colors }`.
- [x] 2.4 Write `shared/Icon.tsx` (lucide wrapper).
- [x] 2.5 Write `shared/Screen.tsx` (safe area + background).
- [x] 2.6 Write `shared/Button.tsx` from `Button / Primary` and `Button / Secondary`.
- [x] 2.7 Write `shared/InputField.tsx` from the input in frames 01 and 03.
- [x] 2.8 Write `shared/TitleBlock.tsx` from the heading in frames 01, 02, 03.
- [x] 2.9 Write `shared/Banner.tsx` from the note in frame 01.
- [x] 2.10 Write a component test for each shared component. Run the tests.
- [ ] 2.11 Root `_layout.tsx`: Stack, `ThemeProvider` colours from `Colors`, `expo-status-bar`,
       `(auth)` and `(tabs)` groups. Use `anchor` in `unstable_settings`.
       Status: partly done. The `(tabs)` group is added in task 6.1. The guard is added in task 4.8.

Write the other shared components (`ListRow`, `ProgressBar`, `Checkbox`, …) only when a screen
needs them.

## Phase 3 — TDLib proof (spec §11 step 1) 📱

- [x] 3.1 Write `src/telegram/types.ts`. Put TDLib shapes only.
- [x] 3.2 Write `src/telegram/client.ts`: `startTdLib`, the one `tdlib-update` subscription,
      the fan-out to listeners, and the send correlation (spec §3.2.3).
- [x] 3.3 Write `src/telegram/auth.ts`: the authorization state machine (spec §4.1).
      It maps the TDLib states to the domain `AuthStep`. Tests: `__tests__/telegram/`.
- [x] 3.4 👤 Get `api_id` and `api_hash` from my.telegram.org. Put them in the app config.
      Status: `.env.local` holds `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`. `app.config.ts`
      puts them into `extra.telegram`.
- [x] 3.5 Run `npx expo prebuild`, then `npx expo run:android`.
- [x] 3.6 📱 Make sure that `TdLib` is not `undefined` at runtime.
- [x] 3.7 📱 Run `startTdLib`. Make sure that `tdlib-update` events arrive.
      If New Architecture interop fails, record it (spec §12.1).
      Result (2026-10-10): the login on a real device works. The auth steps come from
      `updateAuthorizationState` events, so the events arrive.
- [x] 3.8 Write Patch 4 (reload-safe client) in `patches/react-native-tdlib+2.3.0.patch`.
      Finding (2026-10-10): `TdLibModule` keeps `client` in an instance field. A JS reload makes
      a new module instance with `client == null`. Then `startTdLib` starts a second TDLib on
      the same database, and TDLib gives "Can't lock file td.binlog, because it is already in
      use by current program". Fix: `client` is `static`, so a reload reuses the running
      client. The update handler emits to the context of the newest instance
      (`activeContext`), not to the dead context. The numbers 2 and 3 are in use (spec §3.3,
      task 5.0), so this patch is number 4. The patch file has only Patch 1 and Patch 4.
      Do not include `android/build/`.
      Check: the patch applies to a clean `react-native-tdlib@2.3.0` with `patch-package`.
- [x] 3.9 📱 Rebuild with `npx expo run:android`. Reload JS two times. Make sure that the
      session stays and that the lock error does not come back.
      Result (2026-10-10): each reload opens the Folders tab. The session stays. The lock error
      does not come back.

## Phase 4 — Auth screens (spec §11 step 3)

- [x] 4.1 Write `src/types/domain.ts` with the auth step type.
- [x] 4.2 Write `src/hooks/useAuthFlow.ts`. Subscribe to the domain auth steps from `auth.ts`.
      Make the display strings and the error text here.
- [x] 4.3 Write `(auth)/_layout.tsx` with the header options (Rules §5).
- [ ] 4.4 Write screen 01 `(auth)/phone/index.tsx`. Do the screen checks.
      Status: tsc, lint, test, and boundary audit pass. The design comparison waits for 👤 approval (native-sim pushes the repo).
- [x] 4.5 Write `auth/OtpCodeInput.tsx`.
- [ ] 4.6 Write screen 02 `(auth)/code/index.tsx`. Do the screen checks.
      Status: tsc, lint, test, and boundary audit pass. The design comparison waits for 👤 approval (native-sim pushes the repo).
- [ ] 4.7 Write screen 03 `(auth)/password/index.tsx`. Do the screen checks.
      Status: tsc, lint, test, and boundary audit pass. The design comparison waits for 👤 approval (native-sim pushes the repo).
      Note: "Forgot password?" shows recovery text only. TDLib email recovery needs raw-call results (5.0).
- [x] 4.8 Make the root layout send the user to `(auth)` or `(tabs)` from the auth state.
      Status: `src/app/index.tsx` is the gate. It redirects to `/folders` when the step is
      `ready`, and to `/phone` in every other state. The root `Stack` guards `(auth)` with
      `!signedIn` and `(tabs)` with `signedIn`, and `unstable_settings.anchor` is `index`, so a
      denied guard returns to the gate. Test: `__tests__/screens/index.test.tsx`.
- [x] 4.9 📱 Log in with phone, code, and 2FA password.
      Result (2026-10-10): the login with phone, code, and 2FA password works on a real device.
- [x] 4.10 📱 Close and open the app again. Make sure that it does not ask for login again.
       Result (2026-10-10): after a force-stop, the app opens on the Folders tab. It does not ask
       for login again.

## Phase 5 — Caption format (spec §11 step 2 — do before Phase 8)

> **Finding (2026-10-10):** `td_json_client_send` calls `client.send(fn, null, null)`. The Java
> `Client` drops a result when the handler is `null` (`Client.java:187`). Thus the direct result
> of a raw call (for example `searchChatMessages`, or an error from `sendMessage`) never gets to
> JS. Only updates get to JS. Spec §3.2.3 and §4.4 do not tell this.

- [x] 5.0 👤 Decide how to get raw-call results. Option A: Patch 3 — give `td_json_client_send`
      a result handler that emits the result on `tdlib-update`. Option B: use only wrapped
      methods (`getChatHistory`) and the local `dir_index`. Search-before-retry (spec §5.3)
      then uses `dir_index` after a resync.
      Decision (2026-10-10): Option B. The user accepts Patch 3 only if it is necessary, and it
      is not: a folder reads `dir_index` (a full scan is about 7 calls), send results come as
      updates (`updateMessageSendSucceeded` / `Failed`), and search-before-retry (task 9.2)
      reads the newest `getChatHistory` page, because a lost confirmation is a recent message.
      Do Patch 3 later only if a needed function gives its result only as a direct reply.
- [x] 5.1 Write `src/format/caption.ts`: `parse` and `serialise` for the caption format (spec §1).
      Decision (2026-10-10, user): the app does not support the unlim-cloud web app. The user
      uploads the ~600 old files again. The caption holds the folder names and the file name:
      `fileharbor:1:{"path":["Holiday","Beach"],"name":"IMG_001.jpg"}`. The captions are the
      only record of the folder tree: no server, no manifest, no local record.
      Status: `serialiseCaption` writes fixed JSON and rejects a bad name or a caption over
      1024 characters. `parseCaption` accepts any valid JSON with `path` and `name`, and ignores
      unknown keys. A name has no `/`, no control character, and no space at the start or end.
      The old `dirPath.ts` (`dir--…--/dir`) is removed.
- [x] 5.2 Write `__tests__/format/caption.test.ts` with round-trip tests and bad-input tests.
      Status: 2000 seeded random files (Unicode, emoji, quotes, `\`, `--`) round-trip.
- [x] 5.3 Write `src/telegram/search.ts`: `getChatHistory` (100 per call), `searchChatMessages`.
      Status: `getHistoryPage` and `getFullHistory` are done and tested. A short page is not the
      end; only an empty page is. No `searchChatMessages`: its result cannot get to JS without
      Patch 3 (decision 5.0).
- [x] 5.4 Write `src/telegram/savedMessages.ts`: get the Saved Messages chat id (spec §1).
      Status: `getProfile` → `createPrivateChat(id)`, cached. `auth.ts` clears the cache on
      `Closed`. Fix (2026-10-10): `getChat(id)` gave "Chat not found" on the device, because
      TDLib had not loaded the chat. `createPrivateChat` loads it.
- [x] 5.5 Write `src/index/db.ts` with the `dir_index` table (spec §5).
      Status: `fileharbor.db`, migrations by `PRAGMA user_version`. `replaceDirIndex` writes one
      exclusive transaction. Open: call `clearIndex` on log-out (from the hook layer, task 11.4).
- [x] 5.6 Write `src/index/sync.ts`: scan all captions, fill `dir_index`.
      Status: `syncIndex` gives a `SyncReport`: scanned, indexed, other (no FileHarbor caption:
      notes and the old web app files), and skipped (`bad_caption`, or `not_document` for a
      FileHarbor caption on a photo or a video). A failed scan does not change `dir_index`.
      `dir_index` is a cache. If app data is cleared, the next sync builds it again.
- [x] 5.7 📱 Run the sync report on the live account. Record the counts.
      Status: the Folders tab is a temporary sync report. It runs `syncIndex` and shows the
      counts, each folder path with its file count, and each skipped caption. Task 6.5
      replaces it. Until Phase 8 there is no FileHarbor caption, so expect 0 files and all
      messages as "other".
      Result (2026-10-10, device): 612 messages · 0 files · 612 other · 0 skipped. The paging
      reads the full history. Phase 5 is complete.
- [x] 5.8 ~~Compare the folder tree with the web app.~~ Cancelled (2026-10-10): the app does
      not support the web app (5.1).
- [x] 5.9 Find where the web app keeps the folder names. Decide how the app gets them.
      Finding (2026-10-10, web app bundle `FilesView-*.js`): the web app keeps the folder tree in
      its own Firebase Realtime Database. Its captions hold folder ids only.
      Decision (2026-10-10, user): the caption holds the folder names (5.1). Task 6.5 can start.
- [x] 5.10 Decide how to treat the other web app caption types (gallery, trash, favorite,
      hidden, chunk). Decision (2026-10-10, user): no gallery uploads, and no support for these
      captions. The sync counts them as "other".
- [x] 5.11 👤 Approve the caption format in 5.1 before task 8.5. Approved (2026-10-10). After the first real upload,
      change it only with a new version (Rules §1).

## Phase 6 — Tabs and folder list

- [ ] 6.1 Write `(tabs)/_layout.tsx` with `NativeTabs`: Folders, Downloads, Settings.
      Add the Android drawables in `assets/icons/`.
      Status: the layout exists, because task 4.8 needs the route for its guard. The icons use
      the `md` prop (Material Symbols names), not drawables in `assets/icons/`. 👤 Confirm this,
      or ask for drawables and a config plugin that copies them into `android/app/src/main/res`.
      Open: the Downloads `Badge` waits for `useDownloads` (task 7.12). Compare the tab bar with
      the `Chrome / …` frames.
- [x] 6.2 Write `folders/_layout.tsx`, `transfers/_layout.tsx`, `settings/_layout.tsx` (Stack only).
      Done. `transfers/index.tsx` redirects to `./downloads`. The Downloads, Uploads, and
      Settings screens are placeholders until tasks 7.14, 9.6, and 11.4.
- [x] 6.3 Write `shared/ListRow.tsx` and `shared/SectionHeader.tsx`.
      Done. Also added to `shared/`: `RowList` (FlashList of card rows, for 04 and 12–14),
      `ButtonRow` (equal-width buttons, 06), and `SheetGrabber` (Android only). New props:
      `Button` variant `header`, `TitleBlock` `align`/`action`, `Screen` `background`/`fit`,
      `InputField` `hintIcon`/`autoCapitalize`/`maxLength`, `FormBody` `dense`.
      `ListRow` has `trailing` "chevron" | "none" only. Add the other kinds with their screens.
- [x] 6.4 Write `src/hooks/useFolderList.ts`.
      Done. It shows the cache first, then reads all captions again (spec §5). It reads the
      cache again on each focus (after sheet 06). `FLOOD_WAIT` shows as `warn`, not `danger`.
      Database migration 2 adds `size` and `mime_type` to `dir_index`, and the `local_dir` table.
- [ ] 6.5 Write screen 04 and 05 `folders/index.tsx` (list and empty). Do the screen checks.
      Status: the screen and the tests are done (loaded, empty, loading, error, rate-limited,
      search). tsc, lint, and the audits pass.
      Difference from frame 04: the search is the native `Stack.SearchBar`, not a field in the
      content (Rules §3).
      Difference from frame 05: the circle is `bgSunken`, because `bgMuted` does not show on
      the `bgMuted` page.
      Files in the root folder are not listed. The rows do not open yet (task 7.6).
      Open: 👤 compare with frames 04 and 05 in light and dark (`native-sim` needs approval,
      or use a device).
- [ ] 6.6 Write screen 06 `folders/new/index.tsx` (form sheet).
      Status: the screen and the tests are done. tsc, lint, and the audits pass.
      A new empty folder is a `local_dir` row on this device only. Telegram has no record of it
      until its first upload, because the caption is the only record of the folder tree. A sync
      deletes the row when the folder has files. Log-out clears it (task 11.4).
      Open: on a device, check `fitToContents` with the keyboard open, and the grabber on
      Android. 👤 Compare with frame 06 in light and dark.

## Phase 7 — Read path (spec §11 step 4)

- [ ] 7.1 Write `src/telegram/download.ts`: `downloadFile`, priority download, cancel, progress.
- [ ] 7.2 Write `src/media/minithumbnail.ts`: signed-int array to data URI (spec §8.2).
- [ ] 7.3 Write `shared/Thumbnail.tsx` (`expo-image`, `recyclingKey` required).
- [ ] 7.4 Write `src/hooks/useFolderContents.ts`.
- [ ] 7.5 Write `gallery/GalleryGrid.tsx` and `gallery/GridCell.tsx` (FlashList v2, 3 columns).
- [ ] 7.6 Write screen 07 `folders/[folderId]/index.tsx`. Do the screen checks.
- [ ] 7.7 Write `src/hooks/useSelection.ts` and `shared/Checkbox.tsx`.
- [ ] 7.8 Write screen 08 (multi-select in screen 07) and `gallery/SelectionToolbar.tsx`.
      Do the screen checks.
- [ ] 7.9 Write the viewer components: `PhotoViewer`, `VideoViewer`, `ViewerFileMeta`,
      `ViewerFilmstrip`, `ViewerActionRow`.
- [ ] 7.10 Write screens 09 and 10 `viewer/[folderId]/[messageId]/index.tsx`.
       Do the screen checks.
- [ ] 7.11 Write screen 11 `folders/[folderId]/[messageId]/index.tsx` (unsupported-file sheet).
       Do the screen checks.
- [ ] 7.12 Write `src/hooks/useDownloads.ts`. Add the Downloads tab badge (hide it at zero).
- [ ] 7.13 Write `shared/ProgressBar.tsx` and `transfers/TransferRow.tsx`.
- [ ] 7.14 Write screen 12 `transfers/downloads/index.tsx` and `transfers/index.tsx` (redirect).
       Do the screen checks.
- [ ] 7.15 Write screen 14 (selection mode in screen 12). Do the screen checks.
- [ ] 7.16 Write `src/hooks/useMediaPermissions.ts`. Save downloads with `expo-media-library`.
- [ ] 7.17 📱 Download the 51.8 MB video. Make sure that its SHA-256 is correct.
- [ ] 7.18 📱 Make sure that `expo-image` shows a `.heic` file from a TDLib path (spec §12.2).

## Phase 8 — Write path: one file (spec §11 step 5)

- [ ] 8.1 Make sure that Phase 5 is complete. Do not start this phase before.
- [ ] 8.2 Write `src/media/thumbnail.ts` (320 px thumbnail) and `src/media/hash.ts` (SHA-256).
- [ ] 8.3 Write `src/telegram/upload.ts`: raw `sendMessage` with `inputMessageDocument`,
      `disable_content_type_detection: true`. Do not `await` the send (spec §4.2).
- [ ] 8.4 📱 Find what `inputFileLocal` accepts on Android (spec §12.3).
- [ ] 8.5 📱 Upload one file with the correct caption.
- [ ] 8.6 📱 Check the caption in Telegram. Clear the app data, sync, and make sure that the file
      shows in the correct folder with the correct name.

## Phase 9 — Persistent upload queue (spec §11 step 6)

- [ ] 9.1 Add the `upload_queue` table to `src/index/db.ts`.
- [ ] 9.2 Write `src/transfer/queue.ts`: persistent status, concurrency 3–4 (never above 4),
      SHA-256 dedupe, search-before-retry.
- [ ] 9.3 Show `flood_wait` as a `warn` state with a countdown. Never use `danger` for it.
- [ ] 9.4 Write `src/media/picker.ts`: `expo-media-library` pages. No bulk copy to cache.
- [ ] 9.5 Write `src/hooks/useUploadQueue.ts`.
- [ ] 9.6 Write `transfers/UploadBatchCard.tsx` and screen 13 `transfers/uploads/index.tsx`.
      Do the screen checks.
- [ ] 9.7 📱 Kill the app during a batch. Open it again. Make sure that the batch continues.

## Phase 10 — Bulk upload (spec §11 step 7) 📱👤

- [ ] 10.1 📱 Upload 600 files (the old web app files again). Record the flood behaviour and the
      total time.
- [ ] 10.2 📱 Test album batching: after a sync, each album item is in its folder (spec §6, §12.5).
- [ ] 10.3 👤 Decide on album batching from the results.

## Phase 11 — Foreground service and polish (spec §11 step 8)

- [ ] 11.1 Write `plugins/withForegroundService.js` (`dataSync`, spec §7).
- [ ] 11.2 Write `src/transfer/foregroundService.ts`. Handle `onTimeout`.
- [ ] 11.3 Write `src/storage/prefs.ts` (mmkv) and `src/storage/secrets.ts` (secure-store).
- [ ] 11.4 Write screen 15 `settings/index.tsx`. Do the screen checks.
- [ ] 11.5 Add folder operations (rename, move, delete) and trash.
- [ ] 11.6 Call `optimizeStorage` at intervals (spec §4.3).
- [ ] 11.7 Add `+not-found.tsx` with `shared/Screen`.
- [ ] 11.8 Do a last boundary audit on all files.
