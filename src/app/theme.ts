import { Platform, StyleSheet } from 'react-native';

/** Shared paper-and-ink palette. */
export const colors = {
  bg: '#F8FAFC',
  bgElevated: '#F1F5F9',
  card: '#FFFFFF',
  cardBorder: '#CBD5E1',
  text: '#1E293B',
  muted: '#64748B',
  accent: '#334155',
  accentSoft: '#E2E8F0',
  danger: '#991B1B',
  warning: '#92400E',
  success: '#166534',
};

export const headingFontFamily = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
})!;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const font = { h1: 28, h2: 20, h3: 16, body: 14, small: 12, tiny: 11 };

/** Legacy global styles (kept for Menu/Create screens). */
export const g = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 6, lineHeight: 21 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
  },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnGhostText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
