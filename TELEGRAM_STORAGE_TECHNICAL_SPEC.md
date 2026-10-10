# BUILD ORDERS — Telegram-Backed Cloud Storage (Expo, Android-first)

You are building an Expo React Native app that stores files in the user's Telegram **Saved
Messages** over MTProto, on-device. Android first; iOS later.

**Scope rules:**
- **DO NOT** build or deploy any server, relay, or proxy. The app does all Telegram work itself.
- **DO NOT** use the Telegram Bot API. Bots cannot read a user's Saved Messages, and its caps
  (50 MB up / 20 MB down) are below the account's existing 51.8 MB file.
- **DO NOT** implement file chunking, part sizing, resume logic, `FLOOD_WAIT` backoff, DC
  migration, file-reference refresh, or SRP 2FA. TDLib does all of it. One file = one
  `sendMessage` = one Telegram message containing the whole file.
- **DO NOT** treat facts in §12 as true. They are unverified. Verify before relying on them.

Facts tagged **[verified]** were confirmed against a real build or against source in
`react-native-tdlib@2.3.0`. Trust them.

The target account holds ~600 files from the unlim-cloud web app. **Decision (2026-10-10):** the
app does not support the web app or its caption formats. The user uploads those files again from
the app. The app ignores the old messages.

---

## 1. Data model

Backend chat is the user's own Saved Messages. Its `chat_id` **equals the user's own user ID**.

```
getProfile()  →  User.id  →  createPrivateChat(id)   // loads the chat; getChat(id) alone
                                                     // gives "Chat not found" on a new session
```

One file = one message = `inputMessageDocument`. The folder tree and the file name live in the
message caption:

```
fileharbor:1:<JSON>      e.g.  fileharbor:1:{"path":["Holiday","Beach"],"name":"IMG_001.jpg"}
           ^version             path: folder names from the root down ([] = root)
```

- Folders are identified by name. In the app, a dir path is the names joined with `/`; the root
  is `""`. A name is 1–255 characters, with no `/`, no control character, no space at the start or
  the end, and not `.` or `..`. The caption is at most 1024 characters (Telegram, no Premium).
- `serialise` writes `JSON.stringify({path, name})`: fixed key order, no spaces. `parse` accepts
  any valid JSON with the two keys, and ignores unknown keys.
- The caption `name` is the name the app shows, not the document `file_name`. A rename edits the
  caption only.
- A caption without the `fileharbor:1:` prefix is not a FileHarbor file (a note, or a web app
  file). The sync counts it as "other".

**Orders:**

1. Implement `parse` and `serialise` for the caption format as a pair in `format/caption.ts`, with
   round-trip tests. After the first real upload, the format is fixed: change it only with a new
   version prefix, and keep the parser for each old version. A sent caption cannot be changed in
   bulk, and there is no transaction to roll back.
2. The captions are the **only** record of the folder tree. Do not keep it in a server, a manifest
   message, or local storage: if the user clears app data, nothing is lost. A folder has no server
   object. It exists on Telegram when the first file with that path is uploaded. An empty folder
   exists only on-device, and it is lost if app data is cleared. Renaming or moving a folder edits
   the caption of each file in it.
3. Rebuild the entire tree by scanning captions on a fresh install. **DO NOT** write a manifest
   file.
4. Upload as **documents**, byte-exact. **DO NOT** re-compress.
5. **DO NOT** add client-side encryption. Filenames, captions and thumbnails are plaintext on
   Telegram's servers, Saved Messages is not E2E-encrypted, and encrypting would break the
   format. This is a v2 format decision, not a flag.

---

## 2. Stack

**[verified]** this combination builds green: Expo SDK 57.0.24 / RN 0.86.3 / `newArchEnabled=true`
/ AGP buildTools 36 / Gradle 9.3.1 / JDK 21.

Use a **dev client** (`expo-dev-client` + `npx expo prebuild`). Expo Go cannot load TDLib.

Install exactly these:

