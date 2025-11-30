import { Card, Typography, Space, Divider, Row, Col, theme, Button, Tag } from 'antd';
import { BulbOutlined, BulbFilled, CheckCircleFilled } from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import { COLOR_THEMES } from '../types/theme';
import type { ColorTheme } from '../types/theme';
import { MobileSettings } from '../components/mobile';
import { useIsMobile } from '@shared/hooks/useMobile';

const { Title, Text, Paragraph } = Typography;
const { useToken } = theme;

export const SettingsPage = () => {
  const isMobile = useIsMobile();

  // Render mobile version if on mobile device
  if (isMobile) {
    return <MobileSettings />;
  }

  const { themeConfig, setThemeMode, setColorTheme } = useTheme();
  const { token } = useToken();

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>Settings</Title>
          <Paragraph type="secondary">
            Customize your SupplyLine experience
          </Paragraph>
        </div>

        <Card
          title={
            <Space>
              <BulbOutlined />
              <span>Appearance</span>
            </Space>
          }
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Theme Mode Section */}
            <div>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 16 }}>Theme Mode</Text>
                <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 16 }}>
                  Choose between light and dark mode
                </Paragraph>
              </div>
              <Row gutter={16}>
                <Col xs={24} sm={12} md={8}>
                  <Card
                    hoverable
                    style={{
                      border: themeConfig.mode === 'light' ? `2px solid ${token.colorPrimary}` : `1px solid ${token.colorBorder}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => setThemeMode('light')}
                  >
                    <Space direction="vertical" align="center" style={{ width: '100%' }}>
                      <BulbOutlined style={{ fontSize: 32, color: '#faad14' }} />
                      <Text strong>Light Mode</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Classic bright interface
                      </Text>
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Card
                    hoverable
                    style={{
                      border: themeConfig.mode === 'dark' ? `2px solid ${token.colorPrimary}` : `1px solid ${token.colorBorder}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => setThemeMode('dark')}
                  >
                    <Space direction="vertical" align="center" style={{ width: '100%' }}>
                      <BulbFilled style={{ fontSize: 32, color: '#8c8c8c' }} />
                      <Text strong>Dark Mode</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Easy on the eyes
                      </Text>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </div>

            <Divider />

            {/* Color Theme Section */}
            <div>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 16 }}>Color Theme</Text>
                <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 16 }}>
                  Select your preferred color scheme
                </Paragraph>
              </div>
              <Row gutter={[16, 16]}>
                {(Object.keys(COLOR_THEMES) as ColorTheme[]).map((colorTheme) => (
                  <Col xs={12} sm={8} md={6} lg={4} key={colorTheme}>
                    <Card
                      hoverable
                      style={{
                        border: themeConfig.colorTheme === colorTheme ? `2px solid ${token.colorPrimary}` : `1px solid ${token.colorBorder}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => setColorTheme(colorTheme)}
                      bodyStyle={{ padding: 16 }}
                    >
                      <Space direction="vertical" align="center" style={{ width: '100%' }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            backgroundColor: COLOR_THEMES[colorTheme].primary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {themeConfig.colorTheme === colorTheme && (
                            <CheckCircleFilled style={{ fontSize: 24, color: 'white' }} />
                          )}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <Text strong style={{ fontSize: 14 }}>
                            {COLOR_THEMES[colorTheme].name}
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          </Space>
        </Card>

        <Card title="Theme Preview">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">Current Configuration:</Text>
              <div style={{ marginTop: 8 }}>
                <Space size="small" wrap>
                  <Tag color={token.colorPrimary} style={{ fontSize: 14, padding: '4px 12px' }}>
                    {COLOR_THEMES[themeConfig.colorTheme].name}
                  </Tag>
                  <Tag color={token.colorPrimary} style={{ fontSize: 14, padding: '4px 12px' }}>
                    {themeConfig.mode === 'light' ? 'Light Mode' : 'Dark Mode'}
                  </Tag>
                </Space>
              </div>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div>
              <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
                Component Preview:
              </Text>
              <Space size="middle" wrap>
                <Button type="primary">Primary Button</Button>
                <Button>Default Button</Button>
                <Button type="dashed">Dashed Button</Button>
                <Button type="link">Link Button</Button>
              </Space>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: token.borderRadius,
                background: token.colorPrimary,
                color: 'white',
              }}
            >
              <Space direction="vertical" size="small">
                <Text strong style={{ color: 'white', fontSize: 16 }}>
                  Primary Color Preview
                </Text>
                <Text style={{ color: 'white', opacity: 0.9 }}>
                  This shows how your selected theme color looks on different UI elements
                </Text>
              </Space>
            </div>
          </Space>
        </Card>
      </Space>
    </div>
  );
};
