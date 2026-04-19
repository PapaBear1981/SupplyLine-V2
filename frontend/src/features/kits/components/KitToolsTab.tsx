import { useState } from 'react';
import {
  Button,
  Table,
  Tag,
  Space,
  Typography,
  Tooltip,
  Modal,
  Form,
  Input,
  message,
  Switch,
  Empty,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  RollbackOutlined,
  HistoryOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useGetKitToolCheckoutsQuery, useReturnToolFromKitMutation } from '../services/kitsApi';
import type { KitToolCheckout } from '../types';
import SendToKitModal from './SendToKitModal';

const { Text } = Typography;
const { TextArea } = Input;

interface KitToolsTabProps {
  kitId: number;
  kitName: string;
}

const KitToolsTab = ({ kitId, kitName }: KitToolsTabProps) => {
  const [showHistory, setShowHistory] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [returningCheckout, setReturningCheckout] = useState<KitToolCheckout | null>(null);
  const [returnForm] = Form.useForm();

  const { data, isLoading, refetch } = useGetKitToolCheckoutsQuery({
    kitId,
    include_returned: showHistory,
  });

  const [returnTool, { isLoading: isReturning }] = useReturnToolFromKitMutation();

  const checkouts = data?.checkouts || [];

  const handleReturn = (record: KitToolCheckout) => {
    setReturningCheckout(record);
    returnForm.resetFields();
  };

  const confirmReturn = async () => {
    if (!returningCheckout) return;
    try {
      const values = await returnForm.validateFields();
      await returnTool({
        checkoutId: returningCheckout.id,
        data: { return_notes: values.return_notes },
      }).unwrap();
      message.success(
        `Tool ${returningCheckout.tool_number} returned to ${returningCheckout.previous_location || 'hangar'}`
      );
      setReturningCheckout(null);
      refetch();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err?.data?.error || 'Failed to return tool');
    }
  };

  const columns: ColumnsType<KitToolCheckout> = [
    {
      title: 'Tool #',
      dataIndex: 'tool_number',
      key: 'tool_number',
      render: (val) => <Text strong>{val}</Text>,
      width: 110,
    },
    {
      title: 'Description',
      dataIndex: 'tool_description',
      key: 'tool_description',
      ellipsis: true,
    },
    {
      title: 'Serial #',
      dataIndex: 'tool_serial_number',
      key: 'tool_serial_number',
      width: 130,
    },
    {
      title: 'Condition',
      dataIndex: 'tool_condition',
      key: 'tool_condition',
      width: 110,
      render: (val) => {
        if (!val) return '—';
        const color =
          val.toLowerCase() === 'good'
            ? 'green'
            : val.toLowerCase() === 'fair'
            ? 'orange'
            : 'red';
        return <Tag color={color}>{val}</Tag>;
      },
    },
    {
      title: 'Sent By',
      dataIndex: 'checked_out_by_name',
      key: 'checked_out_by_name',
      width: 140,
    },
    {
      title: 'Date Sent',
      dataIndex: 'checkout_date',
      key: 'checkout_date',
      width: 140,
      render: (val) => (val ? dayjs(val).format('MMM D, YYYY') : '—'),
      sorter: (a, b) =>
        dayjs(a.checkout_date).valueOf() - dayjs(b.checkout_date).valueOf(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Expected Return',
      dataIndex: 'expected_return_date',
      key: 'expected_return_date',
      width: 140,
      render: (val, record) => {
        if (!val) return '—';
        const isOverdue =
          record.status === 'active' && dayjs(val).isBefore(dayjs(), 'day');
        return (
          <Text type={isOverdue ? 'danger' : undefined}>
            {isOverdue && (
              <Tooltip title="Overdue">
                <ExclamationCircleOutlined style={{ marginRight: 4, color: '#ff4d4f' }} />
              </Tooltip>
            )}
            {dayjs(val).format('MMM D, YYYY')}
          </Text>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val, record) => {
        if (val === 'returned') {
          return <Tag color="default">Returned</Tag>;
        }
        const isOverdue =
          record.expected_return_date &&
          dayjs(record.expected_return_date).isBefore(dayjs(), 'day');
        return <Tag color={isOverdue ? 'red' : 'green'}>In Field{isOverdue ? ' (Overdue)' : ''}</Tag>;
      },
    },
    {
      title: 'Return Location',
      dataIndex: 'previous_location',
      key: 'previous_location',
      ellipsis: true,
      render: (val) =>
        val ? (
          <Space size={4}>
            <EnvironmentOutlined style={{ color: '#8c8c8c' }} />
            <Text type="secondary">{val}</Text>
          </Space>
        ) : (
          '—'
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: unknown, record: KitToolCheckout) => {
        if (record.status === 'returned') {
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Returned {record.return_date ? dayjs(record.return_date).format('MMM D') : ''}
            </Text>
          );
        }
        return (
          <Tooltip title={`Return to ${record.previous_location || 'hangar'}`}>
            <Button
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleReturn(record)}
            >
              Return
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  const activeCount = checkouts.filter((c) => c.status === 'active').length;

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            Tools in Field
          </Text>
          {activeCount > 0 && (
            <Tag color="blue">{activeCount} active</Tag>
          )}
        </Space>
        <Space>
          <Space size={8}>
            <Text type="secondary">Show history</Text>
            <Switch
              size="small"
              checked={showHistory}
              onChange={setShowHistory}
              checkedChildren={<HistoryOutlined />}
            />
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsSendModalOpen(true)}
          >
            Send Tool to Kit
          </Button>
        </Space>
      </div>

      {activeCount === 0 && !showHistory && (
        <Alert
          type="info"
          showIcon
          message="No tools are currently deployed to this kit."
          style={{ marginBottom: 16 }}
        />
      )}

      <Table<KitToolCheckout>
        columns={columns}
        dataSource={checkouts}
        rowKey="id"
        loading={isLoading}
        size="small"
        scroll={{ x: 1000 }}
        pagination={{
          pageSize: 20,
          showSizeChanger: false,
          showTotal: (total) => `${total} record${total !== 1 ? 's' : ''}`,
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={showHistory ? 'No tool deployment history' : 'No tools in field'}
            />
          ),
        }}
        rowClassName={(record) => {
          if (record.status === 'returned') return 'ant-table-row-muted';
          if (
            record.expected_return_date &&
            dayjs(record.expected_return_date).isBefore(dayjs(), 'day')
          )
            return 'ant-table-row-warning';
          return '';
        }}
      />

      {/* Send to Kit Modal */}
      <SendToKitModal
        visible={isSendModalOpen}
        kitId={kitId}
        kitName={kitName}
        onClose={() => {
          setIsSendModalOpen(false);
          refetch();
        }}
      />

      {/* Return Confirmation Modal */}
      <Modal
        title={
          <Space>
            <RollbackOutlined />
            Return Tool from Kit
          </Space>
        }
        open={!!returningCheckout}
        onOk={confirmReturn}
        onCancel={() => setReturningCheckout(null)}
        okText="Confirm Return"
        confirmLoading={isReturning}
        width={480}
        destroyOnClose
      >
        {returningCheckout && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Alert
              type="info"
              showIcon
              message={
                <>
                  Returning <Text strong>{returningCheckout.tool_number}</Text> to{' '}
                  <Text strong>
                    {returningCheckout.previous_location || 'hangar'}
                  </Text>
                  . The tool will be marked as available.
                </>
              }
            />
            <Form form={returnForm} layout="vertical">
              <Form.Item name="return_notes" label="Return Notes (optional)">
                <TextArea
                  rows={3}
                  placeholder="Condition on return, any issues to note, etc."
                  maxLength={500}
                  showCount
                />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default KitToolsTab;
