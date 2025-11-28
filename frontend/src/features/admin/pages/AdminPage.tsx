import { Tabs, Typography } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  NotificationOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { AdminOverview } from '../components/AdminOverview';
import { UserManagement } from '../components/UserManagement';
import { DepartmentManagement } from '../components/DepartmentManagement';
import { AnnouncementManagement } from '../components/AnnouncementManagement';
import { RoleManagement } from '../components/RoleManagement';

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
          Roles & Permissions
        </span>
      ),
      children: <RoleManagement />,
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
