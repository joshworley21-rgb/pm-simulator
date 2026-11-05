import { Platform, StyleSheet } from 'react-native';

/**
 * "Red Box" archival palette.
 * Aged cream paper, ink black, ox-blood stamps and gold file fasteners.
 */
export const colors = {
  bg: '#1B1512',
  bgElevated: '#2A201A',
  card: '#F5EFE3',
  cardAlt: '#EBE2CF',
  cardBorder: '#3B2D24',
  cardBorderLight: '#D9CEB8',
  ink: '#17110D',
  text: '#201812',
  textOnPaper: '#33261A',
  muted: '#6D5C48',
  faint: '#8C7A64',
  accent: '#8C1C13',
  accentDeep: '#5C110A',
  accentSoft: '#E3C9A8',
  gold: '#B08D3B',
  leather: '#4A2C1C',
  stamp: '#9E2B20',
  danger: '#8C1C13',
  warning: '#8A5A0B',
  success: '#2E5E34',
};

export const headingFontFamily = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
})!;

/** Typewriter / file-label voice. Falls back gracefully to a system serif. */
export const fileFontFamily = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'Menlo',
})!;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 2, md: 4, lg: 6, pill: 3 };
export const font = { h1: 26, h2: 20, h3: 16, body: 14, small: 12, tiny: 10 };

/** Legacy global styles (kept for Menu/Create screens). */
export const g = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  title: { color: colors.card, fontSize: 30, fontWeight: '700' },
  subtitle: { color: colors.faint, fontSize: 13, marginTop: 6, lineHeight: 19 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 16,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.faint, fontSize: 13, lineHeight: 19 },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  btnText: { color: colors.card, fontSize: 15, fontWeight: '700' },
  btnGhostText: { color: colors.faint, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
