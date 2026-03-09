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
  Divider,
  Tooltip,
} from 'antd';
import {
  CloseOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  EditOutlined,
  ToolOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import {
  useGetRequestQuery,
  useUpdateRequestMutation,
  useCancelRequestMutation,
} from '../services/requestsApi';
import { useGetOrdersByRequestQuery } from '../services/ordersApi';
import type { RequestItem, ProcurementOrder } from '../types';
import { StatusBadge, PriorityBadge, ItemTypeBadge } from './';

const { Title, Text } = Typography;
const { TextArea } = Input;

const REQUEST_TYPE_LABELS: Record<string, string> = {
  manual: 'Manual',
  kit_replenishment: 'Kit Replenishment',
  warehouse_replenishment: 'Warehouse Replenishment',
  transfer: 'Transfer',
  repairable_return: 'Repairable Return',
};

const REQUEST_TYPE_COLORS: Record<string, string> = {
  manual: 'default',
  kit_replenishment: 'blue',
  warehouse_replenishment: 'cyan',
  transfer: 'geekblue',
  repairable_return: 'purple',
};

const RETURN_STATUS_LABELS: Record<string, string> = {
  issued_core_expected: 'Core Expected',
  in_return_transit: 'In Transit',
  returned_to_stores: 'Returned to Stores',
  closed: 'Closed',
};

const RETURN_STATUS_COLORS: Record<string, string> = {
  issued_core_expected: 'orange',
  in_return_transit: 'blue',
  returned_to_stores: 'green',
  closed: 'default',
};

const FULFILLMENT_ACTION_LABELS: Record<string, string> = {
  issue_from_stock: 'Issue from Stock',
  transfer_from_kit: 'Transfer from Kit',
  external_procurement: 'External Procurement',
  return_to_stock: 'Return to Stock',
  partial_issue: 'Partial Issue',
};

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

  const { data: fulfillmentActions = [], isLoading: isLoadingActions } = useGetOrdersByRequestQuery(
    requestId,
    { skip: !open || !requestId }
  );

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

    const closedStatuses = ['received', 'cancelled', 'fulfilled', 'closed'];
    const actions: React.ReactElement[] = [];

    if (!closedStatuses.includes(request.status)) {
      actions.push(
        <Button key="edit" icon={<EditOutlined />} onClick={handleEdit}>
          Edit
        </Button>
      );
    }

    if (!closedStatuses.includes(request.status)) {
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
            <Text>
              By:{' '}
              {request.requester_name ||
                (request.requester
                  ? `${request.requester.first_name} ${request.requester.last_name}`
                  : 'Unknown')}
            </Text>
          </Space>
        ),
      },
    ];

    if (['needs_info', 'awaiting_info'].includes(request.status)) {
      items.push({
        color: 'orange',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Needs Information</Text>
            <Text type="secondary">Additional information required</Text>
          </Space>
        ),
      });
    }

    if (
      ['under_review', 'pending_fulfillment', 'in_progress', 'assigned', 'sourcing'].includes(
        request.status
      )
    ) {
      items.push({
        color: 'blue',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>In Progress</Text>
            <Text type="secondary">Request being processed by fulfillment staff</Text>
          </Space>
        ),
      });
    }

    if (['in_transfer', 'ordered', 'shipped'].includes(request.status)) {
      items.push({
        color: 'geekblue',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>In Transfer</Text>
            <Text type="secondary">Items in transit to destination</Text>
          </Space>
        ),
      });
    }

    if (['partially_fulfilled', 'partially_ordered', 'partially_received'].includes(request.status)) {
      items.push({
        color: 'lime',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Partially Fulfilled</Text>
            <Text type="secondary">Some items have been fulfilled</Text>
          </Space>
        ),
      });
    }

    if (['fulfilled', 'received'].includes(request.status)) {
      items.push({
        color: 'green',
        children: (
          <Space direction="vertical" size={0}>
            <Text strong>Fulfilled</Text>
            <Text type="secondary">All items fulfilled</Text>
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

  const fulfillmentColumns: ColumnsType<ProcurementOrder> = [
    {
      title: 'Order #',
      dataIndex: 'order_number',
      key: 'order_number',
      width: 120,
      render: (num: string) => <Text strong>{num}</Text>,
    },
    {
      title: 'Action Type',
      dataIndex: 'fulfillment_action_type',
      key: 'fulfillment_action_type',
      width: 160,
      render: (type: string) =>
        type ? (
          <Tag color="blue">{FULFILLMENT_ACTION_LABELS[type] || type}</Tag>
        ) : (
          <Tag>Standard</Tag>
        ),
    },
    {
      title: 'Source',
      dataIndex: 'source_location',
      key: 'source_location',
      width: 140,
      ellipsis: true,
      render: (loc: string) => loc || '-',
    },
    {
      title: 'Qty Fulfilled',
      dataIndex: 'fulfillment_quantity',
      key: 'fulfillment_quantity',
      width: 110,
      render: (qty: number, record: ProcurementOrder) =>
        qty != null ? (
          <Badge
            count={qty}
            showZero
            overflowCount={Infinity}
            style={{ backgroundColor: '#52c41a' }}
          />
        ) : record.quantity ? (
          <Badge
            count={record.quantity}
            showZero
            overflowCount={Infinity}
            style={{ backgroundColor: '#1890ff' }}
          />
        ) : (
          '-'
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: 'Assigned To',
      dataIndex: 'buyer_name',
      key: 'buyer_name',
      width: 130,
      ellipsis: true,
      render: (name: string) => name || '-',
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 110,
      render: (date: string) => dayjs(date).format('MMM D, YYYY'),
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
        width={1100}
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
            {['aog', 'critical'].includes(request.priority) &&
              !['fulfilled', 'received', 'cancelled'].includes(request.status) && (
                <Alert
                  message="AOG Priority"
                  description="This request is AOG (Aircraft on Ground) and requires immediate attention."
                  type="error"
                  showIcon
                  icon={<WarningOutlined />}
                />
              )}

            {['needs_info', 'awaiting_info'].includes(request.status) && (
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
                  <Text strong style={{ fontSize: 16 }}>
                    {request.request_number}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Title" span={2}>
                  <Space>
                    <Text strong>{request.title}</Text>
                    {request.repairable && (
                      <Tooltip title="Repairable item — core return may be required">
                        <Tag color="purple" icon={<ToolOutlined />}>
                          Repairable
                        </Tag>
                      </Tooltip>
                    )}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <StatusBadge status={request.status} type="request" />
                </Descriptions.Item>
                <Descriptions.Item label="Priority">
                  <PriorityBadge priority={request.priority} />
                </Descriptions.Item>
                <Descriptions.Item label="Request Type">
                  {request.request_type ? (
                    <Tag color={REQUEST_TYPE_COLORS[request.request_type] || 'default'}>
                      {REQUEST_TYPE_LABELS[request.request_type] || request.request_type}
                    </Tag>
                  ) : (
                    <Tag>Manual</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Requester">
                  {request.requester_name ||
                    (request.requester
                      ? `${request.requester.first_name} ${request.requester.last_name}`
                      : '-')}
                </Descriptions.Item>
                {request.destination_location && (
                  <Descriptions.Item label="Destination">
                    {request.destination_location}
                  </Descriptions.Item>
                )}
                {request.destination_type && !request.destination_location && (
                  <Descriptions.Item label="Destination">
                    {request.destination_type.replace(/_/g, ' ')}
                  </Descriptions.Item>
                )}
                {request.external_reference && (
                  <Descriptions.Item label="External Reference">
                    {request.external_reference}
                  </Descriptions.Item>
                )}
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
                  <Descriptions.Item label="Due Date" span={2}>
                    <Space>
                      {dayjs(request.expected_due_date).format('MMM D, YYYY')}
                      {request.is_late && <Tag color="red">Overdue</Tag>}
                      {request.due_soon && !request.is_late && (
                        <Tag color="orange">Due Soon</Tag>
                      )}
                    </Space>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Created">
                  {dayjs(request.created_at).format('MMM D, YYYY h:mm A')}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {dayjs(request.updated_at).format('MMM D, YYYY h:mm A')}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Repairable / Core Return */}
            {(request.repairable || request.return_status) && (
              <Card
                title={
                  <Space>
                    <ToolOutlined style={{ color: '#722ed1' }} />
                    <span>Core Return Tracking</span>
                  </Space>
                }
              >
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="Return Status">
                    {request.return_status ? (
                      <Tag color={RETURN_STATUS_COLORS[request.return_status] || 'default'}>
                        {RETURN_STATUS_LABELS[request.return_status] || request.return_status}
                      </Tag>
                    ) : (
                      <Tag color="orange">Core Expected</Tag>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Core Required">
                    {request.core_required ? (
                      <Tag color="red">Yes</Tag>
                    ) : (
                      <Tag>No</Tag>
                    )}
                  </Descriptions.Item>
                  {request.return_destination && (
                    <Descriptions.Item label="Return Destination" span={2}>
                      {request.return_destination}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}

            {/* Items */}
            <Card
              title={
                <Space>
                  <Text strong>Requested Items</Text>
                  <Badge count={request.items?.length || 0} showZero />
                </Space>
              }
            >
              <Table
                columns={itemColumns}
                dataSource={request.items || []}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>

            {/* Fulfillment Actions */}
            <Card
              title={
                <Space>
                  <ApartmentOutlined style={{ color: '#1890ff' }} />
                  <Text strong>Fulfillment Actions</Text>
                  <Badge
                    count={fulfillmentActions.length}
                    showZero
                    style={{ backgroundColor: fulfillmentActions.length > 0 ? '#1890ff' : undefined }}
                  />
                </Space>
              }
            >
              {isLoadingActions ? (
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <Spin />
                </div>
              ) : fulfillmentActions.length === 0 ? (
                <Text type="secondary">No fulfillment actions yet for this request.</Text>
              ) : (
                <>
                  {fulfillmentActions.length > 1 && (
                    <Alert
                      message={`Split fulfillment: ${fulfillmentActions.length} actions covering this request`}
                      type="info"
                      showIcon
                      style={{ marginBottom: 12 }}
                    />
                  )}
                  <Table
                    columns={fulfillmentColumns}
                    dataSource={fulfillmentActions}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    scroll={{ x: 900 }}
                  />
                </>
              )}
            </Card>

            <Divider style={{ margin: '0 0 4px' }} />

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
          <Button key="save" type="primary" loading={isUpdating} onClick={handleSaveEdit}>
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
              <Select.Option value="routine">Routine</Select.Option>
              <Select.Option value="urgent">Urgent</Select.Option>
              <Select.Option value="aog">AOG</Select.Option>
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
