import { useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Typography,
  Space,
  Select,
  Input,
  DatePicker,
  Row,
  Col,
  Empty,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SwapOutlined,
  LoginOutlined,
  WarningOutlined,
  ToolOutlined,
  CalendarOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetToolAuditHistoryQuery } from '../services/checkoutApi';
import type { AuditHistoryQueryParams, ToolHistoryEvent, ToolHistoryEventType } from '../types';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;
const { Search } = Input;

const EVENT_TYPE_OPTIONS: { value: ToolHistoryEventType | ''; label: string }[] = [
  { value: '', label: 'All Event Types' },
  { value: 'checkout', label: 'Checkout' },
  { value: 'return', label: 'Return' },
  { value: 'damage_reported', label: 'Damage Reported' },
  { value: 'damage_resolved', label: 'Damage Resolved' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'maintenance_start', label: 'Maintenance Start' },
  { value: 'maintenance_end', label: 'Maintenance End' },
  { value: 'repair', label: 'Repair' },
  { value: 'status_change', label: 'Status Change' },
  { value: 'retired', label: 'Retired' },
];

const EVENT_COLOR: Record<string, string> = {
  checkout: 'blue',
  return: 'green',
  damage_reported: 'red',
  damage_resolved: 'green',
  calibration: 'purple',
  maintenance_start: 'orange',
  maintenance_end: 'green',
  repair: 'cyan',
  status_change: 'gold',
  retired: 'default',
};

const EVENT_ICON: Record<string, React.ReactNode> = {
  checkout: <SwapOutlined />,
  return: <LoginOutlined />,
  damage_reported: <ExclamationCircleOutlined />,
  damage_resolved: <CheckCircleOutlined />,
  calibration: <CalendarOutlined />,
  maintenance_start: <SettingOutlined />,
  maintenance_end: <CheckCircleOutlined />,
  repair: <ToolOutlined />,
  status_change: <ClockCircleOutlined />,
  retired: <StopOutlined />,
};

const formatEventType = (t: string) =>
  t.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const getEventDetails = (event: ToolHistoryEvent): string => {
  const d = event.details || {};
  const parts: string[] = [];
  if (event.description) parts.push(event.description);
  if (typeof d.work_order === 'string' && d.work_order) parts.push(`WO: ${d.work_order}`);
  if (typeof d.damage_severity === 'string' && d.damage_severity)
    parts.push(`Severity: ${d.damage_severity}`);
  if (typeof d.damage_description === 'string' && d.damage_description)
    parts.push(d.damage_description);
  if (typeof d.notes === 'string' && d.notes) parts.push(d.notes);
  return parts.join(' · ');
};

const PAGE_SIZE = 50;

export const ToolAuditHistoryPage = () => {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState<ToolHistoryEventType | ''>('');
  const [toolSearch, setToolSearch] = useState('');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  const queryParams: AuditHistoryQueryParams = {
    page,
    per_page: PAGE_SIZE,
    ...(eventType && { event_type: eventType }),
    ...(dateRange && { start_date: dateRange[0], end_date: dateRange[1] }),
  };

  const { data, isLoading, isFetching } = useGetToolAuditHistoryQuery(queryParams);

  // Client-side tool number filter (server doesn't have a text search param for tool number)
  const rows = (data?.history ?? []).filter((event) => {
    if (!toolSearch) return true;
    const search = toolSearch.toLowerCase();
    return (
      event.tool_number?.toLowerCase().includes(search) ||
      event.tool_description?.toLowerCase().includes(search)
    );
  });

  const columns: ColumnsType<ToolHistoryEvent> = [
    {
      title: 'Date / Time',
      dataIndex: 'event_date',
      key: 'event_date',
      width: 170,
      render: (v: string) => (
        <Text style={{ whiteSpace: 'nowrap' }}>
          {dayjs(v).format('MMM D, YYYY h:mm A')}
        </Text>
      ),
    },
    {
      title: 'Event',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 160,
      render: (t: ToolHistoryEventType) => (
        <Tag color={EVENT_COLOR[t] ?? 'default'} icon={EVENT_ICON[t]}>
          {formatEventType(t)}
        </Tag>
      ),
    },
    {
      title: 'Tool',
      key: 'tool',
      width: 160,
      render: (_: unknown, record: ToolHistoryEvent) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.tool_number ?? '—'}</Text>
          {record.tool_description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.tool_description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Performed By',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 160,
      render: (v: string) => v ?? <Text type="secondary">—</Text>,
    },
    {
      title: 'Details',
      key: 'details',
      render: (_: unknown, record: ToolHistoryEvent) => {
        const text = getEventDetails(record);
        if (!text) return <Text type="secondary">—</Text>;
        return (
          <Tooltip title={text.length > 80 ? text : undefined}>
            <Text style={{ maxWidth: 320, display: 'inline-block' }} ellipsis>
              {text}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Status Change',
      key: 'status',
      width: 180,
      render: (_: unknown, record: ToolHistoryEvent) => {
        if (!record.old_status && !record.new_status) return null;
        return (
          <Space size={4}>
            {record.old_status && <Tag>{record.old_status}</Tag>}
            {record.old_status && record.new_status && <span>→</span>}
            {record.new_status && (
              <Tag color={record.new_status === 'available' ? 'green' : 'orange'}>
                {record.new_status}
              </Tag>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div data-testid="tool-audit-history-page" style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space align="center">
            <AuditOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0 }}>
              Tool Audit History
            </Title>
          </Space>

          {/* Filters */}
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} sm={12} md={8} lg={6}>
              <Select
                value={eventType}
                onChange={(v) => { setEventType(v); setPage(1); }}
                options={EVENT_TYPE_OPTIONS}
                style={{ width: '100%' }}
                placeholder="Filter by event type"
              />
            </Col>
            <Col xs={24} sm={12} md={10} lg={8}>
              <RangePicker
                style={{ width: '100%' }}
                onChange={(_, strings) => {
                  if (strings[0] && strings[1]) {
                    setDateRange([strings[0], strings[1]]);
                  } else {
                    setDateRange(null);
                  }
                  setPage(1);
                }}
              />
            </Col>
            <Col xs={24} sm={12} md={6} lg={6}>
              <Search
                placeholder="Filter by tool number…"
                allowClear
                onSearch={(v) => { setToolSearch(v); setPage(1); }}
                onChange={(e) => { if (!e.target.value) setToolSearch(''); }}
              />
            </Col>
          </Row>

          {/* Table */}
          <Table<ToolHistoryEvent>
            data-testid="tool-audit-history-table"
            dataSource={rows}
            columns={columns}
            rowKey="id"
            loading={isLoading || isFetching}
            locale={{ emptyText: <Empty description="No history events found" /> }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: data?.total ?? 0,
              onChange: (p) => setPage(p),
              showTotal: (total) => `${total} events`,
              showSizeChanger: false,
            }}
            scroll={{ x: 900 }}
            size="small"
          />
        </Space>
      </Card>
    </div>
  );
};
