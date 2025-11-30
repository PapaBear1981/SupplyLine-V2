import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Button, Drawer, Typography, Space, Avatar, Tag, Divider } from 'antd';
import {
  MenuOutlined,
  DashboardOutlined,
  InboxOutlined,
  ToolOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
  FormOutlined,
  LogoutOutlined,
  UserOutlined,
  SwapOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { logout } from '@features/auth/slices/authSlice';
import { useLogoutMutation } from '@features/auth/services/authApi';
import { ROUTES } from '@shared/constants/routes';
import styles from './MobileLayout.module.scss';
import { MobilePage } from '../mobile/MobilePage';

const { Header, Content } = Layout;
const { Text } = Typography;

export const MobileLayout = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [logoutApi] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logoutApi().unwrap();
    } catch {
      // ignore logout errors in mobile shell
    } finally {
      dispatch(logout());
      navigate(ROUTES.LOGIN);
    }
  };

  const quickActions = [
    { label: 'Dashboard', icon: <DashboardOutlined />, route: ROUTES.DASHBOARD },
    { label: 'Checkout', icon: <SwapOutlined />, route: ROUTES.TOOL_CHECKOUT },
    { label: 'Kits', icon: <InboxOutlined />, route: ROUTES.KITS },
    { label: 'Tools', icon: <ToolOutlined />, route: ROUTES.TOOLS },
    { label: 'Chemicals', icon: <SafetyCertificateOutlined />, route: ROUTES.CHEMICALS },
    { label: 'Orders', icon: <ShoppingCartOutlined />, route: '/orders' },
    { label: 'Requests', icon: <FormOutlined />, route: '/requests' },
  ];

  const bottomNav = [
    { key: ROUTES.DASHBOARD, label: 'Home', icon: <DashboardOutlined /> },
    { key: ROUTES.KITS, label: 'Kits', icon: <InboxOutlined /> },
    { key: ROUTES.TOOLS, label: 'Tools', icon: <ToolOutlined /> },
    { key: ROUTES.CHEMICALS, label: 'Chem', icon: <SafetyCertificateOutlined /> },
  ];

  const mobileMeta = (
    path: string,
  ): { title: string; subtitle?: string } | null => {
    if (path === ROUTES.DASHBOARD) return null; // handled by dedicated mobile dashboard
    if (path.startsWith(ROUTES.TOOL_CHECKOUT)) {
      return null; // page handles its own mobile presentation
    }
    if (path.startsWith(ROUTES.TOOLS)) {
      return null; // page handles its own mobile presentation
    }
    if (path.startsWith(ROUTES.CHEMICALS)) {
      return null;
    }
    if (path.startsWith(ROUTES.WAREHOUSES)) {
      return null;
    }
    if (path.startsWith(ROUTES.KITS)) {
      return { title: 'Kits', subtitle: 'Assemble, review, and manage kits' };
    }
    if (path.startsWith('/orders')) {
      return { title: 'Orders', subtitle: 'Track and submit order activity' };
    }
    if (path.startsWith('/requests')) {
      return { title: 'Requests', subtitle: 'Create and monitor requests quickly' };
    }
    if (path.startsWith(ROUTES.REPORTS)) {
      return { title: 'Reports', subtitle: 'Review analytics and exports on mobile' };
    }
    if (path.startsWith(ROUTES.USERS)) {
      return { title: 'Users', subtitle: 'Review roles, status, and profiles' };
    }
    if (path.startsWith(ROUTES.PROFILE)) {
      return { title: 'Profile', subtitle: 'Update your personal settings' };
    }
    if (path.startsWith(ROUTES.SETTINGS)) {
      return { title: 'Settings', subtitle: 'Configure preferences and notifications' };
    }
    if (path.startsWith(ROUTES.ADMIN)) {
      return { title: 'Admin', subtitle: 'Administrative controls on the go' };
    }
    return null;
  };

  const pageMeta = mobileMeta(location.pathname);

  return (
    <Layout className={styles.mobileShell}>
      <Header className={styles.header}>
        <Space size="middle">
          <Button
            type="text"
            icon={<MenuOutlined />}
            aria-label="Open navigation menu"
            onClick={() => setIsDrawerOpen(true)}
            className={styles.iconButton}
          />
          <div className={styles.brandBlock}>
            <Text strong className={styles.brandTitle}>
              SupplyLine
            </Text>
            <Tag color="green" className={styles.statusTag}>
              Live
            </Tag>
          </div>
        </Space>
        <Space size="small">
          <Button
            type="text"
            icon={<BellOutlined />}
            className={styles.iconButton}
            aria-label="Open alerts"
            onClick={() => navigate(ROUTES.REPORTS)}
          />
          <Avatar
            size={40}
            icon={<UserOutlined />}
            src={user?.avatar}
            onClick={() => navigate(ROUTES.PROFILE)}
            className={styles.avatar}
          />
        </Space>
      </Header>

      <Content className={styles.content}>
        <div className={styles.contentInner}>
          {pageMeta ? (
            <MobilePage title={pageMeta.title} subtitle={pageMeta.subtitle}>
              <Outlet />
            </MobilePage>
          ) : (
            <Outlet />
          )}
        </div>
      </Content>

      <div className={styles.bottomNav}>
        {bottomNav.map((item) => (
          <button
            key={item.key}
            type="button"
            className={
              location.pathname === item.key ? `${styles.navButton} ${styles.active}` : styles.navButton
            }
            onClick={() => navigate(item.key)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <Drawer
        placement="left"
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        width={320}
        className={styles.drawer}
        title={
          <Space>
            <Avatar icon={<UserOutlined />} src={user?.avatar} />
            <div>
              <Text strong>{user?.name || user?.employee_number}</Text>
              <div className={styles.drawerSubtitle}>Mobile cockpit</div>
            </div>
          </Space>
        }
      >
        <div className={styles.drawerSection}>
          <Text type="secondary">Jump to</Text>
          <div className={styles.drawerGrid}>
            {quickActions.map((action) => (
              <button
                key={action.route}
                type="button"
                className={styles.drawerTile}
                onClick={() => {
                  navigate(action.route);
                  setIsDrawerOpen(false);
                }}
              >
                <span className={styles.tileIcon}>{action.icon}</span>
                <span className={styles.tileLabel}>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Divider />

        <Space direction="vertical" size="middle" className={styles.drawerActions}>
          <Button block icon={<UserOutlined />} onClick={() => navigate(ROUTES.PROFILE)}>
            Profile
          </Button>
          <Button block icon={<FormOutlined />} onClick={() => navigate(ROUTES.SETTINGS)}>
            Settings
          </Button>
          <Button block danger icon={<LogoutOutlined />} onClick={handleLogout}>
            Sign out
          </Button>
        </Space>
      </Drawer>
    </Layout>
  );
};
