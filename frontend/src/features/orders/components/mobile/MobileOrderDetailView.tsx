import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Dialog, Form, Input, List, Popup, Space, SpinLoading, Tag, TextArea, Toast } from 'antd-mobile';
import dayjs from 'dayjs';
import {
  useCreateOrderMessageMutation,
  useGetOrderMessagesQuery,
  useGetOrderQuery,
  useGetOrderRequestItemsQuery,
  useMarkOrderAsDeliveredMutation,
  useMarkOrderAsOrderedMutation,
  useUpdateOrderMutation,
} from '../../services/ordersApi';
import type { OrderPriority, UpdateOrderRequest } from '../../types';

export const MobileOrderDetailView: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const id = Number(orderId);
  const [editOpen, setEditOpen] = useState(false);
  const [messageForm] = Form.useForm();
  const [editForm] = Form.useForm<UpdateOrderRequest>();

  const { data: order, isLoading } = useGetOrderQuery(id);
  const { data: messages = [] } = useGetOrderMessagesQuery(id);
  const { data: items = [] } = useGetOrderRequestItemsQuery(id);
  const [updateOrder, { isLoading: isUpdating }] = useUpdateOrderMutation();
  const [markOrdered, { isLoading: isMarkingOrdered }] = useMarkOrderAsOrderedMutation();
  const [markDelivered, { isLoading: isMarkingDelivered }] = useMarkOrderAsDeliveredMutation();
  const [sendMessage, { isLoading: isSending }] = useCreateOrderMessageMutation();

  if (isLoading || !order) {
    return <div style={{ padding: 24, textAlign: 'center' }}><SpinLoading /></div>;
  }

  const openEdit = () => {
    editForm.setFieldsValue({
      title: order.title,
      description: order.description,
      notes: order.notes,
      priority: order.priority,
      status: order.status,
    });
    setEditOpen(true);
  };

  const submitEdit = async (values: UpdateOrderRequest) => {
    try {
      await updateOrder({ orderId: id, updates: values }).unwrap();
      Toast.show({ content: 'Order updated', icon: 'success' });
      setEditOpen(false);
    } catch {
      Toast.show({ content: 'Failed to update', icon: 'fail' });
    }
  };

  const submitMessage = async (values: Record<string, string>) => {
    try {
      await sendMessage({ orderId: id, message: { subject: values.subject, message: values.message } }).unwrap();
      messageForm.resetFields();
      Toast.show({ content: 'Message sent', icon: 'success' });
    } catch {
      Toast.show({ content: 'Failed to send message', icon: 'fail' });
    }
  };

  const handleMarkOrdered = async () => {
    const confirmed = await Dialog.confirm({ content: 'Mark this order as ordered?' });
    if (!confirmed) return;
    try {
      await markOrdered({ orderId: id, data: {} }).unwrap();
      Toast.show({ content: 'Marked as ordered', icon: 'success' });
    } catch {
      Toast.show({ content: 'Failed to update status', icon: 'fail' });
    }
  };

  const handleMarkDelivered = async () => {
    const confirmed = await Dialog.confirm({ content: 'Mark this order as delivered?' });
    if (!confirmed) return;
    try {
      await markDelivered({ orderId: id }).unwrap();
      Toast.show({ content: 'Marked as delivered', icon: 'success' });
    } catch {
      Toast.show({ content: 'Failed to update status', icon: 'fail' });
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <Button fill="none" onClick={() => navigate('/orders')} style={{ paddingLeft: 0 }}>← Back</Button>
      <Card title={order.order_number} extra={<Tag color="primary">{order.status}</Tag>}>
        <List>
          <List.Item extra={order.priority}>Priority</List.Item>
          <List.Item extra={order.order_type || '-'}>Type</List.Item>
          <List.Item extra={order.requester_name || '-'}>Requester</List.Item>
          <List.Item extra={order.expected_due_date ? dayjs(order.expected_due_date).format('MMM D, YYYY') : '-'}>Due</List.Item>
          <List.Item description={order.description || 'No description'}>Description</List.Item>
          <List.Item description={order.notes || 'No notes'}>Notes</List.Item>
        </List>
        <Space block justify="between" style={{ marginTop: 12 }}>
          <Button size="small" fill="outline" onClick={openEdit}>Edit</Button>
          <Button size="small" color="warning" loading={isMarkingOrdered} onClick={handleMarkOrdered}>Mark Ordered</Button>
          <Button size="small" color="success" loading={isMarkingDelivered} onClick={handleMarkDelivered}>Mark Delivered</Button>
        </Space>
      </Card>

      <Card title={`Items (${items.length})`} style={{ marginTop: 12 }}>
        <List>
          {items.map((item) => (
            <List.Item key={item.id} description={`${item.quantity || 1} ${item.unit || 'each'} · ${item.status}`}>
              {item.description}
            </List.Item>
          ))}
        </List>
      </Card>

      <Card title={`Messages (${messages.length})`} style={{ marginTop: 12 }}>
        <List>
          {messages.slice(0, 8).map((m) => (
            <List.Item key={m.id} description={dayjs(m.sent_date).format('MMM D, h:mm A')}>
              <strong>{m.subject}</strong>
              <div>{m.message}</div>
            </List.Item>
          ))}
        </List>
        <Form form={messageForm} layout="vertical" onFinish={submitMessage} footer={<Button block type="submit" loading={isSending} color="primary">Send Message</Button>}>
          <Form.Item name="subject" rules={[{ required: true }]}>
            <Input placeholder="Subject" />
          </Form.Item>
          <Form.Item name="message" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="Type your message" />
          </Form.Item>
        </Form>
      </Card>

      <Popup visible={editOpen} onMaskClick={() => setEditOpen(false)} position="bottom" bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        <div style={{ padding: 12 }}>
          <Form form={editForm} layout="vertical" onFinish={submitEdit} footer={<Button block type="submit" loading={isUpdating} color="primary">Save</Button>}>
            <Form.Header>Edit Order</Form.Header>
            <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="description" label="Description"><TextArea rows={2} /></Form.Item>
            <Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item>
            <Form.Item name="priority" label="Priority">
              <Input placeholder="low, normal, high, critical" onBlur={(e) => editForm.setFieldValue('priority', e.target.value as OrderPriority)} />
            </Form.Item>
            <Form.Item name="status" label="Status"><Input /></Form.Item>
          </Form>
        </div>
      </Popup>
    </div>
  );
};