| Purpose | Library | Constraints |
|---|---|---|
| MTProto | `react-native-tdlib` | Apply patches in §3.3 |
| Navigation / 3 tabs | `expo-router` | Use `expo-router/unstable-native-tabs` for native Material bottom nav (supports `Badge`). Plain JS `Tabs` is the fallback. |
| Image render + cache | `expo-image` | Glide-backed. **HEIC ✓ Android**, + JPEG/PNG/WebP/AVIF/GIF. Pass `recyclingKey` in grids; `placeholder` for thumbhash. |
| Video | `expo-video` | **DO NOT** use `expo-av` — deprecated. |
| Grid virtualisation | `@shopify/flash-list` v2 | JS-only, New-Arch-native, needs no size estimates, masonry supported. `@legendapp/list` is the drop-in alternative. |
| Fullscreen viewer | `react-native-awesome-gallery` | Pinch/zoom/double-tap/swipe-to-close. `renderItem` accepts `expo-image` / `expo-video`. Use the **`@benschac`** fork for Reanimated v4 + New Arch. |
| Gestures / animation | `react-native-gesture-handler`, `react-native-reanimated` | Viewer peer deps |
| Picking media | `expo-media-library` (bulk), `expo-image-picker` (small selections) | See §6 |
| Saving downloads | `expo-media-library` | Android 13+: `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` |
| File paths | `expo-file-system` | |
| Index DB | `expo-sqlite` | Two tables, §5 |
| KV / prefs | `react-native-mmkv` v4 | Nitro; synchronous. Pulls `react-native-nitro-modules`. |
| Secrets | `expo-secure-store` | |
| Thumbnails | `expo-image-manipulator`, `expo-video-thumbnails` | |
| Screen-on during transfer | `expo-keep-awake` | |
| Dep patching | `patch-package` | Required, §3.3 |

**DO NOT install:**

| Library | Reason |
|---|---|
| `react-native-nitro-sqlite` | Workload is ~600 rows; `expo-sqlite` is first-party |
| `react-native-quick-crypto` | MTProto crypto is inside TDLib; `expo-crypto` covers SHA-256 |
| `react-native-worklets-core` | Peer-dep-only by its own README; Reanimated covers the viewer |
| `react-native-vision-camera`, `react-native-filament` | Out of scope |
| GramJS / `telegram` | Does not work in RN — WebSocket upgrade fails at `Expected HTTP 101 response but was '200 OK'`; repo archived |

---

## 3. The binding: `react-native-tdlib@2.3.0`

Ships prebuilt TDLib. Android ABIs: `arm64-v8a`, `armeabi-v7a`, `x86_64`.

Updates reach JS as `NativeEventEmitter` events named **`tdlib-update`**, shape
`{ type: string, raw: string }` — `raw` is TDLib JSON, `type` is the lower-camel type name.

### 3.1 Wrapped methods **[verified from `index.d.ts`]**

| Need | Method |
|---|---|
| Init | `startTdLib({api_id, api_hash, system_language_code?, device_model?, system_version?, application_version?})` |
| Phone / OTP / 2FA | `login({countrycode, phoneNumber})`, `verifyPhoneNumber(otp)`, `verifyPassword(pw)`, `getAuthorizationState()` |
| Own user | `getProfile()` → `GetMe` → `TdApi.User` JSON |
| Chats | `getChat`, `getChats`, `loadChats`, `searchChats`, `openChat`, `closeChat` |
| List files | `getChatHistory(chatId, fromMessageId, limit, …)` — max 100/call — `getMessage`, `getMessagesCompat` |
| Download | `downloadFile(fileId)`, `downloadFileByRemoteId(remoteId)` |
| Cancel | `cancelDownloadFile(fileId, onlyIfPending)`, `cancelDownloadByRemoteId(remoteId)` |
| Poll file | `getFile(fileId)` |
| Delete | `deleteMessages(chatId, messageIds[], revoke?)` |
| Options | `getOption(name)`, `setOption(name, {type, value})` |
| Session | `logout()`, `destroy()` |
| Events | `addListener('tdlib-update')`, `removeListeners(n)` |
| Anything else | `td_json_client_send(req)`, `td_json_client_execute(req)` |

### 3.2 Five constraints **[verified from `TdLibModule.java`]** — obey these

