// Spacing and size values from Design.pen. Components read these; screens do not style.
export const Layout = {
  pad: 20,
  radius: { card: 12, banner: 10, sm: 8, mark: 15, pill: 26 },
  control: {
    height: 52,
    buttonHeight: 50,
    buttonHeightCompact: 48,
    searchHeight: 48,
  },
  section: { gap: 26, headingGap: 9 },
  // 08: the gap from the close icon to "N selected". The Android header has none of its own.
  header: { leadingGap: 22 },
  screen: {
    topBelowHeader: 14,
    topNoHeader: 40,
    footerBottom: 28,
    footerInsetExtra: 12,
    footerGap: 14,
    footerActionGap: 16,
  },
  // 04: rows on a muted page, 10 apart; a 40 icon tile in each row.
  list: { top: 14, gap: 10, rowPad: 14, rowGap: 14, tile: 40, textGap: 3 },
  // 05: a centred message in the free space.
  empty: { padX: 40, gap: 16, copyGap: 7, mark: 72 },
  // 06: form sheet content.
  sheet: {
    radius: 18,
    gap: 17,
    top: 10,
    grabberWidth: 38,
    grabberHeight: 4,
    actionGap: 10,
    // 11: the file row, a muted tile with no card.
    fileTile: 46,
    fileIcon: 22,
    fileGap: 12,
  },
  // 07: a 3-column grid, 6 apart, inside the 20 page padding.
  grid: {
    columns: 3,
    gap: 6,
    top: 12,
    radius: 8,
    badgeInset: 7,
    badgeRadius: 5,
    selectedRing: 3,
  },
  // 08 grid check and 14 row check: an accent circle with a tick.
  check: { sm: 22, smTick: 12, smRing: 2, lg: 38, lgTick: 19 },
  // 08 bottom action bar.
  actionBar: { padTop: 10, padX: 16, padBottom: 14, gap: 8, rowGap: 10 },
  // 07: the upload button under the grid, at the end of the row, with an accent shadow.
  uploadBar: { padTop: 10, padBottom: 12, shadowY: 4, shadowBlur: 14 },
  // 09 and 10: the bottom bar over the photo or video.
  viewer: {
    barTop: 14,
    barBottom: 26,
    barGap: 18,
    captionGap: 3,
    thumb: 40,
    thumbActive: 46,
    thumbRadius: 7,
    thumbGap: 5,
    thumbRing: 2,
    actionsPadX: 26,
    actionIcon: 21,
    actionGap: 6,
    controlsPadX: 20,
    controlsGap: 16,
    bufferIcon: 13,
    bufferGap: 7,
    playButton: 66,
    playIcon: 26,
    placeholderIcon: 44,
  },
  // 12–14: the Downloads / Uploads switch at the top of the page.
  segmented: { top: 14, height: 34, pad: 3, gap: 2, radius: 9, itemRadius: 7 },
  // 12–14 transfer row: a 38 tile, the text, and a 36 round button.
  transfer: { tile: 38, tileIcon: 16, gap: 12, action: 36, actionIcon: 16 },
  // 10 scrubber.
  progress: { track: 3, radius: 2, knob: 12, hitSlop: 12 },
  hairline: 1,
} as const;
