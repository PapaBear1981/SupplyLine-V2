import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Form, Input, List, Popup, SpinLoading, Tag, TextArea, Toast } from 'antd-mobile';
import dayjs from 'dayjs';
import {
  useCreateRequestMessageMutation,
  useGetRequestMessagesQuery,
  useGetRequestQuery,
  useUpdateRequestMutation,
} from '../../services/requestsApi';
import type { UpdateRequestRequest } from '../../types';

export const MobileRequestDetailView: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const id = Number(requestId);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm<UpdateRequestRequest>();
  const [messageForm] = Form.useForm();

  const { data: request, isLoading } = useGetRequestQuery(id);
  const { data: messages = [] } = useGetRequestMessagesQuery(id);
  const [updateRequest, { isLoading: isUpdating }] = useUpdateRequestMutation();
  const [sendMessage, { isLoading: isSending }] = useCreateRequestMessageMutation();

  if (isLoading || !request) return <div style={{ padding: 24, textAlign: 'center' }}><SpinLoading /></div>;

  const openEdit = () => {
    editForm.setFieldsValue({
      title: request.title,
      description: request.description,
      priority: request.priority,
      notes: request.notes,
    });
    setEditOpen(true);
  };

  const submitEdit = async (values: UpdateRequestRequest) => {
    try {
      await updateRequest({ requestId: id, updates: values }).unwrap();
      Toast.show({ content: 'Request updated', icon: 'success' });
      setEditOpen(false);
    } catch {
      Toast.show({ content: 'Failed to update request', icon: 'fail' });
    }
  };

  const submitMessage = async (values: Record<string, string>) => {
    try {
      await sendMessage({ requestId: id, message: { subject: values.subject, message: values.message } }).unwrap();
      messageForm.resetFields();
      Toast.show({ content: 'Message sent', icon: 'success' });
    } catch {
      Toast.show({ content: 'Failed to send message', icon: 'fail' });
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <Button fill="none" onClick={() => navigate('/requests')} style={{ paddingLeft: 0 }}>← Back</Button>
      <Card title={request.request_number} extra={<Tag color="primary">{request.status}</Tag>}>
        <List>
          <List.Item extra={request.priority}>Priority</List.Item>
          <List.Item extra={request.request_type || '-'}>Type</List.Item>
          <List.Item extra={request.requester_name || '-'}>Requester</List.Item>
          <List.Item extra={request.expected_due_date ? dayjs(request.expected_due_date).format('MMM D, YYYY') : '-'}>Due</List.Item>
          <List.Item description={request.description || 'No description'}>Description</List.Item>
          <List.Item description={request.notes || 'No notes'}>Notes</List.Item>
        </List>
        <Button block fill="outline" style={{ marginTop: 12 }} onClick={openEdit}>Edit Request</Button>
      </Card>

      <Card title={`Items (${request.items?.length || 0})`} style={{ marginTop: 12 }}>
        <List>
          {(request.items || []).map((item) => (
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
        <Form form={messageForm} layout="vertical" onFinish={submitMessage} footer={<Button block type="submit" color="primary" loading={isSending}>Send Message</Button>}>
          <Form.Item name="subject" rules={[{ required: true }]}><Input placeholder="Subject" /></Form.Item>
          <Form.Item name="message" rules={[{ required: true }]}><TextArea rows={3} placeholder="Type your message" /></Form.Item>
        </Form>
      </Card>

      <Popup visible={editOpen} onMaskClick={() => setEditOpen(false)} position="bottom" bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        <div style={{ padding: 12 }}>
          <Form form={editForm} layout="vertical" onFinish={submitEdit} footer={<Button block type="submit" color="primary" loading={isUpdating}>Save</Button>}>
            <Form.Header>Edit Request</Form.Header>
            <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item name="description" label="Description"><TextArea rows={2} /></Form.Item>
            <Form.Item name="priority" label="Priority"><Input /></Form.Item>
            <Form.Item name="notes" label="Notes"><TextArea rows={2} /></Form.Item>
          </Form>
        </div>
      </Popup>
    </div>
  );
};
