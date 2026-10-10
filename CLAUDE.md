# FileHarbor — Agent Rules

FileHarbor is an Expo React Native app. Android is the first target. The app keeps files in the
user's Telegram **Saved Messages**. It uses `react-native-tdlib` on the device.

## 0. Before you start

- Read `TELEGRAM_STORAGE_TECHNICAL_SPEC.md`. On technical items, the spec has priority over this file.
- `Design.pen` gives all visual data. Open it only with the `pencil` MCP. It is encrypted. Do not
  use Read, Grep, or cat on it.
- Before you build a screen, get its frame with `pencil` (`Get`, `TakeScreenshot`).
- Before you use an Expo API, read the current SDK 57 docs with `expo-mcp`.

## 1. Prohibited

- Do not build a server, relay, or proxy. Do not use the Telegram Bot API.
- Do not write chunking, resume, `FLOOD_WAIT` backoff, DC migration, file-reference refresh, or
  SRP 2FA. TDLib does these.
- Do not encrypt uploads. Encryption is a format v2 decision (spec §1), not a flag.
- The caption is the only record of the folder tree: `fileharbor:1:{"path":[…],"name":"…"}`
  (spec §1). Do not keep the tree in a server, a manifest message, or local storage. Local
  tables are caches that a rescan rebuilds.
- After the first real upload, do not change the caption format. Add a new version, and keep the
  parser for each old version. A sent caption cannot be changed in bulk. There is no rollback.
- The app does not support the unlim-cloud web app or its captions (`dir--…--/dir`, gallery).
- Do not make more than one `tdlib-update` subscription. It is in `src/telegram/client.ts` only.
- Do not set upload concurrency above 4. This is account safety.
- Do not send a session string or the TDLib database off the device.
- Do not install a library that spec §2 does not list. Use `npx expo install`.
- Never install `react-native-nitro-sqlite`, `react-native-quick-crypto`,
  `react-native-worklets-core`, GramJS / `telegram`, or `expo-av`.
- Do not use Expo Go. TDLib needs a dev client: `npx expo prebuild`, then `npx expo run:android`.
- Do not build iOS on this machine.

`postinstall` must run `patch-package`. Without Patch 1 (spec §3.3), the build passes but
`TdLib` is `undefined` at runtime.

## 2. Layers

Imports go down only. An upward import is a defect.

| Layer | Path | Rules |
|---|---|---|
| Routes | `src/app/**` | Route files and `_layout.tsx` only. |
| UI | `src/components/fileHarbourComponent/**` | Props in, callbacks out. No logic. |
| Hooks | `src/hooks/**` | Screen state and handlers. No JSX. |
| Services | `src/telegram`, `format`, `media`, `transfer`, `index`, `storage` | Plain TypeScript. No React. |

**Screen file (`src/app/**/index.tsx`)**
- It holds the screen logic: state, effects, navigation, service calls, permission prompts,
  and loading, empty, and error states.
- It arranges components. It does not style. No `StyleSheet`, no hex, no icon sizes.
- Its root is `shared/Screen`. Do not use a bare `View` or `SafeAreaView` as the root.

**`_layout.tsx`**
- Navigation configuration only: Stack, NativeTabs, screen options, badges.
- No UI, no data, no logic.

**UI component**
- It can import: `react`, `react-native`, `expo-image`, `expo-video`, `@shopify/flash-list`,
  `react-native-reanimated`, `react-native-gesture-handler`, `lucide-react-native`,
  `src/constants/*`, `src/hooks/useColorScheme`.
- It must not import services, `expo-router` navigation, `expo-sqlite`, or TDLib.
- It must not request permissions or fetch data.
- It must render from static props alone.

**Hooks**
- Move screen logic to a hook when it is longer than ~80 lines or two screens use it.
- Make one hook for each data source. `useDownloads` reads TDLib `updateFile`.
  `useUploadQueue` reads the SQLite queue.

**Services**
- Only `src/telegram` knows TDLib. It has no app concepts (no "folder", no "gallery").
- `src/telegram/types.ts` holds TDLib shapes only. `src/types/domain.ts` holds app types.
- Map TDLib shapes to domain types only in `src/index/sync.ts`, `src/transfer/queue.ts`, and
  `src/telegram/auth.ts` (auth steps and errors only).
- Screens, hooks, and components use domain types only.

## 3. Components: reuse

- Before you write a component, read `shared/`. If a shared component is near, add a prop to it.
- Make one component for one job. There is one `Button.tsx`. There is no `PrimaryButton`,
  `SecondaryButton`, or `IconButton`.
- Do not make a wrapper that only sets props. Use `<ListRow …/>` for a folder row. Do not make
  `FolderRow.tsx`.