**1. `sendMessage(chatId, text, …)` is text-only.** It cannot attach a file. Send **all uploads**
through raw `td_json_client_send` with `inputMessageDocument`. There is no other path.

**2. The raw hatch is universal — never fork for functionality.** `convertMapToFunction` pushes the
JS object through Gson into a typed `TdApi.Function`, dispatching nested polymorphic fields on
`@type` (`TdApiAbstractTypeFactory`). Every TDLib function works: `sendMessage` with documents,
`sendMessageAlbum`, `downloadFile` with priority, `searchChatMessages`, `addFileToDownloads`,
`optimizeStorage`.

**3. Raw sends are fire-and-forget with no correlation.** `client.send(fn, null, null)`; replies
arrive only on the global `tdlib-update` stream, and `@extra` is dropped by the Java binding.
Correlate an upload via `updateNewMessage` (temporary id) → `updateMessageSendSucceeded`
(`old_message_id` → real message). Build this correlation layer **once**, in
`telegram/client.ts`. Wrapped methods do attach result handlers and resolve their promises
normally.

**4. `startTdLib` hardcodes the TDLib parameters.** It sets `useMessageDatabase = true`,
`useFileDatabase = true`, `useSecretChats = true`, `databaseDirectory = <filesDir>/tdlib`, and
passes only `api_id` / `api_hash` / the four cosmetic strings. It does **not** set
`databaseEncryptionKey`, `useChatInfoDatabase`, or `filesDirectory`.
- **DO NOT call `setTdlibParameters` yourself.** TDLib rejects it after init.
- **DO NOT use `td_json_client_create` as the entry point.** Its result handler only `Log.d`s — you
  would lose every progress event.
- The local DB is therefore **unencrypted**, in app-private `filesDir` (needs root or a debuggable
  build to read). Set `android:allowBackup="false"`. If encryption-at-rest is required, apply
  Patch 2.

**5. `downloadFile(fileId)` hardcodes `DownloadFile(fileId, priority=1, offset=0, limit=0, synchronous=true)`.**
- `synchronous=true` → the promise resolves only when the file is **fully** downloaded. Use it as
  one-promise-per-file in the download manager.
- `priority=1` is TDLib's **lowest** (range 1–32), so the wrapped call cannot promote the file the
  user is currently viewing. For that, send raw
  `{'@type':'downloadFile', file_id, priority:32, offset:0, limit:0, synchronous:false}` and track
  `updateFile` yourself.

### 3.3 Patches — apply via `patch-package`

**Patch 1 — autolinking. MANDATORY.** Without it the module is silently never linked: absent from
`./gradlew projects`, no `TdLibPackage` in `PackageList.java`, **the build still succeeds**, and
`TdLib` is `undefined` at runtime with no error naming the cause.

Cause: the shipped `react-native.config.js` sets an absolute `sourceDir`, and
`expo-modules-autolinking/build/reactNativeConfig/androidResolver.js` does
`path.join(packageRoot, sourceDir)`. `path.join` (unlike `path.resolve`) does not reset on an
absolute second argument, so the path doubles, no `build.gradle` is found, the resolver returns
`null`, and the whole `platforms.android` entry is dropped.

```js
// node_modules/react-native-tdlib/react-native.config.js
module.exports = {
    dependency: {
        platforms: {
            ios: {},
            android: {
                // no sourceDir — resolver defaults to <packageRoot>/android
                // keep packageImportPath: auto-discovery infers the WRONG class
                // (com.reactnativetdlib.TdLibPackage) from the manifest package
                packageImportPath: 'import com.reactnativetdlib.tdlibclient.TdLibPackage;',
                packageInstance: 'new TdLibPackage()',
            },
        },
    },
};
```

**[verified]** with this patch autolinking resolves and `PackageList.java` gets the correct import.

When testing autolinking:
- Delete `android/build/generated/autolinking/autolinking.json` after changing config, or Gradle
  serves the stale result.
- Always pass `--platform android` to `expo-modules-autolinking react-native-config`. It resolves
  **one platform at a time, defaulting to iOS** — omit the flag and a working setup reads as broken.

