import { Card } from 'antd';
import {
  PlusOutlined,
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  SearchOutlined,
  BarChartOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@shared/constants/routes';
import styles from '../styles/Dashboard.module.scss';

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  path: string;
  color: string;
}

interface QuickActionsProps {
  isAdmin?: boolean;
}

export const QuickActions = ({ isAdmin = false }: QuickActionsProps) => {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      icon: <ToolOutlined />,
      label: 'Manage Tools',
      path: ROUTES.TOOLS,
      color: '#1890ff',
    },
    {
      icon: <ExperimentOutlined />,
      label: 'Manage Chemicals',
      path: ROUTES.CHEMICALS,
      color: '#52c41a',
    },
    {
      icon: <InboxOutlined />,
      label: 'View Kits',
      path: ROUTES.KITS,
      color: '#722ed1',
    },
    {
      icon: <PlusOutlined />,
      label: 'Create Kit',
      path: '/kits/new',
      color: '#fa8c16',
    },
  ];

  const adminActions: QuickAction[] = [
    {
      icon: <TeamOutlined />,
      label: 'Manage Users',
      path: ROUTES.USERS,
      color: '#13c2c2',
    },
    {
      icon: <BarChartOutlined />,
      label: 'View Reports',
      path: ROUTES.REPORTS,
      color: '#eb2f96',
    },
    {
      icon: <SearchOutlined />,
      label: 'Warehouses',
      path: ROUTES.WAREHOUSES,
      color: '#faad14',
    },
    {
      icon: <SettingOutlined />,
      label: 'Admin Panel',
      path: ROUTES.ADMIN,
      color: '#595959',
    },
  ];

  const displayActions = isAdmin ? [...actions.slice(0, 3), ...adminActions.slice(0, 1)] : actions;

  return (
    <Card
      className={styles.sectionCard}
      title={
        <span className={styles.sectionTitle}>
          <PlusOutlined />
          Quick Actions
        </span>
      }
    >
      <div className={styles.quickActions}>
        {displayActions.map((action, index) => (
          <div
            key={index}
            className={styles.quickActionBtn}
            onClick={() => navigate(action.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate(action.path)}
          >
            <span className={styles.quickActionIcon} style={{ color: action.color }}>
              {action.icon}
            </span>
            <span className={styles.quickActionLabel}>{action.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