- Merge two components that differ only in colour, label, icon, padding, or alignment.
- If a prop gives two different render paths, make two components.
- If only one route uses an arrangement, keep it in that route file.
- Make display strings (for example, "146 items · 2.4 GB") in the screen or hook. Do not make
  them in a UI file.
- Make a feature folder only for a component that `shared/` plus props cannot do.
- Use one component for each `PascalCase.tsx` file.

**Do not build what Expo gives:**

| Item | Use |
|---|---|
| Top bar | Stack native header |
| Bottom bar | `NativeTabs` |
| Status bar | `expo-status-bar` |
| Bottom sheet | Route with `presentation: "formSheet"` |

Do not make TopBar, NavBar, Header, TabBar, BottomNav, or BottomSheet components. An in-screen
action bar that is not navigation (08 selection bar, viewer action row) is a component.

## 4. Folder structure

Make a file only when the build order (§8) needs it. Numbers are `Design.pen` frames.

```
FileHarbor/
├─ app.config.ts               the only config file (move app.json into it)
├─ patches/                    patch-package; Patch 1 is mandatory
├─ plugins/withForegroundService.js   dataSync service (spec §7)
├─ assets/icons/               Android drawables for NativeTabs only
├─ src/
│  ├─ app/
│  │  ├─ _layout.tsx           root Stack + providers
│  │  ├─ +not-found.tsx
│  │  ├─ (auth)/
│  │  │  ├─ _layout.tsx
│  │  │  ├─ phone/index.tsx    01
│  │  │  ├─ code/index.tsx     02
│  │  │  └─ password/index.tsx 03
│  │  ├─ (tabs)/
│  │  │  ├─ _layout.tsx        NativeTabs only
│  │  │  ├─ folders/
│  │  │  │  ├─ _layout.tsx
│  │  │  │  ├─ index.tsx       04 list, 05 empty
│  │  │  │  ├─ new/index.tsx   06 sheet
│  │  │  │  └─ [folderId]/
│  │  │  │     ├─ index.tsx    07 grid, 08 multi-select
│  │  │  │     └─ [messageId]/index.tsx   11 unsupported-file sheet
│  │  │  ├─ transfers/
│  │  │  │  ├─ _layout.tsx     Stack only
│  │  │  │  ├─ index.tsx       redirect to ./downloads
│  │  │  │  ├─ downloads/index.tsx   12, 14 selection
│  │  │  │  └─ uploads/index.tsx     13
│  │  │  └─ settings/
│  │  │     ├─ _layout.tsx
│  │  │     └─ index.tsx       15
│  │  └─ viewer/[folderId]/[messageId]/index.tsx   09 photo, 10 video (no tabs)
│  ├─ components/fileHarbourComponent/
│  │  ├─ shared/
│  │  │  ├─ Screen.tsx         root of every screen: safe area + background
│  │  │  ├─ Button.tsx         variant primary|secondary|destructive|ghost, size, label?,
│  │  │  │                     icon, iconPosition left|top, loading, disabled, fullWidth
│  │  │  ├─ InputField.tsx     label, leftSlot, rightSlot, secure, hint, error, keyboardType
│  │  │  ├─ ListRow.tsx        leading, title, subtitle, value, trailing
│  │  │  │                     chevron|switch|stepper|icon|checkbox|none, selected
│  │  │  ├─ SectionHeader.tsx  level section|sheet
│  │  │  ├─ SearchField.tsx    search icon, clear button (04); not InputField: no label
│  │  │  ├─ RowList.tsx        FlashList of card rows, header, pull to refresh
│  │  │  ├─ ButtonRow.tsx      equal-width buttons (06 Cancel / Create)
│  │  │  ├─ Banner.tsx         tone info|warn|danger|success
│  │  │  ├─ ProgressBar.tsx    tone accent|viewer, knob, onSeek (10 scrubber, 12/13 rows)
│  │  │  ├─ Checkbox.tsx
│  │  │  ├─ Pill.tsx
│  │  │  ├─ SegmentedControl.tsx
│  │  │  ├─ TitleBlock.tsx     icon?, title, body, action?, align left|center
│  │  │  ├─ SheetGrabber.tsx   Android only
│  │  │  ├─ Thumbnail.tsx      expo-image; recyclingKey is required
│  │  │  └─ Icon.tsx           lucide wrapper
│  │  ├─ auth/OtpCodeInput.tsx
│  │  ├─ gallery/
│  │  │  ├─ GalleryGrid.tsx    FlashList v2, numColumns 3
│  │  │  ├─ GridCell.tsx
│  │  │  └─ SelectionToolbar.tsx
│  │  ├─ viewer/
│  │  │  ├─ PhotoViewer.tsx    awesome-gallery + expo-image
│  │  │  ├─ VideoViewer.tsx    expo-video
│  │  │  ├─ ViewerFileMeta.tsx
│  │  │  ├─ ViewerFilmstrip.tsx
│  │  │  ├─ VideoScrubber.tsx  10 buffer line, seek bar, times
│  │  │  └─ ViewerActionRow.tsx
│  │  └─ transfers/
│  │     ├─ TransferRow.tsx    ListRow + ProgressBar
│  │     └─ UploadBatchCard.tsx   13 batch summary
│  ├─ constants/
│  │  ├─ Colors.ts             all colours
│  │  └─ Layout.ts             radius 12 / 8, padding 20, grid sizes
│  ├─ hooks/
│  │  ├─ useColorScheme.ts     returns { scheme, colors }
│  │  ├─ useAuthFlow.ts
│  │  ├─ useFolderList.ts
│  │  ├─ useFolderContents.ts
│  │  ├─ useSelection.ts       gallery 08 and transfers 14
│  │  ├─ useDownloads.ts       also gives the Downloads badge count
│  │  ├─ useUploadQueue.ts
│  │  └─ useMediaPermissions.ts
│  ├─ telegram/
│  │  ├─ client.ts             startTdLib, the one tdlib-update subscription, send correlation
│  │  ├─ auth.ts
│  │  ├─ upload.ts
│  │  ├─ download.ts
│  │  ├─ search.ts
│  │  ├─ savedMessages.ts
│  │  └─ types.ts
│  ├─ format/caption.ts        caption parse + serialise
│  ├─ format/units.ts          size and count display text ("2.4 GB", "3 items")
│  ├─ media/  picker.ts  thumbnail.ts  minithumbnail.ts  hash.ts
│  ├─ transfer/  queue.ts  foregroundService.ts
│  ├─ index/  db.ts  sync.ts
│  ├─ storage/  prefs.ts (mmkv)  secrets.ts (secure-store)
│  └─ types/domain.ts
└─ __tests__/  format/caption.test.ts  screens/  components/
```

