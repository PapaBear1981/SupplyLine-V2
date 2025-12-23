import React, { useState } from 'react';
import {
  Modal,
  Descriptions,
  Tag,
  Space,
  Button,
  Spin,
  Alert,
  Typography,
  Card,
  Timeline,
  message,
  Popconfirm,
  Table,
  Badge,
  Form,
  Input,
  Select,
} from 'antd';
import {
  CloseOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import {
  useGetRequestQuery,
  useUpdateRequestMutation,
  useCancelRequestMutation,
} from '../services/requestsApi';
import type { RequestItem } from '../types';
import { StatusBadge, PriorityBadge, ItemTypeBadge } from './';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface RequestDetailModalProps {
  open: boolean;
  requestId: number;
  onClose: () => void;
}

export const RequestDetailModal = ({ open, requestId, onClose }: RequestDetailModalProps) => {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm] = Form.useForm();

  const { data: request, isLoading, error } = useGetRequestQuery(requestId, {
    skip: !open || !requestId,
  });

  const [updateRequest, { isLoading: isUpdating }] = useUpdateRequestMutation();
  const [cancelRequest, { isLoading: isCancelling }] = useCancelRequestMutation();

  const handleEdit = () => {
    if (request) {
      editForm.setFieldsValue({
        title: request.title,
        description: request.description,
        priority: request.priority,
        notes: request.notes,
      });
      setEditModalVisible(true);
    }
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      await updateRequest({ requestId, updates: values }).unwrap();
      message.success('Request updated successfully!');
      setEditModalVisible(false);
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to update request');
    }
  };

  const handleCancel = async () => {
    try {
      await cancelRequest(requestId).unwrap();
      message.success('Request cancelled successfully!');
      onClose();
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to cancel request');
    }
  };

  const renderActions = () => {
    if (!request) return null;

    const actions: React.ReactElement[] = [];

    // Edit button - available for non-completed requests
    if (!['received', 'cancelled'].includes(request.status)) {
      actions.push(
        <Button
          key="edit"
          icon={<EditOutlined />}
          onClick={handleEdit}
        >
          Edit
        </Button>
      );
    }

    // Cancel button - available for non-completed requests
    if (!['received', 'cancelled'].includes(request.status)) {
      actions.push(
        <Popconfirm
          key="cancel"
          title="Are you sure you want to cancel this request?"
          onConfirm={handleCancel}
          okText="Yes"
          cancelText="No"
        >
          <Button icon={<CloseOutlined />} loading={isCancelling} danger>
            Cancel
          </Button>
        </Popconfirm>
      );
    }

    return actions;
  };

  const renderTimeline = () => {
    if (!request) return null;

    const items = [
      {
        color: 'green',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Request Created</Text>
            <Text type="secondary">
              {dayjs(request.created_at).format('MMM D, YYYY h:mm A')}
            </Text>
            <Text>By: {request.requester ? `${request.requester.first_name} ${request.requester.last_name}` : 'Unknown'}</Text>
          </Space>
        ),
      },
    ];

    // Add status-based timeline items
    if (request.status === 'awaiting_info') {
      items.push({
        color: 'orange',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Awaiting Information</Text>
            <Text type="secondary">More information needed</Text>
          </Space>
        ),
      });
    }

    if (['in_progress', 'partially_ordered', 'ordered', 'partially_received', 'received'].includes(request.status)) {
      items.push({
        color: 'blue',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>In Progress</Text>
            <Text type="secondary">Request being processed</Text>
          </Space>
        ),
      });
    }

    if (['partially_ordered', 'ordered', 'partially_received', 'received'].includes(request.status)) {
      items.push({
        color: 'blue',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Ordered</Text>
            <Text type="secondary">Items have been ordered</Text>
            {request.buyer && <Text>By: {request.buyer.first_name} {request.buyer.last_name}</Text>}
          </Space>
        ),
      });
    }

    if (['partially_received', 'received'].includes(request.status)) {
      items.push({
        color: request.status === 'received' ? 'green' : 'cyan',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>{request.status === 'received' ? 'Received' : 'Partially Received'}</Text>
            <Text type="secondary">
              {request.status === 'received' ? 'All items received' : 'Some items received'}
            </Text>
          </Space>
        ),
      });
    }

    if (request.status === 'cancelled') {
      items.push({
        color: 'red',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Cancelled</Text>
            <Text type="secondary">Request cancelled</Text>
          </Space>
        ),
      });
    }

    return <Timeline items={items} />;
  };

  const itemColumns: ColumnsType<RequestItem> = [
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      width: 100,
      render: (type) => type && <ItemTypeBadge type={type} />,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Part Number',
      dataIndex: 'part_number',
      key: 'part_number',
      width: 120,
      render: (pn) => pn || '-',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      render: (qty, record) => (
        <Space>
          <Badge
            count={qty || 1}
            showZero
            overflowCount={Infinity}
            style={{ backgroundColor: '#1890ff' }}
          />
          <Text type="secondary">{record.unit || 'each'}</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => <StatusBadge status={status} type="item" />,
    },
  ];

  return (
    <>
      <Modal
        title={
          <Space>
            <InfoCircleOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0 }}>
              Request Details
            </Title>
          </Space>
        }
        open={open}
        onCancel={onClose}
        width={1000}
        footer={[
          <Button key="close" onClick={onClose}>
            Close
          </Button>,
          ...(renderActions() || []),
        ]}
      >
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        )}

        {error && (
          <Alert
            message="Error"
            description="Failed to load request details. Please try again."
            type="error"
            showIcon
          />
        )}

        {request && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* Status Alerts */}
            {request.priority === 'critical' && request.status !== 'received' && (
              <Alert
                message="Critical Priority"
                description="This request has been marked as critical and requires immediate attention."
                type="error"
                showIcon
                icon={<WarningOutlined />}
              />
            )}

            {request.needs_more_info && (
              <Alert
                message="Needs More Information"
                description="Additional information is required to process this request."
                type="warning"
                showIcon
                icon={<InfoCircleOutlined />}
              />
            )}

            {request.is_late && (
              <Alert
                message="Overdue Request"
                description={`This request is ${request.days_overdue} day${request.days_overdue !== 1 ? 's' : ''} overdue.`}
                type="error"
                showIcon
                icon={<WarningOutlined />}
              />
            )}

            {/* Request Information */}
            <Card title="Request Information">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Request Number" span={2}>
                  <Text strong style={{ fontSize: 16 }}>{request.request_number}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Title" span={2}>
                  <Text strong>{request.title}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <StatusBadge status={request.status} type="request" />
                </Descriptions.Item>
                <Descriptions.Item label="Priority">
                  <PriorityBadge priority={request.priority} />
                </Descriptions.Item>
                <Descriptions.Item label="Requester">
                  {request.requester
                    ? `${request.requester.first_name} ${request.requester.last_name}`
                    : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Buyer">
                  {request.buyer
                    ? `${request.buyer.first_name} ${request.buyer.last_name}`
                    : 'Not assigned'}
                </Descriptions.Item>
                {request.description && (
                  <Descriptions.Item label="Description" span={2}>
                    {request.description}
                  </Descriptions.Item>
                )}
                {request.notes && (
                  <Descriptions.Item label="Notes" span={2}>
                    {request.notes}
                  </Descriptions.Item>
                )}
                {request.expected_due_date && (
                  <Descriptions.Item label="Expected Due Date" span={2}>
                    <Space>
                      {dayjs(request.expected_due_date).format('MMM D, YYYY')}
                      {request.is_late && <Tag color="red">Overdue</Tag>}
                      {request.due_soon && !request.is_late && <Tag color="orange">Due Soon</Tag>}
                    </Space>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Created At">
                  {dayjs(request.created_at).format('MMM D, YYYY h:mm A')}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {dayjs(request.updated_at).format('MMM D, YYYY h:mm A')}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Items */}
            <Card title={
              <Space>
                <Text strong>Requested Items</Text>
                <Badge count={request.items?.length || 0} showZero />
              </Space>
            }>
              <Table
                columns={itemColumns}
                dataSource={request.items || []}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>

            {/* Timeline */}
            <Card title="Request Timeline">{renderTimeline()}</Card>
          </Space>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit Request"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={isUpdating}
            onClick={handleSaveEdit}
          >
            Save Changes
          </Button>,
        ]}
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="priority" label="Priority">
            <Select>
              <Select.Option value="low">Low</Select.Option>
              <Select.Option value="normal">Normal</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="critical">Critical</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
