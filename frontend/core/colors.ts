export const pacificDesertSunset = {
  brand: {
    sunGlow: '#F59E0B',
    oceanBreeze: '#2563EB',
    sunsetCoral: '#E0527E',
    pacificDeep: '#003F5C',
    skyPeach: '#FFD380',
  },
  semantic: {
    bullish: '#1BC47D',
    bearish: '#FF4D5A',
    neutral: '#F59E0B',
    warning: '#F59E0B',
  },
  primaryRamp: {
    100: '#F5F7FA',
    200: '#EEF1F6',
    300: '#FFD380',
    400: '#FF8531',
    500: '#F59E0B',
    600: '#FF8531',
    700: '#FF6361',
  },
  light: {
    background: '#F5F7FA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#526580',
    border: '#CBD5E1',
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
