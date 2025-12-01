import { useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  NavBar,
  TabBar,
  Popup,
  List,
  Avatar,
  SafeArea,
} from 'antd-mobile';
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
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { logout } from '@features/auth/slices/authSlice';
import { useLogoutMutation } from '@features/auth/services/authApi';
import { socketService } from '@services/socket';
import { ROUTES } from '@shared/constants/routes';
import { ALL_MENU_ITEMS } from '@shared/constants/navigation';
import './MobileLayout.css';

// Map route keys to display names
const routeNames: Record<string, string> = {
  [ROUTES.DASHBOARD]: 'Dashboard',
  [ROUTES.TOOL_CHECKOUT]: 'Tool Checkout',
  [ROUTES.TOOLS]: 'Tools',
  [ROUTES.CHEMICALS]: 'Chemicals',
  [ROUTES.KITS]: 'Kits',
  '/orders': 'Orders',
  '/requests': 'Requests',
  [ROUTES.WAREHOUSES]: 'Warehouses',
  [ROUTES.REPORTS]: 'Reports',
  [ROUTES.USERS]: 'Users',
  [ROUTES.PROFILE]: 'Profile',
  [ROUTES.SETTINGS]: 'Settings',
};

// Map routes to icons for the list menu
const routeIcons: Record<string, React.ReactNode> = {
  [ROUTES.TOOL_CHECKOUT]: <SwapOutlined />,
  [ROUTES.TOOLS]: <ToolOutlined />,
  [ROUTES.CHEMICALS]: <ExperimentOutlined />,
  [ROUTES.KITS]: <InboxOutlined />,
  '/orders': <ShoppingCartOutlined />,
  '/requests': <FormOutlined />,
  [ROUTES.WAREHOUSES]: <HomeOutlined />,
  [ROUTES.REPORTS]: <FileTextOutlined />,
  [ROUTES.USERS]: <UserOutlined />,
};

export const MobileLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [logoutApi] = useLogoutMutation();
  const [menuVisible, setMenuVisible] = useState(false);

  // Memoize filtered menu items based on user permissions (excluding admin and main tab items)
  const menuItems = useMemo(() => {
    const isAdmin = user?.is_admin || false;
    const permissions = user?.permissions || [];

    // Filter items that should appear in the "More" menu
    // Exclude Dashboard (in tab bar), Admin (desktop only), Profile, Settings
    const moreMenuRoutes = [
      ROUTES.TOOL_CHECKOUT,
      ROUTES.TOOLS,
      ROUTES.CHEMICALS,
      ROUTES.KITS,
      '/orders',
      '/requests',
      ROUTES.WAREHOUSES,
      ROUTES.REPORTS,
      ROUTES.USERS,
    ];

    return ALL_MENU_ITEMS
      .filter((item) => {
        // Only include items in the moreMenuRoutes list
        if (!moreMenuRoutes.includes(item.key)) return false;

        // Admins can see everything except admin page on mobile
        if (isAdmin) return true;

        // Admin-only items are hidden for non-admins
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
  }, [user?.is_admin, user?.permissions]);

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
      return 'Order Details';
    }
    if (path === '/orders/new') {
      return 'New Order';
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
      path.startsWith('/requests/')
    );
  };

  // Tab bar items
  const tabs = [
    {
      key: ROUTES.DASHBOARD,
      title: 'Dashboard',
      icon: <AppOutline />,
    },
    {
      key: 'menu',
      title: 'Menu',
      icon: <UnorderedListOutline />,
    },
    {
      key: ROUTES.PROFILE,
      title: 'Profile',
      icon: <UserOutline />,
    },
    {
      key: ROUTES.SETTINGS,
      title: 'Settings',
      icon: <SetOutline />,
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
    <div className="mobile-layout">
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

      <div className="mobile-layout-footer">
        <TabBar
          activeKey={getActiveKey()}
          onChange={handleTabChange}
          className="mobile-tabbar"
        >
          {tabs.map((tab) => (
            <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
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
        <div className="mobile-menu-popup">
          {/* User Info Header */}
          <div className="mobile-menu-header">
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
            >
              <span style={{ color: '#ff4d4f' }}>Logout</span>
            </List.Item>
          </List>
        </div>
      </Popup>
    </div>
  );
};
