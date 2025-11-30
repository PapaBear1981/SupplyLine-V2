import { List, Card, Switch, Space, Tag } from 'antd-mobile';
import { CheckOutline } from 'antd-mobile-icons';
import {
  BulbOutlined,
  BulbFilled,
} from '@ant-design/icons';
import { useTheme } from '../../contexts/ThemeContext';
import { COLOR_THEMES } from '../../types/theme';
import type { ColorTheme } from '../../types/theme';
import './MobileSettings.css';

export const MobileSettings = () => {
  const { themeConfig, setThemeMode, setColorTheme } = useTheme();

  const colorThemeOptions = (Object.keys(COLOR_THEMES) as ColorTheme[]).map((key) => ({
    label: COLOR_THEMES[key].name,
    value: key,
    color: COLOR_THEMES[key].primary,
  }));

  return (
    <div className="mobile-settings">
      {/* Header */}
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Customize your SupplyLine experience</p>
      </div>

      {/* Appearance Card */}
      <Card title="Appearance" className="settings-card">
        <List>
          {/* Theme Mode */}
          <List.Item
            prefix={
              themeConfig.mode === 'light' ? (
                <BulbOutlined style={{ fontSize: 20, color: '#faad14' }} />
              ) : (
                <BulbFilled style={{ fontSize: 20, color: '#8c8c8c' }} />
              )
            }
            extra={
              <Switch
                checked={themeConfig.mode === 'dark'}
                onChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
              />
            }
            description={
              themeConfig.mode === 'light'
                ? 'Classic bright interface'
                : 'Easy on the eyes'
            }
          >
            <div className="list-item-title">
              {themeConfig.mode === 'light' ? 'Light Mode' : 'Dark Mode'}
            </div>
          </List.Item>
        </List>
      </Card>

      {/* Color Theme Card */}
      <Card title="Color Theme" className="settings-card">
        <div className="color-theme-section">
          <p className="section-description">
            Select your preferred color scheme
          </p>
          <div className="color-theme-grid">
            {colorThemeOptions.map((option) => (
              <div
                key={option.value}
                className={`color-theme-item ${
                  themeConfig.colorTheme === option.value ? 'selected' : ''
                }`}
                onClick={() => setColorTheme(option.value)}
              >
                <div
                  className="color-circle"
                  style={{ backgroundColor: option.color }}
                >
                  {themeConfig.colorTheme === option.value && (
                    <CheckOutline style={{ fontSize: 20, color: 'white' }} />
                  )}
                </div>
                <div className="color-name">{option.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Theme Preview Card */}
      <Card title="Preview" className="settings-card">
        <div className="preview-section">
          <Space direction="vertical" style={{ width: '100%' }} block>
            <div className="preview-info">
              <span className="preview-label">Current Configuration:</span>
              <Space wrap style={{ marginTop: 8 }}>
                <Tag color="primary">
                  {COLOR_THEMES[themeConfig.colorTheme].name}
                </Tag>
                <Tag color="primary">
                  {themeConfig.mode === 'light' ? 'Light Mode' : 'Dark Mode'}
                </Tag>
              </Space>
            </div>

            <div className="preview-divider" />

            <div className="preview-info">
              <span className="preview-label">Primary Color Sample:</span>
            </div>

            <div
              className="color-preview-box"
              style={{
                backgroundColor: COLOR_THEMES[themeConfig.colorTheme].primary,
              }}
            >
              <div className="preview-box-content">
                <div className="preview-box-title">Primary Color Preview</div>
                <div className="preview-box-text">
                  This shows how your selected theme color looks on UI elements
                </div>
              </div>
            </div>
          </Space>
        </div>
      </Card>
    </div>
  );
};
