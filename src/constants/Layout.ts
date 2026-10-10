// Spacing and size values from Design.pen. Components read these; screens do not style.
export const Layout = {
  pad: 20,
  radius: { card: 12, banner: 10, sm: 8, mark: 15 },
  control: { height: 52, buttonHeight: 50, buttonHeightCompact: 48 },
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
  hairline: 1,
} as const;
