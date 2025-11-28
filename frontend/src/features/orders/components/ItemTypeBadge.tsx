import { Tag } from 'antd';
import {
  ToolOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  InboxOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import type { OrderType, ItemType, KitItemType } from '../types';

interface ItemTypeBadgeProps {
  type: OrderType | ItemType | KitItemType;
}

const TYPE_CONFIG: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  tool: {
    color: 'blue',
    icon: <ToolOutlined />,
    label: 'Tool',
  },
  chemical: {
    color: 'purple',
    icon: <ExperimentOutlined />,
    label: 'Chemical',
  },
  expendable: {
    color: 'cyan',
    icon: <AppstoreOutlined />,
    label: 'Expendable',
  },
  kit: {
    color: 'green',
    icon: <InboxOutlined />,
    label: 'Kit',
  },
  other: {
    color: 'default',
    icon: <QuestionCircleOutlined />,
    label: 'Other',
  },
};

export const ItemTypeBadge: React.FC<ItemTypeBadgeProps> = ({ type }) => {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.other;

  return (
    <Tag color={config.color} icon={config.icon}>
      {config.label}
    </Tag>
  );
};
