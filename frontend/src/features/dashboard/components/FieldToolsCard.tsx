import { Card, Table, Tag, Typography, Space, Badge, Button, Empty, Spin } from 'antd';
import {
  ToolOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useGetActiveKitToolCheckoutsQuery } from '@features/kits/services/kitsApi';
import { useActiveWarehouse } from '@features/warehouses/hooks/useActiveWarehouse';
import type { KitToolCheckout } from '@features/kits/types';

const { Text, Title } = Typography;

export const FieldToolsCard = () => {
  const navigate = useNavigate();
  const { activeWarehouseId } = useActiveWarehouse();

  const { data, isLoading } = useGetActiveKitToolCheckoutsQuery(
    { warehouse_id: activeWarehouseId ?? undefined },
    { skip: !activeWarehouseId }
  );

  const checkouts = data?.checkouts || [];
  const total = data?.total || 0;

  const overdueCount = checkouts.filter(
    (c) =>
      c.expected_return_date && dayjs(c.expected_return_date).isBefore(dayjs(), 'day')
  ).length;

  // Group by kit for the summary row counts
  const kitCounts = checkouts.reduce<Record<string, number>>((acc, c) => {
    const key = c.kit_name || `Kit ${c.kit_id}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const columns: ColumnsType<KitToolCheckout> = [
    {
      title: 'Tool #',
      dataIndex: 'tool_number',
      key: 'tool_number',
      width: 90,
      render: (val) => <Text strong style={{ fontSize: 13 }}>{val}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'tool_description',
      key: 'tool_description',
      ellipsis: true,
      render: (val) => <Text style={{ fontSize: 13 }}>{val}</Text>,
    },
    {
      title: 'Kit',
      dataIndex: 'kit_name',
      key: 'kit_name',
      width: 130,
      render: (val, record) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, height: 'auto', fontSize: 13 }}
          icon={<EnvironmentOutlined />}
          onClick={() => navigate(`/kits/${record.kit_id}?tab=field-tools`)}
        >
          {val}
        </Button>
      ),
    },
    {
      title: 'Since',
      dataIndex: 'checkout_date',
      key: 'checkout_date',
      width: 95,
      render: (val) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {val ? dayjs(val).format('MMM D') : '—'}
        </Text>
      ),
    },
    {
      title: '',
      key: 'overdue',
      width: 32,
      render: (_: unknown, record: KitToolCheckout) => {
        if (
          record.expected_return_date &&
          dayjs(record.expected_return_date).isBefore(dayjs(), 'day')
        ) {
          return (
            <ExclamationCircleOutlined
              style={{ color: '#ff4d4f' }}
              title="Overdue"
            />
          );
        }
        return null;
      },
    },
  ];

  return (
    <Card
      title={
        <Space>
          <ToolOutlined style={{ color: '#fa8c16' }} />
          <Title level={5} style={{ margin: 0 }}>
            Tools in Field
          </Title>
          {total > 0 && (
            <Badge
              count={total}
              style={{ backgroundColor: overdueCount > 0 ? '#ff4d4f' : '#fa8c16' }}
            />
          )}
        </Space>
      }
      extra={
        <Button
          type="link"
          size="small"
          icon={<ArrowRightOutlined />}
          onClick={() => navigate('/kits')}
        >
          View Kits
        </Button>
      }
      styles={{ body: { padding: '0 0 8px 0' } }}
    >
      {isLoading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : total === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No tools currently deployed to field kits"
          style={{ padding: '16px 0' }}
        />
      ) : (
        <>
          {/* Kit summary chips */}
          <div style={{ padding: '8px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(kitCounts).map(([kitName, count]) => (
              <Tag key={kitName} icon={<EnvironmentOutlined />} color="orange">
                {kitName}: {count} tool{count !== 1 ? 's' : ''}
              </Tag>
            ))}
            {overdueCount > 0 && (
              <Tag icon={<ExclamationCircleOutlined />} color="red">
                {overdueCount} overdue
              </Tag>
            )}
          </div>

          <Table<KitToolCheckout>
            columns={columns}
            dataSource={checkouts}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ y: 220 }}
            showHeader={total > 3}
            style={{ fontSize: 13 }}
          />
        </>
      )}
    </Card>
  );
};

export default FieldToolsCard;