**Patch 2 — DB encryption. OPTIONAL.** Add `databaseEncryptionKey` (+ `useChatInfoDatabase`,
`filesDirectory`) to `setTdLibParameters` in `TdLibModule.java`. Generate the key once with
`expo-crypto`; store it in `expo-secure-store`. Losing it forces re-login; leaking it plus device
files gives up the account.

### 3.4 Verified Android build results **[verified 2026-09-21]**

| Check | Result |
|---|---|
| Play **16 KB page size** gate | ✅ `arm64-v8a` + `x86_64` `libtdjni.so` PT_LOAD `p_align = 2**14`; `armeabi-v7a` is `2**12`, exempt as 32-bit |
| 16 KB zip alignment in APK | ✅ all 15 `.so` 16384-aligned, stored uncompressed |
| `:react-native-tdlib:assembleDebug` | ✅ |
| `:app:assembleDebug` | ✅ |
| `libtdjni.so` packaged | ✅ 21,450,448 B in `lib/arm64-v8a/` |
| `TdLibPackage` in `PackageList.java` | ✅ with Patch 1 |
| `newArchEnabled=true` | ✅ builds via legacy interop — **runtime unverified, §12** |

Build orders from this:
- Ship an **AAB**, not an APK. `libtdjni.so` is ~21 MB arm64; a debug arm64-only APK measured
  **68 MB**. Consider dropping `armeabi-v7a`.
- Ignore AGP's `package="com.reactnativetdlib"` manifest warning. It is harmless and unrelated to
  autolinking. Adding `namespace` does **not** fix autolinking; only Patch 1 does.
- If you fork, pin `com.facebook.react:react-native:+`. It resolves only via RN's Gradle plugin
  substitution to `react-android`.

Credential orders:
- Put `api_id` / `api_hash` from my.telegram.org in the bundle. They identify **your app, not the
  user**; extraction is the accepted MTProto-client tradeoff.
- **NEVER** transmit a session string off-device. It is full account access and **bypasses 2FA**.

---

## 4. Operations

### 4.1 Auth

Call `startTdLib`, subscribe to `tdlib-update`, then drive off `updateAuthorizationState`:

| State | Respond with |
|---|---|
| `authorizationStateWaitTdlibParameters` | **nothing** — `startTdLib` already sent them (§3.2.4) |
| `authorizationStateWaitPhoneNumber` | `login({countrycode, phoneNumber})` |
| `authorizationStateWaitCode` | `verifyPhoneNumber(otp)` |
| `authorizationStateWaitPassword` | `verifyPassword(pw)` — 2FA, TDLib does SRP |
| `authorizationStateReady` | proceed |
| `authorizationStateClosed` | native client is nulled; next `startTdLib` creates a fresh one |

`login` concatenates `countrycode + phoneNumber` verbatim — **`countrycode` must include the `+`**
(e.g. `"+91"`). Session persists in TDLib's own DB; relaunch must not re-login.

### 4.2 Upload

```ts
TdLib.td_json_client_send({
  '@type': 'sendMessage',
  chat_id: savedMessagesChatId,
  input_message_content: {
    '@type': 'inputMessageDocument',
    document:  { '@type': 'inputFileLocal', path: localPath },
    thumbnail: { thumbnail: { '@type': 'inputFileLocal', path: thumbPath },
                 width: 320, height: 320 },
    caption: { '@type': 'formattedText', text: serialiseCaption({ dirPath, name }) },  // §1
    disable_content_type_detection: true,
  },
});
```

- **Always set `disable_content_type_detection: true`.** Without it Telegram may reinterpret the
  upload as a photo or video and re-encode it lossily.
- **Never `await` a send.** The bridge stalls on large files. Drive UI from the update stream.
- Progress: `updateFile` → `file.remote.uploaded_size` vs `file.size`.
- Completion: `updateMessageSendSucceeded`.

### 4.3 Download

- Default: `downloadFile(fileId)` — one promise per file, resolves on completion.
- Priority override: raw `downloadFile` with `priority: 32, synchronous: false`.
- Progress: `updateFile` → `file.local.downloaded_size` / `file.expected_size`.
- On completion read `file.local.path`. The file sits in TDLib's files dir — copy it out with
  `expo-file-system`, or hand it to `expo-media-library` / `expo-sharing`.
