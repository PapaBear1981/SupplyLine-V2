import { useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  NavBar,
  TabBar,
  Popup,
  List,
  Avatar,
  SafeArea,
  FloatingBubble,
} from 'antd-mobile';
import { ScanCodeOutline } from 'antd-mobile-icons';
import { useScanner } from '@features/scanner';
import { MobileAIAssistant } from '@features/ai/components/MobileAIAssistant';
import {
  AppOutline,
  UnorderedListOutline,
  UserOutline,
  SetOutline,
  RightOutline,
} from 'antd-mobile-icons';
import {
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  HomeOutlined,
  FileTextOutlined,
  UserOutlined,
  SwapOutlined,
  ShoppingCartOutlined,
  FormOutlined,
  LogoutOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { logout } from '@features/auth/slices/authSlice';
import { useLogoutMutation } from '@features/auth/services/authApi';
import { socketService } from '@services/socket';
import { ROUTES } from '@shared/constants/routes';
import { ALL_MENU_ITEMS } from '@shared/constants/navigation';
import { useMobileAdminEnabled } from '@shared/hooks/useMobileAdminEnabled';
import './MobileLayout.css';

// Map route keys to display names
const routeNames: Record<string, string> = {
  [ROUTES.DASHBOARD]: 'Dashboard',
  [ROUTES.TOOL_CHECKOUT]: 'Tool Checkout',
  [ROUTES.TOOLS]: 'Tools',
  [ROUTES.CHEMICALS]: 'Chemicals',
  [ROUTES.CHEMICAL_FORECAST]: 'Chemical Forecast',
  [ROUTES.KITS]: 'Kits',
  '/orders': 'Fulfillment',
  '/requests': 'Requests',
  [ROUTES.WAREHOUSES]: 'Warehouses',
  [ROUTES.REPORTS]: 'Reports',
  [ROUTES.USERS]: 'Users',
  [ROUTES.ADMIN]: 'Admin',
  [ROUTES.PROFILE]: 'Profile',
  [ROUTES.SETTINGS]: 'Settings',
};

// Map routes to icons for the list menu
const routeIcons: Record<string, React.ReactNode> = {
  [ROUTES.TOOL_CHECKOUT]: <SwapOutlined />,
  [ROUTES.TOOLS]: <ToolOutlined />,
  [ROUTES.CHEMICALS]: <ExperimentOutlined />,
  [ROUTES.CHEMICAL_FORECAST]: <BarChartOutlined />,
  [ROUTES.KITS]: <InboxOutlined />,
  '/orders': <ShoppingCartOutlined />,
  '/requests': <FormOutlined />,
  [ROUTES.WAREHOUSES]: <HomeOutlined />,
  [ROUTES.REPORTS]: <FileTextOutlined />,
  [ROUTES.USERS]: <UserOutlined />,
  [ROUTES.ADMIN]: <SettingOutlined />,
};

export const MobileLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [logoutApi] = useLogoutMutation();
  const [menuVisible, setMenuVisible] = useState(false);
  const { isEnabled: mobileAdminEnabled } = useMobileAdminEnabled();
  const { openScanner } = useScanner();

  // Memoize filtered menu items based on user permissions and mobile admin toggle
  const menuItems = useMemo(() => {
    const isAdmin = user?.is_admin || false;
    const permissions = user?.permissions || [];

    // Routes that should appear in the "More" menu — Dashboard, Profile,
    // and Settings already live in the bottom tab bar. Chemical Forecast
    // and Admin are mobile additions and are filtered further below.
    const moreMenuRoutes: string[] = [
      ROUTES.TOOL_CHECKOUT,
      ROUTES.TOOLS,
      ROUTES.CHEMICALS,
      ROUTES.CHEMICAL_FORECAST,
      ROUTES.KITS,
      '/orders',
      '/requests',
      ROUTES.WAREHOUSES,
      ROUTES.REPORTS,
      ROUTES.USERS,
      ROUTES.ADMIN,
    ];

    // Chemical Forecast lives inside a nested children[] entry on desktop.
    // Flatten ALL_MENU_ITEMS so the mobile menu can surface it directly.
    const flattenedItems = ALL_MENU_ITEMS.flatMap((item) => {
      if (item.children && item.children.length > 0) {
        return [item, ...item.children];
      }
      return [item];
    });

    // De-dupe by key so nested children don't appear twice when the
    // parent and child share the same route (e.g. Chemicals + Inventory).
    const seen = new Set<string>();
    const uniqueItems = flattenedItems.filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    });

    return uniqueItems
      .filter((item) => {
        if (!moreMenuRoutes.includes(item.key)) return false;

        // Admin item is gated by the mobile_admin_enabled system setting
        // (Phase 5 wires the backend value; Phase 1 hard-codes false).
        if (item.key === ROUTES.ADMIN) {
          return isAdmin && mobileAdminEnabled;
        }

        // Admins can see everything else
        if (isAdmin) return true;

        // Admin-only items (besides /admin itself) are hidden for non-admins
        if (item.adminOnly) return false;

        // If no permission required, show the item
        if (!item.permission) return true;

        // Check if user has the required permission
        return permissions.includes(item.permission);
      })
      .map((item) => ({
        key: item.key,
        label: item.label,
        icon: routeIcons[item.key],
      }));
  }, [user?.is_admin, user?.permissions, mobileAdminEnabled]);

  const handleLogout = async () => {
    try {
      await logoutApi().unwrap();
    } catch {
      // Ignore logout errors - still clear local state
    } finally {
      socketService.disconnect();
      dispatch(logout());
      navigate(ROUTES.LOGIN);
    }
  };

  // Get current page title
  const getCurrentTitle = () => {
    const path = location.pathname;

    // Handle detail routes
    if (path.startsWith('/kits/') && path !== '/kits/new') {
      return 'Kit Details';
    }
    if (path === '/kits/new') {
      return 'New Kit';
    }
    if (path.startsWith('/orders/') && path !== '/orders/new') {
      return 'Fulfillment Details';
    }
    if (path === '/orders/new') {
      return 'New Fulfillment Record';
    }
    if (path.startsWith('/requests/') && path !== '/requests/new') {
      return 'Request Details';
    }
    if (path === '/requests/new') {
      return 'New Request';
    }

    return routeNames[path] || 'SupplyLine';
  };

  // Check if we should show back button
  const shouldShowBack = () => {
    const path = location.pathname;
    return (
      path.startsWith('/kits/') ||
      path.startsWith('/orders/') ||
      path.startsWith('/requests/') ||
      path === ROUTES.CHEMICAL_FORECAST
    );
  };

  // Tab bar items
  const tabs = [
    {
      key: ROUTES.DASHBOARD,
      title: 'Dashboard',
      icon: <AppOutline />,
      testid: 'mobile-tab-dashboard',
    },
    {
      key: 'menu',
      title: 'Menu',
      icon: <UnorderedListOutline />,
      testid: 'mobile-tab-menu',
    },
    {
      key: ROUTES.PROFILE,
      title: 'Profile',
      icon: <UserOutline />,
      testid: 'mobile-tab-profile',
    },
    {
      key: ROUTES.SETTINGS,
      title: 'Settings',
      icon: <SetOutline />,
      testid: 'mobile-tab-settings',
    },
  ];

  // Handle tab bar clicks
  const handleTabChange = (key: string) => {
    if (key === 'menu') {
      setMenuVisible(true);
    } else {
      navigate(key);
    }
  };

  // Get active tab key
  const getActiveKey = () => {
    const path = location.pathname;
    if (path === ROUTES.DASHBOARD || path === '/') return ROUTES.DASHBOARD;
    if (path === ROUTES.PROFILE) return ROUTES.PROFILE;
    if (path === ROUTES.SETTINGS) return ROUTES.SETTINGS;
    return '';
  };

  return (
    <div className="mobile-layout" data-testid="app-shell" data-shell-ready="true">
      <div className="mobile-layout-header">
        <SafeArea position="top" />
        <NavBar
          backIcon={shouldShowBack() ? undefined : null}
          onBack={shouldShowBack() ? () => navigate(-1) : undefined}
          className="mobile-navbar"
        >
          {getCurrentTitle()}
        </NavBar>
      </div>

      <div className="mobile-layout-content">
        <Outlet />
      </div>

      {/* Global scan FAB — hidden on tool checkout (that page has its own scan button in the popup) */}
      {location.pathname !== ROUTES.TOOL_CHECKOUT && (
        <FloatingBubble
          style={{
            '--initial-position-bottom': '88px',
            '--initial-position-right': '16px',
            '--edge-distance': '16px',
            '--background': 'var(--adm-color-primary)',
          }}
          onClick={() => openScanner()}
          aria-label="Scan QR code or barcode"
        >
          <ScanCodeOutline fontSize={26} />
        </FloatingBubble>
      )}

      {/* AI Assistant FAB + full-screen chat */}
      <MobileAIAssistant />

      <div className="mobile-layout-footer">
        <TabBar
          activeKey={getActiveKey()}
          onChange={handleTabChange}
          className="mobile-tabbar"
        >
          {tabs.map((tab) => (
            <TabBar.Item
              key={tab.key}
              icon={tab.icon}
              title={tab.title}
              data-testid={tab.testid}
            />
          ))}
        </TabBar>
        <SafeArea position="bottom" />
      </div>

      {/* Menu Popup */}
      <Popup
        visible={menuVisible}
        onMaskClick={() => setMenuVisible(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <div className="mobile-menu-popup" data-testid="mobile-menu-popup">
          {/* User Info Header */}
          <div className="mobile-menu-header" data-testid="mobile-menu-user">
            <Avatar
              src={user?.avatar || ''}
              style={{ '--size': '48px', '--border-radius': '50%' }}
            />
            <div className="mobile-menu-user-info">
              <div className="mobile-menu-user-name">{user?.name || user?.employee_number}</div>
              <div className="mobile-menu-user-dept">{user?.department}</div>
            </div>
          </div>

          {/* Menu Items */}
          <List header="Navigation" className="mobile-menu-list">
            {menuItems.map((item) => (
              <List.Item
                key={item.key}
                prefix={item.icon}
                arrow={<RightOutline />}
                onClick={() => {
                  navigate(item.key);
                  setMenuVisible(false);
                }}
                className={location.pathname === item.key ? 'active-menu-item' : ''}
                data-testid={`mobile-menu-item-${item.key.replace(/^\//, '').replace(/\//g, '-') || 'root'}`}
              >
                {item.label}
              </List.Item>
            ))}
          </List>

          {/* Logout */}
          <List className="mobile-menu-list logout-section">
            <List.Item
              prefix={<LogoutOutlined style={{ color: '#ff4d4f' }} />}
              onClick={() => {
                setMenuVisible(false);
                handleLogout();
              }}
              className="logout-item"
              data-testid="mobile-menu-logout"
            >
              <span style={{ color: '#ff4d4f' }}>Logout</span>
            </List.Item>
          </List>
        </div>
      </Popup>
    </div>
  );
};
