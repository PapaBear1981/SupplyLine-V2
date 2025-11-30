import type { ReactNode } from 'react';
import {
  DashboardOutlined,
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  HomeOutlined,
  FileTextOutlined,
  UserOutlined,
  SettingOutlined,
  SwapOutlined,
  ShoppingCartOutlined,
  FormOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { ROUTES } from './routes';

export type MenuItem = Required<MenuProps>['items'][number];

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
    key: ROUTES.TOOL_CHECKOUT,
    icon: <SwapOutlined />,
    label: 'Tool Checkout',
    permission: 'page.checkouts',
  },
  {
    key: ROUTES.TOOLS,
    icon: <ToolOutlined />,
    label: 'Tools',
    permission: 'page.tools',
  },
  {
    key: ROUTES.CHEMICALS,
    icon: <ExperimentOutlined />,
    label: 'Chemicals',
    permission: 'page.chemicals',
  },
  {
    key: ROUTES.KITS,
    icon: <InboxOutlined />,
    label: 'Kits',
    permission: 'page.kits',
  },
  {
    key: '/orders',
    icon: <ShoppingCartOutlined />,
    label: 'Orders',
    permission: 'page.orders',
  },
  {
    key: '/requests',
    icon: <FormOutlined />,
    label: 'Requests',
    permission: 'page.requests',
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
        // Remove permission-related fields and return as MenuItem
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { permission, adminOnly, children, ...menuItem } = item;
        if (children) {
          return {
            ...menuItem,
            children: filterItems(children),
          } as MenuItem;
        }
        return menuItem as MenuItem;
      });
  };

  return filterItems(ALL_MENU_ITEMS);
};
