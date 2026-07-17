// Design system — dark UI with violet primary, modeled on the reference mock:
// near-black surfaces, big radii, pill buttons, tinted stat tiles, purple gradient hero.

export const colors = {
  bg: '#0A0A0E',
  surface: '#141419',
  surfaceAlt: '#1D1D25',
  border: '#26262F',

  primary: '#8B5CF6',
  primaryLight: '#A78BFA',
  primaryDark: '#6D3EE8',
  gradientA: '#A05CFF',
  gradientB: '#7A3BFF',

  orange: '#FB923C',
  amber: '#FBBF24',
  green: '#34D399',
  blue: '#38BDF8',
  pink: '#F472B6',

  warn: '#FBBF24',
  danger: '#F87171',
  good: '#34D399',
  accent: '#38BDF8',

  text: '#F5F5F7',
  textDim: '#8E8E99',

  // translucent tile tints (like the Daily Plan grid in the mock)
  tintOrange: 'rgba(251,146,60,0.12)',
  tintPurple: 'rgba(139,92,246,0.14)',
  tintGreen: 'rgba(52,211,153,0.10)',
  tintBlue: 'rgba(56,189,248,0.10)',
};

export const spacing = (n: number) => n * 8;

export const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const font = {
  title: 24,
  h1: 19,
  h2: 16,
  body: 14.5,
  small: 12,
  big: 40,
};

/** App renders inside a phone-width frame, like a mobile app. */
export const PHONE_MAX_WIDTH = 430;
