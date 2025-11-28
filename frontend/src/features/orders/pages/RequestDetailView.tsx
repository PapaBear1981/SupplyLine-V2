import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Space,
  Button,
  Tabs,
  Modal,
  Form,
  Input,
  Select,
  message,
  Row,
  Col,
  Typography,
  Tag,
  Spin,
  Table,
  Badge,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  CheckCircleOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetRequestQuery,
  useUpdateRequestMutation,
  useGetRequestMessagesQuery,
  useCreateRequestMessageMutation,
  useMarkRequestMessageAsReadMutation,
  useMarkItemsAsOrderedMutation,
  useMarkItemsAsReceivedMutation,
} from '../services/requestsApi';
import { StatusBadge, PriorityBadge, ItemTypeBadge, MessageThread } from '../components';
import type { UpdateRequestRequest, RequestItem } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const RequestDetailView: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [editForm] = Form.useForm();

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const { data: request, isLoading } = useGetRequestQuery(Number(requestId));
  const { data: messages = [], isLoading: messagesLoading } = useGetRequestMessagesQuery(
    Number(requestId)
  );
  const [updateRequest, { isLoading: updating }] = useUpdateRequestMutation();
  const [createMessage] = useCreateRequestMessageMutation();
  const [markMessageAsRead] = useMarkRequestMessageAsReadMutation();
  const [markItemsAsOrdered] = useMarkItemsAsOrderedMutation();
  const [markItemsAsReceived] = useMarkItemsAsReceivedMutation();

  const handleEdit = () => {
    if (request) {
      editForm.setFieldsValue({
        title: request.title,
        description: request.description,
        priority: request.priority,
        notes: request.notes,
        status: request.status,
      });
      setIsEditModalVisible(true);
    }
  };

  const handleSaveEdit = async (values: UpdateRequestRequest) => {
    try {
      await updateRequest({ requestId: Number(requestId), updates: values }).unwrap();
      message.success('Request updated successfully');
      setIsEditModalVisible(false);
    } catch (error) {
      message.error('Failed to update request');
    }
  };

  const handleMarkItemAsOrdered = (itemId: number) => {
    Modal.confirm({
      title: 'Mark Item as Ordered',
      content: 'Are you sure you want to mark this item as ordered?',
      onOk: async () => {
        try {
          await markItemsAsOrdered({
            requestId: Number(requestId),
            data: { items: [{ item_id: itemId }] },
          }).unwrap();
          message.success('Item marked as ordered');
        } catch (error) {
          message.error('Failed to mark item as ordered');
        }
      },
    });
  };

  const handleMarkItemAsReceived = (itemId: number) => {
    Modal.confirm({
      title: 'Mark Item as Received',
      content: 'Are you sure you want to mark this item as received?',
      onOk: async () => {
        try {
          await markItemsAsReceived({
            requestId: Number(requestId),
            data: { item_ids: [itemId] },
          }).unwrap();
          message.success('Item marked as received');
        } catch (error) {
          message.error('Failed to mark item as received');
        }
      },
    });
  };

  const handleSendMessage = async (data: { subject: string; message: string }) => {
    await createMessage({
      requestId: Number(requestId),
      message: data,
    }).unwrap();
  };

  const handleMarkMessageRead = async (messageId: number) => {
    await markMessageAsRead(messageId).unwrap();
  };

  if (isLoading || !request) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  const itemColumns: ColumnsType<RequestItem> = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 250,
    },
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      width: 120,
      render: (type) => type && <ItemTypeBadge type={type} />,
    },
    {
      title: 'Part Number',
      dataIndex: 'part_number',
      key: 'part_number',
      width: 150,
      render: (pn) => pn || '-',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (qty, record) => `${qty || 1} ${record.unit || 'each'}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => <StatusBadge status={status} type="item" />,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Button
              size="small"
              icon={<ShoppingCartOutlined />}
              onClick={() => handleMarkItemAsOrdered(record.id)}
            >
              Mark Ordered
            </Button>
          )}
          {record.status === 'ordered' && (
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleMarkItemAsReceived(record.id)}
            >
              Mark Received
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'details',
      label: 'Request Details',
      children: (
        <Card>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Request Number" span={2}>
              <Text strong style={{ fontSize: 16 }}>{request.request_number}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Title" span={2}>
              {request.title}
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
            <Descriptions.Item label="Total Items">
              <Badge count={request.item_count || 0} showZero />
            </Descriptions.Item>
            {request.expected_due_date && (
              <Descriptions.Item label="Expected Due Date" span={2}>
                <Space>
                  {dayjs(request.expected_due_date).format('MMM D, YYYY')}
                  {request.is_late && <Tag color="red">Overdue</Tag>}
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Created At">
              {dayjs(request.created_at).format('MMM D, YYYY h:mm A')}
            </Descriptions.Item>
            <Descriptions.Item label="Last Updated">
              {dayjs(request.updated_at).format('MMM D, YYYY h:mm A')}
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
          </Descriptions>
        </Card>
      ),
    },
    {
      key: 'items',
      label: `Items (${request.items?.length || 0})`,
      children: (
        <Card>
          <Table
            columns={itemColumns}
            dataSource={request.items || []}
            rowKey="id"
            pagination={false}
          />
        </Card>
      ),
    },
    {
      key: 'messages',
      label: 'Messages',
      children: (
        <MessageThread
          messages={messages}
          loading={messagesLoading}
          onSendMessage={handleSendMessage}
          onMarkAsRead={handleMarkMessageRead}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/requests')}
          style={{ marginBottom: 16 }}
        >
          Back to Requests
        </Button>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              Request {request.request_number}
            </Title>
            <Text type="secondary">View and manage request details</Text>
          </Col>
          <Col>
            <Space>
              <Button icon={<EditOutlined />} onClick={handleEdit}>
                Edit Request
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* Edit Modal */}
      <Modal
        title="Edit Request"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={editForm} onFinish={handleSaveEdit} layout="vertical">
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
          <Form.Item name="status" label="Status">
            <Select>
              <Select.Option value="new">New</Select.Option>
              <Select.Option value="in_progress">In Progress</Select.Option>
              <Select.Option value="partially_ordered">Partially Ordered</Select.Option>
              <Select.Option value="ordered">Ordered</Select.Option>
              <Select.Option value="partially_received">Partially Received</Select.Option>
              <Select.Option value="received">Received</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={updating}>
                Save Changes
              </Button>
              <Button onClick={() => setIsEditModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
