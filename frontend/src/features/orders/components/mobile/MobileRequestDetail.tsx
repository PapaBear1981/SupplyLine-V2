import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Tabs,
  Tag,
  Button,
  SpinLoading,
  Toast,
  List,
  Form,
  Input,
  Selector,
  TextArea,
} from 'antd-mobile';
import { EditSOutline, MessageOutline } from 'antd-mobile-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  useGetRequestQuery,
  useUpdateRequestMutation,
  useGetRequestMessagesQuery,
  useCreateRequestMessageMutation,
} from '../../services/requestsApi';
import type { UpdateRequestRequest, RequestPriority } from '../../types';
import {
  MobilePageScaffold,
  MobileDetailHeader,
  MobileSectionCard,
  MobileEmptyState,
  MobileFormSheet,
} from '@shared/components/mobile';
import { useHaptics } from '@shared/hooks/useHaptics';
import '../mobile/MobileOrderDetail.css';

dayjs.extend(relativeTime);

const STATUS_COLORS: Record<string, string> = {
  new: '#1890ff',
  under_review: '#13c2c2',
  pending_fulfillment: '#faad14',
  in_transfer: '#2f54eb',
  awaiting_external_procurement: '#fa8c16',
  partially_fulfilled: '#a0d911',
  fulfilled: '#52c41a',
  needs_info: '#ff7a45',
  cancelled: '#ff4d4f',
  // Legacy
  awaiting_info: '#faad14',
  in_progress: '#13c2c2',
  partially_ordered: '#722ed1',
  ordered: '#722ed1',
  partially_received: '#a0d911',
  received: '#52c41a',
};

const PRIORITY_COLORS: Record<string, string> = {
  routine: '#1890ff',
  urgent: '#faad14',
  aog: '#ff4d4f',
  low: '#8c8c8c',
  normal: '#1890ff',
  high: '#faad14',
  critical: '#ff4d4f',
};

const priorityOptions: Array<{ label: string; value: RequestPriority }> = [
  { label: 'Routine', value: 'routine' },
  { label: 'Urgent', value: 'urgent' },
  { label: 'AOG', value: 'aog' },
];

interface EditFormValues {
  title: string;
  description?: string;
  priority?: RequestPriority[];
  notes?: string;
}

interface SendMessageValues {
  subject: string;
  message: string;
}

