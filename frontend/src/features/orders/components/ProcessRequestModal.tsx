import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  DatePicker,
  Table,
  Card,
  Descriptions,
  Space,
  message,
  Row,
  Col,
  Button,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useGetRequestQuery, useMarkItemsAsOrderedMutation } from '../services/requestsApi';
import { StatusBadge, PriorityBadge, ItemTypeBadge } from './index';
import type { RequestItem, OrderType } from '../types';

const { TextArea } = Input;
const { useToken } = theme;

interface ProcessRequestModalProps {
  open: boolean;
  requestId: number | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProcessRequestModal: React.FC<ProcessRequestModalProps> = ({
  open,
  requestId,
  onClose,
  onSuccess,
}) => {
  const { token } = useToken();
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [form] = Form.useForm();

  const { data: request, isLoading } = useGetRequestQuery(requestId || 0, {
    skip: !requestId || !open,
  });

  const [markItemsAsOrdered, { isLoading: isSubmitting }] = useMarkItemsAsOrderedMutation();

  // Reset form and selected items when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedItems([]);
      form.resetFields();
    }
  }, [open, form]);

  const handleSubmit = async () => {
    if (!requestId) return;

    try {
      // Validate form
      const values = await form.validateFields();

      // Build payload
      const itemUpdates = selectedItems.map((itemId) => ({
        item_id: itemId,
        vendor: values.vendor,
        tracking_number: values.tracking_number || undefined,
        expected_delivery_date: values.expected_delivery_date
          ? dayjs(values.expected_delivery_date).toISOString()
          : undefined,
        order_notes: values.notes || undefined,
      }));

      // Call API
      await markItemsAsOrdered({
        requestId,
        data: { items: itemUpdates },
      }).unwrap();

      // Success handling
      message.success(
        `${selectedItems.length} item(s) marked as ordered and procurement orders created`
      );
      onSuccess?.();
      onClose();
    } catch (error: any) {
      message.error(error?.data?.error || 'Failed to process items');
    }
  };

  // Filter pending items
  const pendingItems = request?.items?.filter((item) => item.status === 'pending') || [];

  const itemColumns: ColumnsType<RequestItem> = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      width: 250,
    },
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      width: 100,
      render: (type: string) => <ItemTypeBadge type={type as OrderType} />,
    },
    {
      title: 'Part Number',
      dataIndex: 'part_number',
      key: 'part_number',
      width: 150,
      render: (partNumber: string | null) => partNumber || '-',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      render: (quantity: number, record: RequestItem) => `${quantity} ${record.unit || 'ea'}`,
    },
  ];

  return (
    <Modal
      title="Process Request Items"
      open={open}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={selectedItems.length === 0}
        >
          Mark as Ordered ({selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''})
        </Button>,
      ]}
    >
      {request && (
        <>
          {/* Request Summary */}
          <Card size="small" style={{ marginBottom: 16, backgroundColor: token.colorBgLayout }}>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="Request #">
                <strong>{request.request_number}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <StatusBadge status={request.status} type="request" />
              </Descriptions.Item>
              <Descriptions.Item label="Title">{request.title}</Descriptions.Item>
              <Descriptions.Item label="Priority">
                <PriorityBadge priority={request.priority} />
              </Descriptions.Item>
              <Descriptions.Item label="Requester">
                {request.requester
                  ? `${request.requester.first_name} ${request.requester.last_name}`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Items">
                {request.item_count || request.items?.length || 0}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Item Selection Table */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Select Items to Process</h4>
            {pendingItems.length > 0 ? (
              <Table
                rowSelection={{
                  selectedRowKeys: selectedItems,
                  onChange: (selectedRowKeys) => setSelectedItems(selectedRowKeys as number[]),
                }}
                columns={itemColumns}
                dataSource={pendingItems}
                rowKey="id"
                pagination={false}
                size="small"
                loading={isLoading}
              />
            ) : (
              <Card>
                <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }}>
                  <p style={{ color: token.colorTextSecondary, margin: 0 }}>
                    No pending items available for processing
                  </p>
                </Space>
              </Card>
            )}
          </div>

          {/* Order Details Form */}
          {selectedItems.length > 0 && (
            <Card title="Order Details" style={{ marginTop: 16 }}>
              <Form form={form} layout="vertical">
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="vendor"
                      label="Vendor"
                      rules={[{ required: true, message: 'Please enter vendor name' }]}
                    >
                      <Input placeholder="Enter vendor name" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="tracking_number" label="Tracking Number">
                      <Input placeholder="Enter tracking number (optional)" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="expected_delivery_date" label="Expected Delivery Date">
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>
                <Form.Item name="notes" label="Order Notes">
                  <TextArea rows={3} placeholder="Add any notes about this order (optional)" />
                </Form.Item>
              </Form>
            </Card>
          )}
        </>
      )}
    </Modal>
  );
};