## 5. Routes and navigation

- A screen is `<segment>/index.tsx`. Do not use `<segment>.tsx`.
- Each route folder is a screen or a dynamic param. Do not add an empty static segment.
- Use `(group)` only when the segment must not show in the URL.
- Tabs: `NativeTabs` from `expo-router/unstable-native-tabs`. Plain `Tabs` is the fallback.
- Tab order: Folders, Downloads, Settings. The Trigger `name` is the route folder name.
- The Downloads tab has a `Badge` with the active transfer count. Hide it at zero.
- The tabs layout has `headerShown: false`. Each tab has its own Stack with the header.
- Use `anchor` in `unstable_settings`. Do not use `initialRouteName`.

| Screen | Header options |
|---|---|
| 01 | `headerShown: false` |
| 02, 03 | back only, `title: ""` |
| 04 | `title: "Folders"`, `headerLargeTitle`, `headerRight` new-folder Button |
| 07 | `title` = folder name, `headerRight` overflow |
| 08, 14 | Set from screen state: `title: "N selected"`, `headerLeft` close, `headerRight` actions |
| 09, 10 | `headerTransparent`, `headerStyle` and `headerTintColor` from `viewer*` tokens, `title: "3 of 148"` |
| 06, 11 | `presentation: "formSheet"`, `sheetAllowedDetents`, `sheetCornerRadius`, `sheetGrabberVisible: true` |

Android form sheets show no header and no grabber. On sheets, put the title in the content. On
Android, add `shared/SheetGrabber`.

## 6. Design

- A canvas frame is a state of a component, not a file. `Button / Primary` and
  `Button / Secondary` are one `Button`. `Transfer Row` and `Transfer Row — Selected` are one
  `TransferRow`.
- `Chrome / …` frames show Expo chrome. Set them with options. Accept native differences.

### Colour

- Keep all colours in `src/constants/Colors.ts`, with `light` and `dark` keys.
- Get colours only with `const { colors } = useColorScheme()` (`src/hooks/useColorScheme.ts`).
- Do not write a colour literal in any other file: no hex, no `rgba()`, no `"white"` or `"black"`.
- Put colour in the `style` array from `colors`. Put only layout in `StyleSheet.create`.
- If you need a new colour, add a token. Do not test `scheme` in a component.
- Header colours, tab tint, and `ThemeProvider` also come from `Colors`.
- Keep `userInterfaceStyle: "automatic"`.
- Show `flood_wait` with `warn` and `warnSoft`. Do not use `danger`. Red makes users retry.
- Replace the template files `src/components/Themed.tsx` and `src/components/useColorScheme.ts`.

