import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  Checkbox,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetOrderQuery,
  useUpdateOrderMutation,
  useMarkOrderAsOrderedMutation,
  useMarkOrderAsDeliveredMutation,
  useGetOrderMessagesQuery,
  useCreateOrderMessageMutation,
  useMarkOrderMessageAsReadMutation,
  useGetOrderRequestItemsQuery,
  useMarkOrderRequestItemsReceivedMutation,
  useUpdateOrderRequestItemMutation,
} from '../services/ordersApi';
import { StatusBadge, PriorityBadge, ItemTypeBadge, MessageThread } from '../components';
import type { UpdateOrderRequest, MarkOrderedRequest, RequestItem } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const OrderDetailView: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [editForm] = Form.useForm();
  const [orderForm] = Form.useForm();

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isOrderModalVisible, setIsOrderModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  const { data: order, isLoading } = useGetOrderQuery(Number(orderId));
  const { data: messages = [], isLoading: messagesLoading } = useGetOrderMessagesQuery(
    Number(orderId)
  );
  const { data: requestItems = [], isLoading: itemsLoading } = useGetOrderRequestItemsQuery(
    Number(orderId)
  );
  const [updateOrder, { isLoading: updating }] = useUpdateOrderMutation();
  const [markAsOrdered, { isLoading: marking }] = useMarkOrderAsOrderedMutation();
  const [markAsDelivered, { isLoading: markingDelivered }] = useMarkOrderAsDeliveredMutation();
  const [createMessage] = useCreateOrderMessageMutation();
  const [markMessageAsRead] = useMarkOrderMessageAsReadMutation();
  const [markItemsReceived, { isLoading: markingItemsReceived }] = useMarkOrderRequestItemsReceivedMutation();
  const [updateRequestItem] = useUpdateOrderRequestItemMutation();

  const handleEdit = () => {
    if (order) {
      editForm.setFieldsValue({
        title: order.title,
        description: order.description,
        priority: order.priority,
        notes: order.notes,
        status: order.status,
      });
      setIsEditModalVisible(true);
    }
  };

  const handleSaveEdit = async (values: UpdateOrderRequest) => {
    try {
      await updateOrder({ orderId: Number(orderId), updates: values }).unwrap();
      message.success('Order updated successfully');
      setIsEditModalVisible(false);
    } catch {
      message.error('Failed to update order');
    }
  };

  const handleMarkAsOrdered = async (values: MarkOrderedRequest) => {
    try {
      await markAsOrdered({
        orderId: Number(orderId),
        data: values,
      }).unwrap();
      message.success('Order marked as ordered');
      setIsOrderModalVisible(false);
      orderForm.resetFields();
    } catch {
      message.error('Failed to mark order as ordered');
    }
  };

  const handleMarkAsDelivered = () => {
    Modal.confirm({
      title: 'Mark Order as Delivered',
      content: 'Are you sure you want to mark this order as delivered?',
      onOk: async () => {
        try {
          await markAsDelivered({ orderId: Number(orderId) }).unwrap();
          message.success('Order marked as delivered');
        } catch {
          message.error('Failed to mark order as delivered');
        }
      },
    });
  };

  const handleSendMessage = async (data: { subject: string; message: string }) => {
    await createMessage({
      orderId: Number(orderId),
      message: data,
    }).unwrap();
  };

  const handleMarkMessageRead = async (messageId: number) => {
    await markMessageAsRead(messageId).unwrap();
  };

  const handleMarkSelectedItemsReceived = async () => {
    if (selectedItemIds.length === 0) {
      message.warning('Please select items to mark as received');
      return;
    }

    Modal.confirm({
      title: 'Mark Items as Received',
      content: `Are you sure you want to mark ${selectedItemIds.length} item(s) as received?`,
      onOk: async () => {
        try {
          await markItemsReceived({
            orderId: Number(orderId),
            itemIds: selectedItemIds,
          }).unwrap();
          message.success(`${selectedItemIds.length} item(s) marked as received`);
          setSelectedItemIds([]);
        } catch {
          message.error('Failed to mark items as received');
        }
      },
    });
  };

  const handleUpdateItemStatus = async (itemId: number, status: string) => {
    try {
      await updateRequestItem({
        orderId: Number(orderId),
        itemId,
        updates: { status: status as 'pending' | 'ordered' | 'shipped' | 'received' | 'cancelled' },
      }).unwrap();
      message.success('Item status updated');
    } catch {
      message.error('Failed to update item status');
    }
  };

  // Filter items that can be marked as received (ordered or shipped, not yet received/cancelled)
  const receivableItems = requestItems.filter(
    (item) => item.status === 'ordered' || item.status === 'shipped'
  );

  const requestItemColumns: ColumnsType<RequestItem> = [
    {
      title: (
        <Checkbox
          checked={selectedItemIds.length > 0 && selectedItemIds.length === receivableItems.length}
          indeterminate={selectedItemIds.length > 0 && selectedItemIds.length < receivableItems.length}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedItemIds(receivableItems.map((item) => item.id));
            } else {
              setSelectedItemIds([]);
            }
          }}
          disabled={receivableItems.length === 0}
        />
      ),
      key: 'select',
      width: 50,
      render: (_, record) => {
        const isReceivable = record.status === 'ordered' || record.status === 'shipped';
        return (
          <Checkbox
            checked={selectedItemIds.includes(record.id)}
            disabled={!isReceivable}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedItemIds([...selectedItemIds, record.id]);
              } else {
                setSelectedItemIds(selectedItemIds.filter((id) => id !== record.id));
              }
            }}
          />
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 200,
    },
    {
      title: 'Request',
      key: 'request',
      width: 120,
      render: (_, record) =>
        record.request ? (
          <Link to={`/requests/${record.request.id}`}>{record.request.request_number}</Link>
        ) : (
          '-'
        ),
    },
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      width: 100,
      render: (type) => type && <ItemTypeBadge type={type} />,
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
      width: 80,
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
      width: 150,
      render: (_, record) => {
        if (record.status === 'received' || record.status === 'cancelled') {
          return <Tag>{record.status === 'received' ? 'Received' : 'Cancelled'}</Tag>;
        }
        return (
          <Space>
            {record.status === 'ordered' && (
              <Button
                size="small"
                onClick={() => handleUpdateItemStatus(record.id, 'shipped')}
              >
                Shipped
              </Button>
            )}
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleUpdateItemStatus(record.id, 'received')}
            >
              Received
            </Button>
          </Space>
        );
      },
    },
  ];

  if (isLoading || !order) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  const tabItems = [
    {
      key: 'details',
      label: 'Order Details',
      children: (
        <Card>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Order Number" span={2}>
              <Text strong style={{ fontSize: 16 }}>{order.order_number}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Title" span={2}>
              {order.title}
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <StatusBadge status={order.status} type="order" />
            </Descriptions.Item>
            <Descriptions.Item label="Priority">
              <PriorityBadge priority={order.priority} />
            </Descriptions.Item>
            {order.order_type && (
              <Descriptions.Item label="Type">
                <ItemTypeBadge type={order.order_type} />
              </Descriptions.Item>
            )}
            {order.part_number && (
              <Descriptions.Item label="Part Number">{order.part_number}</Descriptions.Item>
            )}
            <Descriptions.Item label="Quantity" span={2}>
              {order.quantity ? `${order.quantity} ${order.unit || ''}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Requester">
              {order.requester
                ? `${order.requester.first_name} ${order.requester.last_name}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Buyer">
              {order.buyer
                ? `${order.buyer.first_name} ${order.buyer.last_name}`
                : <Tag>Unassigned</Tag>}
            </Descriptions.Item>
            {order.vendor && (
              <Descriptions.Item label="Vendor" span={2}>{order.vendor}</Descriptions.Item>
            )}
            {order.tracking_number && (
              <Descriptions.Item label="Tracking Number" span={2}>
                {order.tracking_number}
              </Descriptions.Item>
            )}
            {order.expected_due_date && (
              <Descriptions.Item label="Expected Due Date" span={2}>
                <Space>
                  {dayjs(order.expected_due_date).format('MMM D, YYYY')}
                  {order.is_late && <Tag color="red">Overdue</Tag>}
                  {order.due_soon && !order.is_late && <Tag color="orange">Due Soon</Tag>}
                </Space>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Created At">
              {dayjs(order.created_at).format('MMM D, YYYY h:mm A')}
            </Descriptions.Item>
            <Descriptions.Item label="Last Updated">
              {dayjs(order.updated_at).format('MMM D, YYYY h:mm A')}
            </Descriptions.Item>
            {order.description && (
              <Descriptions.Item label="Description" span={2}>
                {order.description}
              </Descriptions.Item>
            )}
            {order.notes && (
              <Descriptions.Item label="Notes" span={2}>
                {order.notes}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      ),
    },
    {
      key: 'items',
      label: `Request Items (${requestItems.length})`,
      children: (
        <Card>
          {requestItems.length === 0 ? (
            <Alert
              message="No Request Items"
              description="This order is not linked to any user request items. It may have been created directly without a request."
              type="info"
              showIcon
              icon={<InboxOutlined />}
            />
          ) : (
            <>
              {selectedItemIds.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Text>{selectedItemIds.length} item(s) selected</Text>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={handleMarkSelectedItemsReceived}
                      loading={markingItemsReceived}
                    >
                      Mark Selected as Received
                    </Button>
                    <Button onClick={() => setSelectedItemIds([])}>Clear Selection</Button>
                  </Space>
                </div>
              )}
              <Table
                columns={requestItemColumns}
                dataSource={requestItems}
                rowKey="id"
                loading={itemsLoading}
                pagination={false}
                scroll={{ x: 900 }}
              />
            </>
          )}
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
          onClick={() => navigate('/orders')}
          style={{ marginBottom: 16 }}
        >
          Back to Orders
        </Button>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              Order {order.order_number}
            </Title>
            <Text type="secondary">View and manage order details</Text>
          </Col>
          <Col>
            <Space>
              <Button icon={<EditOutlined />} onClick={handleEdit}>
                Edit Order
              </Button>
              {['new', 'in_progress', 'awaiting_info'].includes(order.status) && (
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  onClick={() => setIsOrderModalVisible(true)}
                >
                  Mark as Ordered
                </Button>
              )}
              {order.status === 'shipped' && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleMarkAsDelivered}
                  loading={markingDelivered}
                >
                  Mark as Delivered
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* Edit Modal */}
      <Modal
        title="Edit Order"
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
              <Select.Option value="awaiting_info">Awaiting Info</Select.Option>
              <Select.Option value="in_progress">In Progress</Select.Option>
              <Select.Option value="ordered">Ordered</Select.Option>
              <Select.Option value="shipped">Shipped</Select.Option>
              <Select.Option value="received">Received</Select.Option>
              <Select.Option value="cancelled">Cancelled</Select.Option>
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

      {/* Mark as Ordered Modal */}
      <Modal
        title="Mark Order as Ordered"
        open={isOrderModalVisible}
        onCancel={() => setIsOrderModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={orderForm} onFinish={handleMarkAsOrdered} layout="vertical">
          <Form.Item name="vendor" label="Vendor">
            <Input placeholder="Enter vendor name" />
          </Form.Item>
          <Form.Item name="tracking_number" label="Tracking Number">
            <Input placeholder="Enter tracking number" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={marking}>
                Mark as Ordered
              </Button>
              <Button onClick={() => setIsOrderModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
