import {
  DashboardOutlined,
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  HomeOutlined,
  FileTextOutlined,
  UserOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  FormOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { ROUTES } from './routes';

export type MenuItem = Required<MenuProps>['items'][number];

export const getMenuItems = (isAdmin: boolean = false): MenuItem[] => {
  const items: MenuItem[] = [
    {
      key: ROUTES.DASHBOARD,
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: ROUTES.TOOLS,
      icon: <ToolOutlined />,
      label: 'Tools',
    },
    {
      key: ROUTES.CHEMICALS,
      icon: <ExperimentOutlined />,
      label: 'Chemicals',
    },
    {
      key: ROUTES.KITS,
      icon: <InboxOutlined />,
      label: 'Kits',
    },
    {
      key: '/orders',
      icon: <ShoppingCartOutlined />,
      label: 'Orders',
    },
    {
      key: '/requests',
      icon: <FormOutlined />,
      label: 'Requests',
    },
    {
      key: ROUTES.WAREHOUSES,
      icon: <HomeOutlined />,
      label: 'Warehouses',
    },
    {
      key: ROUTES.REPORTS,
      icon: <FileTextOutlined />,
      label: 'Reports',
    },
    {
      key: ROUTES.USERS,
      icon: <UserOutlined />,
      label: 'Users',
    },
  ];

  // Add admin menu item only for admins
  if (isAdmin) {
    items.push({
      key: ROUTES.ADMIN,
      icon: <SettingOutlined />,
      label: 'Admin',
    });
  }

  return items;
};
