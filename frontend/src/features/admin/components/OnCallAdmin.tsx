import { Tabs } from 'antd';
import { CalendarOutlined, PhoneOutlined } from '@ant-design/icons';
import { OnCallManagement } from './OnCallManagement';
import { OnCallScheduling } from './OnCallScheduling';

export const OnCallAdmin = () => {
  const items = [
    {
      key: 'current',
      label: (
        <span>
          <PhoneOutlined /> Current Coverage
        </span>
      ),
      children: <OnCallManagement />,
    },
    {
      key: 'schedule',
      label: (
        <span>
          <CalendarOutlined /> Schedule
        </span>
      ),
      children: <OnCallScheduling />,
    },
  ];

  return <Tabs defaultActiveKey="current" items={items} />;
};