- There is **no 20 MB ceiling**. That was Bot-API-only.
- Call `optimizeStorage` periodically or TDLib's file cache grows unbounded.

### 4.4 Listing

- One folder: read the local `dir_index` cache (§5). `searchChatMessages` results need raw-call
  results, which the binding does not give without a patch (TaskList 5.0).
- Full sync: `getChatHistory`, 100/call, ~7 calls for 600 files. It rebuilds `dir_index`.

---

## 5. Local state

TDLib is the database. `use_message_database` and `use_file_database` are on, so message history,
file records and part-level transfer resume are already persisted natively. **DO NOT rebuild any of
that.** Saved Messages is the source of truth; both tables below are caches rebuildable by
rescanning.

```sql
CREATE TABLE dir_index (            -- parsed folder paths; TDLib stores the caption, not semantics
  message_id INTEGER PRIMARY KEY,
  dir_path   TEXT NOT NULL,
  name       TEXT NOT NULL,
  date       INTEGER NOT NULL,
  size       INTEGER NOT NULL DEFAULT 0,   -- migration 2: bytes, 0 when unknown
  mime_type  TEXT NOT NULL DEFAULT ''      -- migration 2: 04 media/document icon
);
CREATE INDEX idx_dir ON dir_index(dir_path);

CREATE TABLE local_dir (            -- migration 2: empty folders made in 06, on this device only
  dir_path   TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE upload_queue (         -- intent TDLib has no concept of
  id         TEXT PRIMARY KEY,
  local_uri  TEXT NOT NULL,
  dir_path   TEXT NOT NULL,
  status     TEXT NOT NULL,         -- queued|sending|done|error
  message_id INTEGER,
  sha256     TEXT,
  attempts   INTEGER DEFAULT 0
);
```

`local_dir` is the only table that a rescan cannot rebuild. A folder with no file has no caption,
so Telegram has no record of it. A sync deletes the row when `dir_index` has a file in that folder
or below it. After that, the captions are the record. Log-out deletes all rows.

Queue orders:

1. Persist status per file. A 600-file batch must never restart from zero.
2. Render `flood_wait` as a **distinct UI state, never an error** — e.g. "rate-limited — resuming
   in 4:12". Red errors make users cancel and retry, worsening it.
3. Make retries idempotent. A send whose confirmation was lost may have succeeded — run
   `searchChatMessages` for the filename before retrying, or flaky networks create duplicates.
4. Dedupe by SHA-256 before uploading. If already indexed, insert only a `dir_index` row.
5. Cap upload concurrency at **3–4**. More does not help once flood control binds.

---

## 6. Bulk upload (600 files)

Flood pacing dominates, not bandwidth. TDLib paces sends and handles `FLOOD_WAIT` internally but
cannot raise Telegram's ceiling.

- Sustained ≈ **1 message / 2–3 s** → 600 messages have a **20–30 min floor before any bytes move**.
- 600 × ~4 MB ≈ 2.4 GB ≈ 33 min at 10 Mbps up.
- Plan for **30–60 min total**.

**Album batching is the 10× lever.** `sendMessageAlbum` groups up to **10 documents per message**:
600 → 60 messages, pacing floor ~25 min → ~3 min. Album items keep individual captions, so the
§1 caption scheme survives. Not in the wrapped API — use raw `td_json_client_send`.
**Validate on the live account before adopting it:** after a fresh sync, each album item must
show in its folder.

Selection and staging orders — these are correctness requirements, not optimisations:

1. Use **`expo-media-library`, not `DocumentPicker`,** for bulk. Paginate with
   `getAssetsAsync({first, after})`. Returning 600 assets at once is a memory problem and a frozen
   UI.
2. **DO NOT `copyToCacheDirectory` in bulk.** Duplicating 2–3 GB into cache starts failing
   unrelated writes. `getAssetInfoAsync()` yields a `localUri` that `inputFileLocal` reads directly.
3. Stream, don't materialise: 600 rows in SQLite, ~4 in flight. **Never** hold 600 hydrated assets
   in component state.
