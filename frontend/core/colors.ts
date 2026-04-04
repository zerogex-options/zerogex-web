export const pacificDesertSunset = {
  brand: {
    sunGlow: '#FFA600',
    oceanBreeze: '#8A508F',
    sunsetCoral: '#BC5090',
    pacificDeep: '#003F5C',
    skyPeach: '#FFD380',
  },
  semantic: {
    bullish: '#1BC47D',
    bearish: '#FF4D5A',
    neutral: '#FFA600',
    warning: '#FFA600',
  },
  primaryRamp: {
    100: '#FFF6ED',
    200: '#FFF1E6',
    300: '#FFD380',
    400: '#FF8531',
    500: '#FFA600',
    600: '#FF8531',
    700: '#FF6361',
  },
  light: {
    background: '#FFF6ED',
    surface: '#FFF1E6',
    surfaceElevated: '#FFFFFF',
    textPrimary: '#2C4875',
    textSecondary: '#8A508F',
    border: '#E8D5C4',
  },
  dark: {
    background: '#00202E',
    surface: '#001A26',
    surfaceElevated: '#003F5C',
    textPrimary: '#FFF1E6',
    textSecondary: '#D1B8A6',
    border: 'rgba(255, 211, 128, 0.16)',
  },
} as const;

export const colors = {
  bullish: pacificDesertSunset.semantic.bullish,
  bearish: pacificDesertSunset.semantic.bearish,
  neutral: pacificDesertSunset.semantic.neutral,
  warning: pacificDesertSunset.semantic.warning,
  primary: pacificDesertSunset.brand.sunGlow,
  accent: pacificDesertSunset.brand.oceanBreeze,
  coral: pacificDesertSunset.brand.sunsetCoral,

  dark: pacificDesertSunset.light.textPrimary,
  light: pacificDesertSunset.dark.textPrimary,
  muted: pacificDesertSunset.dark.textSecondary,
  cardDark: pacificDesertSunset.dark.surface,
  bgDark: pacificDesertSunset.dark.background,
  cardLight: pacificDesertSunset.light.surface,
  bgLight: pacificDesertSunset.light.background,

  borderDark: pacificDesertSunset.dark.border,
  borderLight: pacificDesertSunset.light.border,
};
