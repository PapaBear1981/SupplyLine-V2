import type { ReactNode } from 'react';
import {
  AuditOutlined,
  DashboardOutlined,
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  HomeOutlined,
  FileTextOutlined,
  UserOutlined,
  SettingOutlined,
  SwapOutlined,
  RetweetOutlined,
  ShoppingCartOutlined,
  FormOutlined,
  BarChartOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { ROUTES } from './routes';

export type MenuItem = Required<MenuProps>['items'][number];

/**
 * Map nav item keys to stable `data-testid` slugs used by Playwright specs.
 * Keep in sync with the keys below — adding a nav item without a testid
 * slug just renders a plain label, which is fine for non-tested screens.
 */
const NAV_TEST_IDS: Record<string, string> = {
  [ROUTES.DASHBOARD]: 'nav-dashboard',
  'tools-group': 'nav-tools',
  [ROUTES.TOOL_CHECKOUT]: 'nav-tool-checkout',
  [ROUTES.TOOLS]: 'nav-tools-inventory',
  [ROUTES.TOOL_HISTORY]: 'nav-tool-history',
  [ROUTES.CHEMICALS]: 'nav-chemicals',
  [ROUTES.CHEMICAL_FORECAST]: 'nav-chemicals-forecast',
  [ROUTES.KITS]: 'nav-kits',
  'operations-group': 'nav-operations',
  '/orders': 'nav-orders',
  '/requests': 'nav-requests',
  [ROUTES.WAREHOUSES]: 'nav-warehouses',
  [ROUTES.TRANSFERS]: 'nav-transfers',
  [ROUTES.REPORTS]: 'nav-reports',
  [ROUTES.USERS]: 'nav-users',
  [ROUTES.ADMIN]: 'nav-admin',
};

/**
 * Wrap a string label in a span carrying a stable data-testid. antd Menu
 * items accept ReactNode labels, so this is non-invasive and Playwright
 * selectors (`page.getByTestId('nav-tools')`) land on the span inside the
 * menu item; clicks bubble to `onClick` exactly as with a plain label.
 */
const taggedLabel = (key: string, label: string): ReactNode => {
  const testId = NAV_TEST_IDS[key];
  return testId ? <span data-testid={testId}>{label}</span> : label;
};

/**
 * Extended menu item with permission requirement.
 */
interface MenuItemWithPermission {
  key: string;
  icon?: ReactNode;
  label: string;
  permission?: string;  // Required permission to show this item
  adminOnly?: boolean;  // If true, only admins can see this item
  children?: MenuItemWithPermission[];
}

/**
 * All menu items with their permission requirements.
 * This is the source of truth for navigation permissions.
 */
export const ALL_MENU_ITEMS: MenuItemWithPermission[] = [
  {
    key: ROUTES.DASHBOARD,
    icon: <DashboardOutlined />,
    label: 'Dashboard',
    // Dashboard is accessible to all authenticated users
  },
  {
    key: 'tools-group',
    icon: <ToolOutlined />,
    label: 'Tools',
    children: [
      {
        key: ROUTES.TOOLS,
        icon: <ToolOutlined />,
        label: 'Inventory',
        permission: 'page.tools',
      },
      {
        key: ROUTES.TOOL_CHECKOUT,
        icon: <SwapOutlined />,
        label: 'Tool Checkout',
        permission: 'page.checkouts',
      },
      {
        key: ROUTES.TOOL_HISTORY,
        icon: <AuditOutlined />,
        label: 'Tool History',
        permission: 'checkout.view',
      },
    ],
  },
  {
    key: ROUTES.CHEMICALS,
    icon: <ExperimentOutlined />,
    label: 'Chemicals',
    permission: 'page.chemicals',
    children: [
      {
        key: ROUTES.CHEMICALS,
        label: 'Inventory',
        permission: 'page.chemicals',
      },
      {
        key: ROUTES.CHEMICAL_FORECAST,
        icon: <BarChartOutlined />,
        label: 'Forecast',
        permission: 'page.chemicals',
      },
    ],
  },
  {
    key: ROUTES.KITS,
    icon: <InboxOutlined />,
    label: 'Kits',
    permission: 'page.kits',
  },
  {
    key: 'operations-group',
    icon: <AppstoreOutlined />,
    label: 'Operations',
    children: [
      {
        key: '/orders',
        icon: <ShoppingCartOutlined />,
        label: 'Fulfillment',
        permission: 'page.orders',
      },
      {
        key: '/requests',
        icon: <FormOutlined />,
        label: 'Requests',
        permission: 'page.requests',
      },
      {
        key: ROUTES.TRANSFERS,
        icon: <RetweetOutlined />,
        label: 'Transfers',
        permission: 'transfer.view',
      },
    ],
  },
  {
    key: ROUTES.WAREHOUSES,
    icon: <HomeOutlined />,
    label: 'Warehouses',
    permission: 'page.warehouses',
  },
  {
    key: ROUTES.REPORTS,
    icon: <FileTextOutlined />,
    label: 'Reports',
    permission: 'page.reports',
  },
  {
    key: ROUTES.USERS,
    icon: <UserOutlined />,
    label: 'Users',
    permission: 'page.users',
  },
  {
    key: ROUTES.ADMIN,
    icon: <SettingOutlined />,
    label: 'Admin',
    adminOnly: true,
  },
];

/**
 * Filter menu items based on user permissions.
 *
 * @param isAdmin - Whether the user is an admin
 * @param permissions - Array of permission strings the user has
 * @returns Filtered menu items the user can access
 */
export const getMenuItems = (isAdmin: boolean = false, permissions: string[] = []): MenuItem[] => {
  const filterItems = (items: MenuItemWithPermission[]): MenuItem[] => {
    return items
      .filter((item) => {
        // Admins can see everything
        if (isAdmin) return true;

        // Admin-only items are hidden for non-admins
        if (item.adminOnly) return false;

        // If no permission required, show the item
        if (!item.permission) return true;

        // Check if user has the required permission
        return permissions.includes(item.permission);
      })
      .map((item) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { permission, adminOnly, children, ...menuItem } = item;
        const tagged = { ...menuItem, label: taggedLabel(item.key, item.label) };
        if (children) {
          const filteredChildren = filterItems(children);
          if (filteredChildren.length === 0) return null;
          return { ...tagged, children: filteredChildren } as MenuItem;
        }
        return tagged as MenuItem;
      })
      .filter((item): item is MenuItem => item !== null);
  };

  return filterItems(ALL_MENU_ITEMS);
};
