/**
 * AI Alerts List Component
 *
 * Displays active AI alerts with severity indicators and action buttons.
 */
import { Table, Tag, Button, Space, Tooltip, Typography, Empty } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  useGetAIAlertsQuery,
  useAcknowledgeAlertMutation,
  useResolveAlertMutation,
  useDismissAlertMutation,
} from '../services/aiApi';
import type { AIAlert } from '../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

const severityConfig = {
  critical: { color: 'red', icon: <CloseCircleOutlined /> },
  warning: { color: 'orange', icon: <ExclamationCircleOutlined /> },
  info: { color: 'blue', icon: <InfoCircleOutlined /> },
};

const statusColors: Record<string, string> = {
  active: 'red',
  acknowledged: 'orange',
  resolved: 'green',
  dismissed: 'default',
};

interface AIAlertsListProps {
  limit?: number;
  compact?: boolean;
  statusFilter?: string;
}

export const AIAlertsList = ({ limit = 20, compact = false, statusFilter = 'active' }: AIAlertsListProps) => {
  const { data, isLoading, refetch } = useGetAIAlertsQuery({
    status: statusFilter,
    limit,
  });
  const [acknowledgeAlert] = useAcknowledgeAlertMutation();
  const [resolveAlert] = useResolveAlertMutation();
  const [dismissAlert] = useDismissAlertMutation();

  const columns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: AIAlert['severity']) => {
        const config = severityConfig[severity];
        return (
          <Tag color={config.color} icon={config.icon}>
            {severity.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Alert',
      key: 'alert',
      render: (_: unknown, record: AIAlert) => (
        <div>
          <Text strong>{record.title}</Text>
          {!compact && (
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.description.length > 150
                  ? `${record.description.substring(0, 150)}...`
                  : record.description}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string) => <Tag>{category}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => (
        <Tag color={statusColors[status] || 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      render: (val: string) => (
        <Tooltip title={dayjs(val).format('YYYY-MM-DD HH:mm:ss')}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(val).fromNow()}
          </Text>
        </Tooltip>
      ),
    },
    ...(statusFilter === 'active'
      ? [
          {
            title: 'Actions',
            key: 'actions',
            width: 160,
            render: (_: unknown, record: AIAlert) => (
              <Space size="small">
                <Tooltip title="Acknowledge">
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => acknowledgeAlert(record.id)}
                  />
                </Tooltip>
                <Tooltip title="Resolve">
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => resolveAlert(record.id)}
                  />
                </Tooltip>
                <Tooltip title="Dismiss">
                  <Button
                    size="small"
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => dismissAlert(record.id)}
                  />
                </Tooltip>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <Table
      dataSource={data?.alerts || []}
      columns={columns}
      rowKey="id"
      loading={isLoading}
      size="small"
      pagination={compact ? false : { pageSize: 10 }}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No alerts"
          />
        ),
      }}
    />
  );
};
