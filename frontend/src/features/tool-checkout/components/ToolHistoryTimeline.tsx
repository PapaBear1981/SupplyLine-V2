import { useState } from 'react';
import {
  Card,
  Timeline,
  Tag,
  Typography,
  Space,
  Select,
  Spin,
  Empty,
  Pagination,
  Descriptions,
  Statistic,
  Row,
  Col,
} from 'antd';
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetToolTimelineQuery } from '../services/checkoutApi';
import type { ToolHistoryEventType, ToolHistoryEvent } from '../types';

const { Text, Title } = Typography;

interface ToolHistoryTimelineProps {
  toolId: number;
}

const eventTypeOptions: { value: ToolHistoryEventType | ''; label: string }[] = [
  { value: '', label: 'All Events' },
  { value: 'checkout', label: 'Checkouts' },
  { value: 'return', label: 'Returns' },
  { value: 'damage_reported', label: 'Damage Reports' },
  { value: 'calibration', label: 'Calibrations' },
  { value: 'maintenance_start', label: 'Maintenance Start' },
  { value: 'maintenance_end', label: 'Maintenance End' },
  { value: 'repair', label: 'Repairs' },
  { value: 'status_change', label: 'Status Changes' },
];

const getEventIcon = (eventType: ToolHistoryEventType) => {
  switch (eventType) {
    case 'checkout':
      return <SwapOutlined />;
    case 'return':
      return <LoginOutlined />;
    case 'damage_reported':
      return <ExclamationCircleOutlined />;
    case 'damage_resolved':
      return <CheckCircleOutlined />;
    case 'calibration':
      return <CalendarOutlined />;
    case 'maintenance_start':
      return <SettingOutlined />;
    case 'maintenance_end':
      return <CheckCircleOutlined />;
    case 'repair':
      return <ToolOutlined />;
    case 'status_change':
      return <ClockCircleOutlined />;
    case 'retired':
      return <StopOutlined />;
    default:
      return <ClockCircleOutlined />;
  }
};

const getEventColor = (eventType: ToolHistoryEventType) => {
  switch (eventType) {
    case 'checkout':
      return 'blue';
    case 'return':
      return 'green';
    case 'damage_reported':
      return 'red';
    case 'damage_resolved':
      return 'green';
    case 'calibration':
      return 'purple';
    case 'maintenance_start':
      return 'orange';
    case 'maintenance_end':
      return 'green';
    case 'repair':
      return 'cyan';
    case 'status_change':
      return 'gold';
    case 'retired':
      return 'gray';
    default:
      return 'gray';
  }
};

