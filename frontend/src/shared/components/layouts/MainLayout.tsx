import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@features/settings/contexts/ThemeContext';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Typography,
  theme,
} from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { logout } from '@features/auth/slices/authSlice';
import { useLogoutMutation } from '@features/auth/services/authApi';
import { socketService } from '@services/socket';
import { getMenuItems } from '@shared/constants/navigation';
import { ROUTES } from '@shared/constants/routes';
import { useActivityTracker } from '@shared/hooks/useActivityTracker';
import { SessionExpiryWarning } from '@shared/components/SessionExpiryWarning';
import { AIAssistant } from '@features/ai/components/AIAssistant';
import { ActiveWarehouseSelect } from '@features/warehouses/components/activeWarehouse/ActiveWarehouseSelect';
import { RequireActiveWarehouseGate } from '@features/warehouses/components/activeWarehouse/RequireActiveWarehouseGate';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Compute which submenus should be open at initial render so that child
  // nav items (e.g. nav-tool-history) are visible without a user click.
  // `defaultOpenKeys` only affects the first render, so useState with a
  // lazy initializer is the right tool — it captures the mount-time pathname.
  const [defaultOpenSubmenus] = useState<string[]>(() => {
    const keys: string[] = [];
    const toolRoutes: string[] = [ROUTES.TOOLS, ROUTES.TOOL_CHECKOUT, ROUTES.TOOL_HISTORY];
    const chemRoutes: string[] = [ROUTES.CHEMICALS, ROUTES.CHEMICAL_FORECAST];
    if (toolRoutes.includes(location.pathname)) keys.push('tools-group');
    if (chemRoutes.some((r) => location.pathname.startsWith(r))) keys.push(ROUTES.CHEMICALS);
    return keys;
  });
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [logoutApi] = useLogoutMutation();
  const { themeConfig } = useTheme();
  const isDark = themeConfig.mode === 'dark';

  // Track user activity to prevent premature logout
  useActivityTracker();

  // Memoize menu items based on user permissions
  const menuItems = useMemo(() => {
    const isAdmin = user?.is_admin || false;
    const permissions = user?.permissions || [];
    return getMenuItems(isAdmin, permissions);
  }, [user?.is_admin, user?.permissions]);

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const handleMenuClick = (e: { key: string }) => {
    if (e.key.startsWith('/')) navigate(e.key);
  };

  const handleLogout = async () => {
    try {
      await logoutApi().unwrap();
    } catch {
      // Ignore logout errors - still clear local state
    } finally {
      // Disconnect WebSocket before clearing auth state
      socketService.disconnect();
      dispatch(logout());
      navigate(ROUTES.LOGIN);
    }
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: <span data-testid="user-menu-profile">Profile</span>,
      onClick: () => navigate(ROUTES.PROFILE),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: <span data-testid="user-menu-settings">Settings</span>,
      onClick: () => navigate(ROUTES.SETTINGS),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: <span data-testid="user-menu-logout">Logout</span>,
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <>
      <SessionExpiryWarning />
      <AIAssistant />
      <RequireActiveWarehouseGate />
      <Layout style={{ minHeight: '100vh' }} data-testid="app-shell" data-shell-ready="true">
        <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        collapsedWidth={0}
        theme={isDark ? 'dark' : 'light'}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: isDark ? undefined : '#dbeafe',
        }}
      >
        <div
          style={{
            height: 64,
            margin: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isDark ? 'white' : '#1f1f1f',
            fontSize: collapsed ? 16 : 20,
            fontWeight: 'bold',
          }}
        >
          {collapsed ? 'SL' : 'SupplyLine'}
        </div>
        <Menu
          theme={isDark ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={defaultOpenSubmenus}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ background: isDark ? undefined : '#dbeafe' }}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 0 : 200 }}>
        <Header
          style={{
            padding: '0 16px',
            background: isDark ? colorBgContainer : '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {collapsed ? (
              <MenuUnfoldOutlined
                style={{ fontSize: 18, cursor: 'pointer' }}
                onClick={() => setCollapsed(false)}
              />
            ) : (
              <MenuFoldOutlined
                style={{ fontSize: 18, cursor: 'pointer' }}
                onClick={() => setCollapsed(true)}
              />
            )}
          </div>

          <Space size="large">
            <ActiveWarehouseSelect />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }} data-testid="user-menu">
                <Avatar
                  icon={<UserOutlined />}
                  src={user?.avatar}
                  size={64}
                />
                <Text strong>
                  {user?.name || user?.employee_number}
                </Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 24,
            minHeight: 280,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
    </>
  );
};
