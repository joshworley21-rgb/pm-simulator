import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#0e1526',
  card: '#1b2742',
  cardBorder: '#2b3a5e',
  text: '#e8edf7',
  muted: '#8fa1c3',
  accent: '#4f8cff',
  accentSoft: '#24365a',
  danger: '#ff5d5d',
  success: '#3ddc84',
};

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
