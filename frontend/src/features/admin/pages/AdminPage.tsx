import { Tabs, Typography } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  NotificationOutlined,
  SafetyOutlined,
  ApartmentOutlined,
  KeyOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { AdminOverview } from '../components/AdminOverview';
import { UserManagement } from '../components/UserManagement';
import { DepartmentManagement } from '../components/DepartmentManagement';
import { AnnouncementManagement } from '../components/AnnouncementManagement';
import { RoleManagement } from '../components/RoleManagement';
import { AircraftTypeManagement } from '../components/AircraftTypeManagement';
import { PermissionOverview } from '../components/PermissionOverview';
import { SystemSettings } from '../components/SystemSettings';

const { Title, Paragraph } = Typography;

export const AdminPage = () => {
  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <DashboardOutlined />
          Overview
        </span>
      ),
      children: <AdminOverview />,
    },
    {
      key: 'users',
      label: (
        <span>
          <UserOutlined />
          User Management
        </span>
      ),
      children: <UserManagement />,
    },
    {
      key: 'departments',
      label: (
        <span>
          <TeamOutlined />
          Departments
        </span>
      ),
      children: <DepartmentManagement />,
    },
    {
      key: 'announcements',
      label: (
        <span>
          <NotificationOutlined />
          Announcements
        </span>
      ),
      children: <AnnouncementManagement />,
    },
    {
      key: 'roles',
      label: (
        <span>
          <SafetyOutlined />
          Roles
        </span>
      ),
      children: <RoleManagement />,
    },
    {
      key: 'permissions',
      label: (
        <span>
          <KeyOutlined />
          Permissions
        </span>
      ),
      children: <PermissionOverview />,
    },
    {
      key: 'aircraft-types',
      label: (
        <span>
          <ApartmentOutlined />
          Aircraft Types
        </span>
      ),
      children: <AircraftTypeManagement />,
    },
    {
      key: 'system',
      label: (
        <span>
          <SettingOutlined />
          System
        </span>
      ),
      children: <SystemSettings />,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          Admin Dashboard
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
          Manage users, departments, announcements, and system settings
        </Paragraph>
      </div>

      <Tabs
        defaultActiveKey="overview"
        items={tabItems}
        size="large"
      />
    </div>
  );
};
