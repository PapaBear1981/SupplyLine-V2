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

export const COLOR_THEMES: Record<ColorTheme, { primary: string; name: string }> = {
  blue: {
    primary: '#1890ff',
    name: 'Ocean Blue',
  },
  green: {
    primary: '#52c41a',
    name: 'Fresh Green',
  },
  purple: {
    primary: '#722ed1',
    name: 'Royal Purple',
  },
  orange: {
    primary: '#fa8c16',
    name: 'Vibrant Orange',
  },
  red: {
    primary: '#f5222d',
    name: 'Bold Red',
  },
};