const formatEventType = (eventType: ToolHistoryEventType) => {
  return eventType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const ToolHistoryTimeline = ({ toolId }: ToolHistoryTimelineProps) => {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState<ToolHistoryEventType | ''>('');

  const { data, isLoading, isFetching } = useGetToolTimelineQuery({
    toolId,
    params: {
      page,
      per_page: 20,
      event_type: eventType || undefined,
    },
  });

  const renderEventDetails = (event: ToolHistoryEvent) => {
    const details = event.details || {};

    return (
      <div style={{ marginTop: 8 }}>
        {/* Status changes */}
        {event.old_status && event.new_status && (
          <div>
            <Text type="secondary">Status: </Text>
            <Tag>{event.old_status}</Tag>
            <span style={{ margin: '0 4px' }}>→</span>
            <Tag color={event.new_status === 'available' ? 'green' : 'orange'}>
              {event.new_status}
            </Tag>
          </div>
        )}

        {/* Condition changes */}
        {event.old_condition && event.new_condition && (
          <div>
            <Text type="secondary">Condition: </Text>
            <Tag>{event.old_condition}</Tag>
            <span style={{ margin: '0 4px' }}>→</span>
            <Tag
              color={
                event.new_condition === 'Damaged'
                  ? 'red'
                  : event.new_condition === 'Good' || event.new_condition === 'New'
                  ? 'green'
                  : 'default'
              }
            >
              {event.new_condition}
            </Tag>
          </div>
        )}

        {/* Additional details from JSON */}
        {typeof details.checkout_user_name === 'string' && details.checkout_user_name && (
          <Text type="secondary">
            Checked out to: {details.checkout_user_name}
          </Text>
        )}
        {typeof details.work_order === 'string' && details.work_order && (
          <div>
            <Text type="secondary">Work Order: {details.work_order}</Text>
          </div>
        )}
        {typeof details.damage_severity === 'string' && details.damage_severity && (
          <div>
            <Tag
              color={
                details.damage_severity === 'severe' ||
                details.damage_severity === 'unusable'
                  ? 'red'
                  : 'orange'
              }
            >
              {details.damage_severity.toUpperCase()}
            </Tag>
          </div>
        )}
        {typeof details.damage_description === 'string' && details.damage_description && (
          <div>
            <Text type="secondary">{details.damage_description}</Text>
          </div>
        )}
        {typeof details.notes === 'string' && details.notes && (
          <div>
            <Text type="secondary" italic>
              {details.notes}
            </Text>
          </div>
        )}
      </div>
    );
  };

  const timelineItems = (data?.timeline || []).map((event) => ({
    color: getEventColor(event.event_type),
    dot: getEventIcon(event.event_type),
    children: (
      <div>
        <Space>
          <Tag color={getEventColor(event.event_type)}>
            {formatEventType(event.event_type)}
          </Tag>
          <Text type="secondary">
            {dayjs(event.event_date).format('MMM D, YYYY h:mm A')}
          </Text>
        </Space>
        <div style={{ marginTop: 4 }}>
          <Text strong>{event.description}</Text>
        </div>
        <div>
          <Text type="secondary">By {event.user_name}</Text>
        </div>
        {renderEventDetails(event)}
      </div>
    ),
  }));

  return (
    <Card>
      {/* Tool Info Header */}
      {data?.tool && (
        <div
          style={{
            background: '#f5f5f5',
            padding: 16,
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            {data.tool.tool_number}
          </Title>
          <Text type="secondary">{data.tool.serial_number}</Text>
          <div style={{ marginTop: 8 }}>
            <Text>{data.tool.description}</Text>
          </div>
          <div style={{ marginTop: 8 }}>
            <Tag
              color={
                data.tool.status === 'available'
                  ? 'green'
                  : data.tool.status === 'checked_out'
                  ? 'blue'
                  : 'orange'
              }
            >
              {data.tool.status}
            </Tag>
            <Tag>{data.tool.condition}</Tag>
            {data.tool.calibration_status !== 'not_applicable' && (
              <Tag
                color={
                  data.tool.calibration_status === 'current'
                    ? 'green'
                    : data.tool.calibration_status === 'due_soon'
                    ? 'orange'
                    : 'red'
                }
              >
                Cal: {data.tool.calibration_status}
              </Tag>
            )}
          </div>
        </div>
      )}

      {/* Statistics */}
      {data?.stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Statistic
              title="Total Checkouts"
              value={data.stats.total_checkouts}
              prefix={<SwapOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Damage Reports"
              value={data.stats.damage_reports}
              prefix={<WarningOutlined />}
              valueStyle={{
                color: data.stats.damage_reports > 0 ? '#ff4d4f' : undefined,
              }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Calibrations"
              value={data.stats.calibrations}
              prefix={<CalendarOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Service Records"
              value={data.stats.service_records}
              prefix={<SettingOutlined />}
            />
          </Col>
        </Row>
      )}

      {/* Active Checkout Indicator */}
      {data?.stats?.active_checkout && (
        <Descriptions
          bordered
          size="small"
          style={{ marginBottom: 24 }}
          title={
            <Tag color="processing" icon={<ClockCircleOutlined />}>
              Currently Checked Out
            </Tag>
          }
        >
          <Descriptions.Item label="Status">
            This tool is currently checked out
          </Descriptions.Item>
        </Descriptions>
      )}

      {/* Filter */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text>Filter by event type:</Text>
          <Select
            value={eventType}
            onChange={(value) => {
              setEventType(value);
              setPage(1);
            }}
            options={eventTypeOptions}
            style={{ width: 200 }}
          />
        </Space>
      </div>

      {/* Timeline */}
      {isLoading || isFetching ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" tip="Loading timeline..." />
        </div>
      ) : timelineItems.length > 0 ? (
        <>
          <Timeline items={timelineItems} />
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Pagination
              current={page}
              pageSize={20}
              total={data?.total || 0}
              onChange={setPage}
              showSizeChanger={false}
              showTotal={(total) => `Total ${total} events`}
            />
          </div>
        </>
      ) : (
        <Empty description="No history events found" />
      )}
    </Card>
  );
};
