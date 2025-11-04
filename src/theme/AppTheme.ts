export const AppTheme = {
  gold: {
    base: '#f59e0b', // amber-500
    light: '#fbbf24', // amber-400 ~ yellow-500
    dark: '#b45309', // amber-700
    ring: 'rgba(245, 158, 11, 0.5)',
    glow: 'rgba(245, 158, 11, 0.15)',
  },
  textPrimary: '#f5efe3',
  textSecondary: 'rgba(255,255,255,0.75)',
  glass: {
    surface: 'rgba(255,255,255,0.06)',
    surfaceStrong: 'rgba(255,255,255,0.10)',
  },
} as const;

export type AppThemeType = typeof AppTheme;