import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Select, Button, Space, message, Typography, Table, Modal, InputNumber } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useCreateRequestMutation } from '../services/requestsApi';
import { ItemTypeBadge } from '../components';
import type { CreateRequestRequest, CreateRequestItemRequest, ItemType } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const RequestCreationForm: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [items, setItems] = useState<CreateRequestItemRequest[]>([]);
  const [isItemModalVisible, setIsItemModalVisible] = useState(false);
  const [createRequest, { isLoading }] = useCreateRequestMutation();

  const handleAddItem = (values: CreateRequestItemRequest) => {
    setItems([...items, values]);
    itemForm.resetFields();
    setIsItemModalVisible(false);
    message.success('Item added');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (values: Omit<CreateRequestRequest, 'items'>) => {
    if (items.length === 0) {
      message.error('Please add at least one item');
      return;
    }

    try {
      const result = await createRequest({ ...values, items }).unwrap();
      message.success('Request created successfully');
      navigate(`/requests/${result.id}`);
    } catch {
      message.error('Failed to create request');
    }
  };

  const itemColumns = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      render: (type: ItemType) => type && <ItemTypeBadge type={type} />,
    },
    {
      title: 'Part Number',
      dataIndex: 'part_number',
      key: 'part_number',
      render: (pn: string) => pn || '-',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (qty: number, record: CreateRequestItemRequest) => `${qty || 1} ${record.unit || 'each'}`,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, __: unknown, index: number) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(index)} />
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/requests')} style={{ marginBottom: 16 }}>
        Back to Requests
      </Button>

      <Title level={2}>Create New Request</Title>
      <Text type="secondary">Create a multi-item procurement request</Text>

      <Card style={{ marginTop: 24, maxWidth: 1000 }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="title"
            label="Request Title"
            rules={[{ required: true, message: 'Please enter request title' }]}
          >
            <Input placeholder="e.g., Tool Restock for Warehouse A" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Describe the purpose of this request..." />
          </Form.Item>

          <Form.Item name="priority" label="Priority" initialValue="normal">
            <Select>
              <Select.Option value="low">Low</Select.Option>
              <Select.Option value="normal">Normal</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="critical">Critical</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="Additional Notes">
            <TextArea rows={2} placeholder="Any additional information..." />
          </Form.Item>

          <Card
            title="Request Items"
            extra={
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsItemModalVisible(true)}>
                Add Item
              </Button>
            }
            style={{ marginBottom: 24 }}
          >
            <Table
              dataSource={items}
              columns={itemColumns}
              rowKey={(_, index) => index?.toString() || '0'}
              pagination={false}
              locale={{ emptyText: 'No items added yet. Click "Add Item" to get started.' }}
            />
          </Card>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isLoading}>
                Create Request
              </Button>
              <Button onClick={() => navigate('/requests')}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        title="Add Item"
        open={isItemModalVisible}
        onCancel={() => setIsItemModalVisible(false)}
        footer={null}
      >
        <Form form={itemForm} layout="vertical" onFinish={handleAddItem}>
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <Input placeholder="Describe the item..." />
          </Form.Item>

          <Form.Item name="item_type" label="Type" initialValue="tool">
            <Select>
              <Select.Option value="tool">Tool</Select.Option>
              <Select.Option value="chemical">Chemical</Select.Option>
              <Select.Option value="expendable">Expendable</Select.Option>
              <Select.Option value="other">Other</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="part_number" label="Part Number">
            <Input placeholder="Enter part number (optional)" />
          </Form.Item>

          <Form.Item name="quantity" label="Quantity" initialValue={1}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="unit" label="Unit" initialValue="each">
            <Input placeholder="e.g., each, box, gal" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Add Item
              </Button>
              <Button onClick={() => setIsItemModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
