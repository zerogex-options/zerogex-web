export const pacificDesertSunset = {
  brand: {
    sunGlow: '#FFB347',
    oceanBreeze: '#2EC4B6',
    sunsetCoral: '#FF6B4A',
    pacificDeep: '#1D3557',
    skyPeach: '#FFD6A5',
  },
  semantic: {
    bullish: '#2FBF71',
    bearish: '#FF5A5F',
    neutral: '#C9A27E',
    warning: '#FFB703',
  },
  primaryRamp: {
    100: '#FFF4D6',
    200: '#FFE0A3',
    300: '#FFD070',
    400: '#FFC04D',
    500: '#FFB347',
    600: '#E89A2E',
    700: '#C87F1E',
  },
  light: {
    background: '#F0EEF0',
    surface: '#F7F5F7',
    surfaceElevated: '#FFFFFF',
    textPrimary: '#1A1618',
    textSecondary: '#6B636A',
    border: '#DDD7DD',
  },
  dark: {
    background: '#0F1A24',
    surface: '#162635',
    surfaceElevated: '#1B3143',
    textPrimary: '#F4EDE4',
    textSecondary: '#9FB3C8',
    border: '#1F3A4A',
  },
} as const;

// Backwards-compatible color aliases used throughout existing components.
export const colors = {
  // semantic
  bullish: pacificDesertSunset.semantic.bullish,
  bearish: pacificDesertSunset.semantic.bearish,
  neutral: pacificDesertSunset.semantic.neutral,
  warning: pacificDesertSunset.semantic.warning,
  primary: pacificDesertSunset.brand.sunGlow,
  accent: pacificDesertSunset.brand.oceanBreeze,
  coral: pacificDesertSunset.brand.sunsetCoral,

  // legacy keys
  dark: pacificDesertSunset.light.textPrimary,
  light: pacificDesertSunset.dark.textPrimary,
  muted: pacificDesertSunset.dark.textSecondary,
  cardDark: pacificDesertSunset.dark.surface,
  bgDark: pacificDesertSunset.dark.background,
  cardLight: pacificDesertSunset.light.surface,
  bgLight: pacificDesertSunset.light.background,

  // utility
  borderDark: pacificDesertSunset.dark.border,
  borderLight: pacificDesertSunset.light.border,
};
