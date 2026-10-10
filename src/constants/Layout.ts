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
  hairline: 1,
} as const;
