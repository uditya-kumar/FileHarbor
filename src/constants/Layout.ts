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
  // 10 scrubber; the 12 and 13 transfer bars use the same track.
  progress: { track: 3, radius: 2, knob: 12, hitSlop: 12 },
  hairline: 1,
} as const;