export const MobileRequestDetail = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const haptics = useHaptics();

  const [editOpen, setEditOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  const [editForm] = Form.useForm<EditFormValues>();
  const [messageForm] = Form.useForm<SendMessageValues>();

  const { data: request, isLoading } = useGetRequestQuery(Number(requestId));
  const { data: messages = [], isLoading: messagesLoading } = useGetRequestMessagesQuery(
    Number(requestId)
  );
  const [updateRequest, { isLoading: updating }] = useUpdateRequestMutation();
  const [createMessage, { isLoading: sending }] = useCreateRequestMessageMutation();

  const openEdit = () => {
    if (!request) return;
    editForm.setFieldsValue({
      title: request.title,
      description: request.description,
      priority: request.priority ? [request.priority] : undefined,
      notes: request.notes,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      const updates: UpdateRequestRequest = {
        title: values.title,
        description: values.description,
        priority: values.priority?.[0],
        notes: values.notes,
      };
      await updateRequest({ requestId: Number(requestId), updates }).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Request updated' });
      setEditOpen(false);
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to update request' });
    }
  };

  const handleSendMessage = async () => {
    try {
      const values = await messageForm.validateFields();
      await createMessage({
        requestId: Number(requestId),
        message: values,
      }).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Message sent' });
      setMessageOpen(false);
      messageForm.resetFields();
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to send message' });
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <SpinLoading />
      </div>
    );
  }

  // Loading has settled — `request` can still be falsy for 404s or
  // network errors. Render an explicit empty state so the page
  // doesn't get stuck on the spinner forever.
  if (!request) {
    return (
      <MobilePageScaffold>
        <MobileEmptyState
          title="Request not found"
          description="This request may have been deleted or the link is out of date."
        />
      </MobilePageScaffold>
    );
  }

  // Tab counts should reflect what actually renders — the Messages tab
  // only shows root messages (replies are collapsed in a future pass),
  // so the tab badge must match.
  const rootMessages = messages.filter((m) => !m.parent_message_id);

  return (
    <MobilePageScaffold>
      <MobileDetailHeader
        title={request.request_number}
        subtitle={request.title}
        tags={
          <>
            <Tag color={STATUS_COLORS[request.status]} fill="outline">
              {request.status.replace(/_/g, ' ')}
            </Tag>
            <Tag color={PRIORITY_COLORS[request.priority]} fill="outline">
              {request.priority}
            </Tag>
            {request.is_late && (
              <Tag color="danger" fill="outline">
                Overdue
              </Tag>
            )}
          </>
        }
        actions={
          <Button size="small" fill="none" onClick={openEdit} aria-label="Edit">
            <EditSOutline fontSize={20} />
          </Button>
        }
      />

      <Tabs>
        <Tabs.Tab title="Details" key="details">
          <MobileSectionCard title="Summary">
            <List>
              {request.requester && (
                <List.Item
                  extra={`${request.requester.first_name} ${request.requester.last_name}`}
                >
                  Requester
                </List.Item>
              )}
              {request.buyer ? (
                <List.Item extra={`${request.buyer.first_name} ${request.buyer.last_name}`}>
                  Buyer
                </List.Item>
              ) : (
                <List.Item extra={<Tag fill="outline">Unassigned</Tag>}>Buyer</List.Item>
              )}
              {request.request_type && (
                <List.Item extra={request.request_type.replace(/_/g, ' ')}>
                  Type
                </List.Item>
              )}
              {request.destination_location && (
                <List.Item extra={request.destination_location}>Destination</List.Item>
              )}
              {request.expected_due_date && (
                <List.Item
                  extra={dayjs(request.expected_due_date).format('MMM D, YYYY')}
                >
                  Due
                </List.Item>
              )}
              <List.Item extra={dayjs(request.created_at).format('MMM D, YYYY')}>
                Created
              </List.Item>
            </List>
          </MobileSectionCard>

          {request.description && (
            <MobileSectionCard title="Description">
              <div className="mobile-order-detail__paragraph">{request.description}</div>
            </MobileSectionCard>
          )}

          {request.notes && (
            <MobileSectionCard title="Notes">
              <div className="mobile-order-detail__paragraph">{request.notes}</div>
            </MobileSectionCard>
          )}
        </Tabs.Tab>

        <Tabs.Tab
          title={`Items (${request.items?.length ?? 0})`}
          key="items"
        >
          {!request.items || request.items.length === 0 ? (
            <MobileEmptyState
              title="No items"
              description="This request has no line items."
            />
          ) : (
            <List>
              {request.items.map((item) => (
                <List.Item
                  key={item.id}
                  title={item.description}
                  description={
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      <Tag fill="outline">{item.status}</Tag>
                      <Tag fill="outline">{item.item_type}</Tag>
                      {item.part_number && (
                        <Tag fill="outline">PN: {item.part_number}</Tag>
                      )}
                      <Tag fill="outline">
                        {item.quantity} {item.unit || 'each'}
                      </Tag>
                    </div>
                  }
                />
              ))}
            </List>
          )}
        </Tabs.Tab>

        <Tabs.Tab
          title={`Messages (${rootMessages.length})`}
          key="messages"
        >
          <div className="mobile-order-detail__compose-row">
            <Button
              block
              color="primary"
              onClick={() => {
                messageForm.resetFields();
                setMessageOpen(true);
              }}
            >
              <MessageOutline /> Send Message
            </Button>
          </div>
          {messagesLoading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <SpinLoading />
            </div>
          ) : rootMessages.length === 0 ? (
            <MobileEmptyState
              title="No messages"
              description="Start a conversation about this request."
            />
          ) : (
            <div className="mobile-order-detail__messages">
              {rootMessages
                .map((msg) => (
                  <MobileSectionCard
                    key={msg.id}
                    title={`${msg.sender?.first_name ?? ''} ${msg.sender?.last_name ?? ''}`.trim()}
                    extra={
                      <span style={{ fontSize: 12 }}>{dayjs(msg.sent_date).fromNow()}</span>
                    }
                  >
                    <div className="mobile-order-detail__message-subject">{msg.subject}</div>
                    <div className="mobile-order-detail__message-body">{msg.message}</div>
                  </MobileSectionCard>
                ))}
            </div>
          )}
        </Tabs.Tab>
      </Tabs>

      <MobileFormSheet
        visible={editOpen}
        title="Edit Request"
        onClose={() => setEditOpen(false)}
        onSubmit={handleSaveEdit}
        submitting={updating}
        submitLabel="Save"
        fullScreen
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Required' }]}
          >
            <Input placeholder="Title" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Description" />
          </Form.Item>
          <Form.Item name="priority" label="Priority">
            <Selector options={priorityOptions} multiple={false} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Notes" />
          </Form.Item>
        </Form>
      </MobileFormSheet>

      <MobileFormSheet
        visible={messageOpen}
        title="Send Message"
        onClose={() => setMessageOpen(false)}
        onSubmit={handleSendMessage}
        submitting={sending}
        submitLabel="Send"
      >
        <Form form={messageForm} layout="vertical">
          <Form.Item
            name="subject"
            label="Subject"
            rules={[{ required: true, message: 'Subject required' }]}
          >
            <Input placeholder="Message subject" />
          </Form.Item>
          <Form.Item
            name="message"
            label="Message"
            rules={[{ required: true, message: 'Message required' }]}
          >
            <TextArea rows={4} placeholder="Type your message..." />
          </Form.Item>
        </Form>
      </MobileFormSheet>
    </MobilePageScaffold>
  );
};