4. Generate thumbnails with `expo-image-manipulator` / `expo-video-thumbnails` and attach as
   `thumbnail`.
5. Request Android 13+ permissions `READ_MEDIA_IMAGES` and `READ_MEDIA_VIDEO`.
6. *(iOS, later)* Under "Optimise iPhone Storage" the local asset is a low-res placeholder and
   `getAssetInfoAsync()` must fetch the original from iCloud — slow, fails offline. Guard this: the
   dangerous silent failure is uploading placeholders instead of originals.

---

## 7. Background transfer (OS limits, not library limits)

TDLib uses its own MTProto sockets, so iOS background `URLSession` (HTTP-only) is unavailable.

**Android** — use a **foreground service** with a persistent notification. `expo-background-task` /
`expo-task-manager` alone will **not** work: they grant short windows ~15 min apart. Needs a small
config plugin. Targeting API 35+ is mandatory on Play, so:

1. Declare `android:foregroundServiceType="dataSync"` and the `FOREGROUND_SERVICE_DATA_SYNC`
   permission.
2. Budget for the **6 h per 24 h cap** on `dataSync`, shared across all your `dataSync` services. A
   30–60 min batch fits; many batches in one day can exhaust it.
3. Implement `Service.onTimeout()` and call `stopSelf()` within seconds, or the system throws. Once
   exhausted, starting another `dataSync` service throws
   `ForegroundServiceStartNotAllowedException` until the user foregrounds the app.
4. Start it only from **direct user interaction** — then the full 6 h is available. It cannot be
   launched from `BOOT_COMPLETED` on Android 15+.
5. Evaluate **user-initiated data transfer jobs**, which Google recommends over `dataSync` for
   network transfers (they handle constraint tracking and wakelocks). Needs its own native
   plumbing.

**iOS (later)** — the app suspends seconds after backgrounding and TDLib's threads with it;
`beginBackgroundTask` buys tens of seconds. Background 2.4 GB is **not possible**. Treat a 600-file
upload as foreground-only, 30–60 min screen-on: hold `expo-keep-awake`, lean on TDLib's resume, and
show "412 of 600 uploaded — resume" on reopen.

---

## 8. UI

Three bottom tabs: **Folders · Downloads · Settings**. Badge the Downloads tab with the active
transfer count.

```
Folders  →  folder list  →  thumbnail grid  →  fullscreen viewer
                            (FlashList v2,     (awesome-gallery,
                             numColumns 3)      expo-image / expo-video)
```

**Orders:**

1. **Never download originals for the grid.** Each `Document` in the history carries `thumbnail`
   (the 320 px JPEG you uploaded, a few KB) and `minithumbnail` (~40 px JPEG embedded **in the
   message** — zero network). Render `minithumbnail` immediately, then `downloadFile` the
   `thumbnail`; TDLib's file DB caches it, so scrollback costs nothing.
2. **[verified] caveat:** no Gson `byte[]` adapter is registered, so `minithumbnail.data` arrives as
   a JSON **array of signed ints**, not base64. Convert in JS, or skip minithumbnails and go
   straight to `thumbnail`.
3. Pass `recyclingKey` to every `expo-image` in the grid, or recycled cells show the previous image.
4. Multi-select download: keep selection in local UI state, fire `downloadFile(fileId)` per item,
   3–4 concurrent. Parallel works natively — **do not** build a serial fallback.
5. Preview routing: `.jpeg` / `.png` / `.heic` → `expo-image`; `.mp4` → `expo-video`; anything else
   → bottom sheet offering download-to-device.
6. Downloads tab: one row per active transfer from `updateFile`
   (`local.downloaded_size / expected_size`), with cancel → `cancelDownloadFile(fileId, false)`.

---

## 9. Module layout

