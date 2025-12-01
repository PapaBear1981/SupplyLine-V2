export type ThemeMode = 'light' | 'dark';

export type ColorTheme = 'blue' | 'green' | 'purple' | 'orange' | 'red';

export interface ThemeConfig {
  mode: ThemeMode;
  colorTheme: ColorTheme;
}

export interface ThemeContextType {
  themeConfig: ThemeConfig;
  setThemeMode: (mode: ThemeMode) => void;
  setColorTheme: (theme: ColorTheme) => void;
}

export const COLOR_THEMES: Record<ColorTheme, { primary: string; secondary: string; name: string }> = {
  blue: {
    primary: '#1890ff',
    secondary: '#667eea',
    name: 'Ocean Blue',
  },
  green: {
    primary: '#52c41a',
    secondary: '#36cfc9',
    name: 'Fresh Green',
  },
  purple: {
    primary: '#722ed1',
    secondary: '#b37feb',
    name: 'Royal Purple',
  },
  orange: {
    primary: '#fa8c16',
    secondary: '#ffc53d',
    name: 'Vibrant Orange',
  },
  red: {
    primary: '#f5222d',
    secondary: '#ff7875',
    name: 'Bold Red',
  },
};
