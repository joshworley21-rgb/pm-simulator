import { Platform } from 'react-native';

/**
 * Parliamentary palette.
 * Bright parchment, white paper, Commons green and restrained brass detailing.
 * Red is reserved for danger and official stamps, not everyday accents.
 */
export const colors = {
  bg: '#F8F6F0',
  bgElevated: '#FFFEFA',
  card: '#FFFEFA',
  cardAlt: '#F2F0E9',
  cardBorder: '#BDBBB2',
  cardBorderLight: '#D8D6CD',
  ink: '#202620',
  text: '#252B26',
  textOnPaper: '#414841',
  muted: '#5E675F',
  faint: '#747B74',
  accent: '#244A37',
  accentDeep: '#183326',
  accentSoft: '#E8EDE7',
  gold: '#8A6B2E',
  leather: '#34473A',
  stamp: '#9E2B20',
  danger: '#9E2B20',
  warning: '#8A5A0B',
  success: '#2F6B44',
  onAccent: '#FFFFFF',
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
export const radius = { sm: 0, md: 0, lg: 0, pill: 0 };
export const font = { h1: 26, h2: 20, h3: 16, body: 14, small: 12, tiny: 11 };