```
src/
  telegram/          ← every TDLib call lives behind here
    client.ts        startTdLib, single tdlib-update subscription + fan-out,
                     raw-send ⇄ update correlation (§3.2.3)
    auth.ts          authorization state machine
    upload.ts        sendMessage / sendMessageAlbum
    download.ts      downloadFile + updateFile progress
    search.ts        searchChatMessages / getChatHistory
  format/
    caption.ts       parse + serialise "fileharbor:1:{…}"   ← round-trip tested
  media/
    picker.ts        media-library pagination
    thumbnail.ts     thumb generation
    hash.ts          streaming SHA-256
  transfer/
    queue.ts         persistent queue, concurrency, resume
  index/
    db.ts, sync.ts   dir_index maintenance
  ui/
    Login, Folders, Gallery, Viewer, Downloads, Settings
```

- Create **exactly one** `tdlib-update` subscription, in `client.ts`, and fan out internally.
  Scattered `NativeEventEmitter` listeners cause duplicate handling and leaks.
- Keep `telegram/` free of app concepts. TDLib's real interface is JSON in/out, so a replacement
  Kotlin module is ~150 lines — but only if the boundary holds.

---

## 10. Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `TdLib` is `undefined`, build succeeded | autolinking dropped `platforms.android` | Patch 1, §3.3 |
| `Too Many Requests: retry after X` | flood limit | wait exactly X; distinct UI state, never red |
| Upload silently becomes a compressed photo | missing `disable_content_type_detection` | always set it |
| Bridge stalls on large files | awaiting `sendMessage` | fire-and-forget; drive UI from `updateFile` |
| Duplicates after interruption | non-idempotent retry | search-before-send |
| Upload seems to succeed but never confirms | raw send has no `@extra` correlation | watch `updateNewMessage` → `updateMessageSendSucceeded` |
| Upload missing from its folder after a sync | caption does not parse, or album item lost its caption | round-trip tests; check the sync report |
| Storage fills up | TDLib files-dir cache growth | `optimizeStorage` periodically |
| Recycled grid cells show wrong image | missing `recyclingKey` | set it on every `expo-image` |
| Auth loop on relaunch | TDLib DB dir wiped, or key lost if Patch 2 applied | persist the key in SecureStore |
| Placeholder-quality upload (iOS, later) | iCloud original not local | fetch original first; block with a clear state |

---

## 11. Build order — do these in sequence

1. **Apply Patch 1 and prove TDLib works at runtime on a device.** The build is already verified;
   bridgeless runtime is not. Bar to clear: dev client on a real device, `startTdLib`, log in by
   phone, assert `tdlib-update` events arrive. Everything else is wasted effort until this passes.
2. **Caption format.** Parse, serialise, round-trip tests, and the sync report on the live account.
3. Auth state machine. Confirm relaunch does not re-login.
4. Read path: list Saved Messages, thumbnails, download, verify SHA-256 on the 51.8 MB video.
5. Write path: **one** file, correct caption — then confirm the caption in Telegram, and the file in
   its folder after a fresh sync.
6. Upload queue with persistence. Test by killing the app mid-batch.
7. Bulk 600. Measure real flood behaviour, then decide album batching on live evidence.
8. Android foreground service; gallery polish, folder ops, trash.

**Step 2 strictly before step 5.** A wrong caption format puts 600 real files into the wrong
folders, with no rollback.

---

## 12. Unverified — verify before relying on any of these

1. **TDLib runtime under bridgeless New Architecture.** The build passes; that does not prove a
   legacy bridge module works at runtime. If interop misbehaves, `newArchEnabled=false` is a
   temporary fallback only — Expo is phasing legacy arch out.
2. **`expo-image` decoding `.heic` from a TDLib path with no extension.** TDLib names files by id;
   Glide may sniff the container rather than trust the name.
3. **What `inputFileLocal` accepts on Android.** `content://` URIs from `expo-image-picker` almost
   certainly need copying to a real path first.
4. **`react-native-awesome-gallery` under Reanimated v4 + bridgeless**, alongside the TDLib legacy
   bridge module.
5. **Album batching** keeps each item's caption (§6).

---

## 13. Account-safety constraints

Telegram's ToS do not contemplate the platform as general-purpose block storage, and high-volume
automation from user accounts draws rate limits and restrictions. A user account uploading 600
files in a burst resembles what those defences target.

- Treat the pacing in §6 as **account safety**, not throughput tuning. Do not raise concurrency to
  "speed things up".
- Ship a working export path.
