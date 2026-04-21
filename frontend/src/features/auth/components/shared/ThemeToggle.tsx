import { motion } from 'framer-motion';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme } from '@features/settings/contexts/ThemeContext';
import './ThemeToggle.css';

export const ThemeToggle = () => {
  const { themeConfig, setThemeMode } = useTheme();
  const isDark = themeConfig.mode === 'dark';

  const toggleTheme = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  return (
    <motion.button
      className="theme-toggle-button"
      onClick={toggleTheme}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      data-testid="theme-toggle"
    >
      <motion.div
        className="theme-toggle-icon-container"
        animate={{
          rotate: isDark ? 180 : 0,
        }}
        transition={{
          duration: 0.5,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
        {isDark ? (
          <motion.div
            key="sun"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SunOutlined className="theme-toggle-icon" />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.2 }}
          >
            <MoonOutlined className="theme-toggle-icon" />
          </motion.div>
        )}
      </motion.div>
    </motion.button>
  );
};