| Token | Light | Dark |
|---|---|---|
| `bg` | `#FFFFFF` | `#1B1B1A` |
| `bgMuted` | `#F7F7F5` | `#242423` |
| `bgSunken` | `#F1F1EF` | `#151514` |
| `border` | `#E9E9E6` | `#2F2F2D` |
| `borderStrong` | `#DBDBD7` | `#3D3D3A` |
| `textPrimary` | `#191918` | `#F1F1EF` |
| `textSecondary` | `#6F6F6B` | `#A3A3A0` |
| `textTertiary` | `#9C9C98` | `#74746F` |
| `accent` | `#2383E2` | `#4C9AEA` |
| `accentSoft` | `#EDF4FD` | `#16263A` |
| `success` | `#2E7D4F` | `#4CAF75` |
| `warn` | `#B26B00` | `#D9933A` |
| `warnSoft` | `#FBF3E7` | `#30250F` |
| `danger` | `#D1453B` | `#E5574D` |

Light values come from `Design.pen`. Dark values are not in the design. Check their contrast on
the first dark screens. Change them only in `Colors.ts`.

Viewer tokens are the same in both schemes: `viewerBg #0E0E0E`, `viewerSurface #1A1A1A`,
`viewerBorder #2A2A2A`, `viewerText #F5F5F5`, `viewerTextSecondary #A3A3A0`.

### Typography

- Use the platform default font. Do not set `fontFamily`. Do not load fonts. Do not install Inter.
- Set `fontSize` and `fontWeight` in a component only for hierarchy. Use the values in the design.
- Remove the `expo-font` plugin when you move to `app.config.ts`.

### Icons

- Use only `lucide-react-native`, through `shared/Icon.tsx`. No SF Symbols, SVG files, or emoji.
- Exception: `NativeTabs` icons. Use Android drawables in `assets/icons/` and `sf` for iOS.

## 7. Test each screen

Do these steps on each screen when you finish it. Do not wait for a batch.

1. Run `npx tsc --noEmit` and `npm run lint`. Both must pass. Do not add `any`.
2. Write `__tests__/screens/<route>.test.tsx`. Mock the services. Assert the key text and the
   states: loaded, empty, selection, error, rate-limited. Add `jest-expo` and
   `@testing-library/react-native` with the first test.
3. Compare the screen to its `Design.pen` frame in light and in dark.
   - UI only: use `native-sim up --public`. TDLib is not there, so each screen must render from
     mock data.
   - Full simulator: read `.claude/skills/native-sim/SKILL.md` first and follow it. The first
     build can be slow. The command pushes the repo to GitHub, so get user approval before you
     run it.
   - TDLib, media library, or foreground service: use an Android dev client on a real device.
4. Audit the boundaries:
   - no upward import;
   - no colour literal outside `Colors.ts`;
   - no `fontFamily`;
   - only lucide icons;
   - one `tdlib-update` listener;
   - no custom top bar, tab bar, status bar, or sheet container;
   - `recyclingKey` on each `expo-image` in a list or grid.
5. Audit reuse. Give each new feature-folder component a one-line reason it is not `shared/` plus
   props. Apply all §3 rules.

`caption.ts` needs round-trip tests. Before the first real upload, the user approves the caption
format. After that upload, the format is fixed (§1).

## 8. Build order

Follow spec §11:

1. Apply Patch 1. On a real device, run `startTdLib`, log in, and see `tdlib-update` events.
2. Caption format: parse, serialise, round-trip tests, and the sync report.
3. Auth state machine. A relaunch must not ask for login again.
4. Read path: list, thumbnails, download. Check the SHA-256 of the 51.8 MB video.
5. Write path: upload one file. Check its caption in Telegram, and its folder after a fresh sync.
6. Persistent upload queue. Kill the app during a batch to test it.
7. Upload 600 files (the user uploads the old web app files again). Measure flood behaviour.
   Then decide on album batching.
8. Foreground service, gallery polish, folder operations, trash.

Do step 2 before step 5. You can build UI on mock data during steps 1–4. Do not connect real
writes before step 5.

Spec §12 items are not verified. Verify each on a device before you use it.

## 9. Code style

- TypeScript strict. Give exported service functions explicit return types.
- Use named exports. Use a default export only in route files.
- File names: `camelCase.ts` for services and hooks, `PascalCase.tsx` for components, lowercase
  for route folders.
- Import from `src/` with `@/` (for example, `import { Colors } from "@/constants/Colors"`).
  Do not use relative paths (`./`, `../`) across folders. The aliases are in `tsconfig.json`:
  `@/*` → `src/*`, `@components/*` → `src/components/*`, `@assets/*` → `assets/*`.
- Exception: `app.config.ts` runs in plain Node. It cannot use `@/` or import any `src/` file.
  It can have the native splash and adaptive-icon colours as literals. Keep them equal to
  `Colors.light.bg` and `Colors.dark.bg`.
- Comments tell why. Add a spec section reference to the caption format, the send correlation,
  and each pacing constant.
- Show errors as UI states. Do not throw across the service boundary.
- Do not commit `console.log`.
