import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Select, InputNumber, Button, Space, message, Row, Col, Typography, DatePicker } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useCreateOrderMutation } from '../services/ordersApi';
import type { CreateOrderRequest } from '../types';

const { Title, Text } = Typography;
const { TextArea } = Input;

export const OrderCreationForm: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [createOrder, { isLoading }] = useCreateOrderMutation();

  const handleSubmit = async (values: CreateOrderRequest) => {
    try {
      const result = await createOrder(values).unwrap();
      message.success('Order created successfully');
      navigate(`/orders/${result.id}`);
    } catch (error) {
      message.error('Failed to create order');
    }
  };

  return (
    <div style={{ padding: '0 0 24px' }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/orders')}
        style={{ marginBottom: 16 }}
      >
        Back to Orders
      </Button>

      <Title level={2}>Create New Order</Title>
      <Text type="secondary">Fill in the details below to create a new procurement order</Text>

      <Card style={{ marginTop: 24, maxWidth: 800 }}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <Form.Item
                name="title"
                label="Order Title"
                rules={[{ required: true, message: 'Please enter order title' }]}
              >
                <Input placeholder="e.g., Tool Bits for Kit #23" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="order_type" label="Type">
                <Select placeholder="Select type">
                  <Select.Option value="tool">Tool</Select.Option>
                  <Select.Option value="chemical">Chemical</Select.Option>
                  <Select.Option value="expendable">Expendable</Select.Option>
                  <Select.Option value="kit">Kit</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="part_number" label="Part Number">
            <Input placeholder="Enter part number" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={4} placeholder="Describe what needs to be ordered..." />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="priority" label="Priority" initialValue="normal">
                <Select>
                  <Select.Option value="low">Low</Select.Option>
                  <Select.Option value="normal">Normal</Select.Option>
                  <Select.Option value="high">High</Select.Option>
                  <Select.Option value="critical">Critical</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="quantity" label="Quantity">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter quantity" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="unit" label="Unit">
                <Input placeholder="e.g., each, box, gal" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="reference_type" label="Reference Type">
                <Input placeholder="e.g., Kit, Work Order" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="reference_number" label="Reference Number">
                <Input placeholder="e.g., KIT-00123" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="expected_due_date" label="Expected Due Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="notes" label="Additional Notes">
            <TextArea rows={3} placeholder="Any additional information..." />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isLoading}>
                Create Order
              </Button>
              <Button onClick={() => navigate('/orders')}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
