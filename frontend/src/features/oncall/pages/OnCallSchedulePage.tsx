import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Card,
  Col,
  Empty,
  Row,
  Segmented,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  theme,
} from 'antd';
import {
  CalendarOutlined,
  InboxOutlined,
  PhoneOutlined,
  ToolOutlined,
  UserOutlined,
  MailOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  useGetOnCallScheduleQuery,
  type OnCallRole,
  type OnCallScheduleEntry,
} from '@features/admin/services/oncallScheduleApi';
import { useGetOnCallPersonnelQuery } from '@features/admin/services/oncallApi';

dayjs.extend(isBetween);
dayjs.extend(relativeTime);

const { Title, Paragraph, Text } = Typography;

type RoleFilter = 'all' | OnCallRole;

const ROLE_META: Record<OnCallRole, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  materials: {
    label: 'Materials',
    color: '#1890ff',
    icon: <InboxOutlined />,
    description: 'Tools, chemicals, and supplies',
  },
  maintenance: {
    label: 'Maintenance',
    color: '#fa8c16',
    icon: <ToolOutlined />,
    description: 'Equipment repairs and service',
  },
};

interface ScheduleRowProps {
  entry: OnCallScheduleEntry;
  highlight?: boolean;
}

const ScheduleRow = ({ entry, highlight }: ScheduleRowProps) => {
  const { token } = theme.useToken();
  const meta = ROLE_META[entry.role];
  const sd = dayjs(entry.start_date);
  const ed = dayjs(entry.end_date);
  const days = ed.diff(sd, 'day') + 1;
  const today = dayjs().startOf('day');
  const isCurrent = today.isBetween(sd.subtract(1, 'day'), ed.add(1, 'day'), 'day', '()');
  const isUpcoming = sd.isAfter(today);

  return (
    <Card
      size="small"
      bordered
      style={{
        background: highlight || isCurrent ? `${meta.color}10` : token.colorFillAlter,
        borderColor: isCurrent ? meta.color : token.colorBorderSecondary,
      }}
    >
      <Row gutter={[12, 12]} align="middle">
        <Col xs={24} sm={6}>
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Tag color={meta.color} icon={meta.icon} style={{ margin: 0 }}>
              {meta.label}
            </Tag>
            <Text strong>{sd.format('MMM D')} – {ed.format('MMM D, YYYY')}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {days} day{days === 1 ? '' : 's'}
              {isCurrent && (
                <Tag color="green" style={{ marginLeft: 6 }}>Active now</Tag>
              )}
              {isUpcoming && (
                <Tag color="blue" style={{ marginLeft: 6 }}>
                  Starts {sd.from(today)}
                </Tag>
              )}
            </Text>
          </Space>
        </Col>

        <Col xs={24} sm={12}>
          {entry.user ? (
            <Space>
              <Avatar
                size={40}
                src={entry.user.avatar || undefined}
                icon={!entry.user.avatar && <UserOutlined />}
                style={{ backgroundColor: entry.user.avatar ? undefined : meta.color }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>{entry.user.name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  #{entry.user.employee_number}
                  {entry.user.department ? ` · ${entry.user.department}` : ''}
                </Text>
              </div>
            </Space>
          ) : (
            <Text type="secondary">Unassigned</Text>
          )}
        </Col>

        <Col xs={24} sm={6}>
          <Space direction="vertical" size={2}>
            {entry.user?.phone && (
              <a href={`tel:${entry.user.phone}`} style={{ fontSize: 13 }}>
                <PhoneOutlined /> {entry.user.phone}
              </a>
            )}
            {entry.user?.email && (
              <a href={`mailto:${entry.user.email}`} style={{ fontSize: 13 }}>
                <MailOutlined /> {entry.user.email}
              </a>
            )}
          </Space>
        </Col>

        {entry.notes && (
          <Col span={24}>
            <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
              {entry.notes}
            </Text>
          </Col>
        )}
      </Row>
    </Card>
  );
};

interface GroupedSchedule {
  upcoming: OnCallScheduleEntry[];
  current: OnCallScheduleEntry[];
  past: OnCallScheduleEntry[];
}

const groupByTime = (schedules: OnCallScheduleEntry[]): GroupedSchedule => {
  const today = dayjs().startOf('day');
  const groups: GroupedSchedule = { upcoming: [], current: [], past: [] };
  for (const s of schedules) {
    const sd = dayjs(s.start_date);
    const ed = dayjs(s.end_date);
    if (ed.isBefore(today, 'day')) {
      groups.past.push(s);
    } else if (sd.isAfter(today, 'day')) {
      groups.upcoming.push(s);
    } else {
      groups.current.push(s);
    }
  }
  return groups;
};

export const OnCallSchedulePage = () => {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [windowDays, setWindowDays] = useState<number>(90);

  const start = useMemo(() => dayjs().startOf('day'), []);
  const end = useMemo(() => start.add(windowDays, 'day'), [start, windowDays]);

  const queryArgs = {
    start: start.format('YYYY-MM-DD'),
    end: end.format('YYYY-MM-DD'),
    ...(roleFilter !== 'all' ? { role: roleFilter as OnCallRole } : {}),
  };

  const { data: schedules = [], isLoading } = useGetOnCallScheduleQuery(queryArgs);
  const { data: currentOnCall } = useGetOnCallPersonnelQuery();

  const grouped = useMemo(() => groupByTime(schedules), [schedules]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  const renderGroup = (entries: OnCallScheduleEntry[], emptyText: string) =>
    entries.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
    ) : (
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {entries.map((entry) => (
          <ScheduleRow key={entry.id} entry={entry} />
        ))}
      </Space>
    );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <CalendarOutlined style={{ marginRight: 8 }} />
          On-Call Schedule
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
          See who is on call now and who is scheduled for the coming weeks.
        </Paragraph>
      </div>

      {currentOnCall && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card title={<><InboxOutlined /> Materials — On Call Today</>} size="small">
              {currentOnCall.materials.user ? (
                <Space>
                  <Avatar
                    size={40}
                    src={currentOnCall.materials.user.avatar || undefined}
                    icon={!currentOnCall.materials.user.avatar && <UserOutlined />}
                    style={{ backgroundColor: '#1890ff' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{currentOnCall.materials.user.name}</div>
                    {currentOnCall.materials.user.phone && (
                      <a href={`tel:${currentOnCall.materials.user.phone}`}>
                        <PhoneOutlined /> {currentOnCall.materials.user.phone}
                      </a>
                    )}
                  </div>
                </Space>
              ) : (
                <Text type="secondary">No one currently assigned</Text>
              )}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title={<><ToolOutlined /> Maintenance — On Call Today</>} size="small">
              {currentOnCall.maintenance.user ? (
                <Space>
                  <Avatar
                    size={40}
                    src={currentOnCall.maintenance.user.avatar || undefined}
                    icon={!currentOnCall.maintenance.user.avatar && <UserOutlined />}
                    style={{ backgroundColor: '#fa8c16' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{currentOnCall.maintenance.user.name}</div>
                    {currentOnCall.maintenance.user.phone && (
                      <a href={`tel:${currentOnCall.maintenance.user.phone}`}>
                        <PhoneOutlined /> {currentOnCall.maintenance.user.phone}
                      </a>
                    )}
                  </div>
                </Space>
              ) : (
                <Text type="secondary">No one currently assigned</Text>
              )}
            </Card>
          </Col>
        </Row>
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Text strong>Role:</Text>
          <Segmented
            value={roleFilter}
            onChange={(v) => setRoleFilter(v as RoleFilter)}
            options={[
              { label: 'All', value: 'all' },
              { label: 'Materials', value: 'materials' },
              { label: 'Maintenance', value: 'maintenance' },
            ]}
          />
          <Text strong style={{ marginLeft: 12 }}>Window:</Text>
          <Segmented
            value={windowDays}
            onChange={(v) => setWindowDays(Number(v))}
            options={[
              { label: '30 days', value: 30 },
              { label: '90 days', value: 90 },
              { label: '6 months', value: 180 },
              { label: '1 year', value: 365 },
            ]}
          />
        </Space>
      </Card>

      <Tabs
        defaultActiveKey="upcoming"
        items={[
          {
            key: 'upcoming',
            label: `Upcoming (${grouped.upcoming.length})`,
            children: renderGroup(grouped.upcoming, 'No upcoming schedule entries in this window.'),
          },
          {
            key: 'current',
            label: `Active (${grouped.current.length})`,
            children: renderGroup(grouped.current, 'No active schedule entries.'),
          },
        ]}
      />

      {schedules.length === 0 && (
        <Alert
          type="info"
          showIcon
          message="No scheduled on-call coverage in this window"
          description="An admin can add schedule entries from the Admin → On-Call Schedule tab."
        />
      )}
    </div>
  );
};
