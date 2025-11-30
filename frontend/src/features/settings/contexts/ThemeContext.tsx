import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { ThemeConfig, ThemeContextType, ThemeMode, ColorTheme } from '../types/theme';

const THEME_STORAGE_KEY = 'supplyline-theme-config';

const defaultThemeConfig: ThemeConfig = {
  mode: 'light',
  colorTheme: 'blue',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return defaultThemeConfig;
      }
    }
    return defaultThemeConfig;
  });

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeConfig));

    // Apply dark mode class to document for antd-mobile theming
    if (themeConfig.mode === 'dark') {
      document.documentElement.classList.add('adm-theme-dark');
      document.documentElement.setAttribute('data-prefers-color-scheme', 'dark');
    } else {
      document.documentElement.classList.remove('adm-theme-dark');
      document.documentElement.setAttribute('data-prefers-color-scheme', 'light');
    }
  }, [themeConfig]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeConfig((prev) => ({ ...prev, mode }));
  };

  const setColorTheme = (colorTheme: ColorTheme) => {
    setThemeConfig((prev) => ({ ...prev, colorTheme }));
  };

  return (
    <ThemeContext.Provider
      value={{
        themeConfig,
        setThemeMode,
        setColorTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
