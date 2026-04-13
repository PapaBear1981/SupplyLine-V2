import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
import { EditSOutline, CheckOutline, MessageOutline } from 'antd-mobile-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  useGetOrderQuery,
  useUpdateOrderMutation,
  useMarkOrderAsOrderedMutation,
  useMarkOrderAsDeliveredMutation,
  useGetOrderMessagesQuery,
  useCreateOrderMessageMutation,
  useGetOrderRequestItemsQuery,
  useMarkOrderRequestItemsReceivedMutation,
  useUpdateOrderRequestItemMutation,
} from '../../services/ordersApi';
import type { UpdateOrderRequest, MarkOrderedRequest, OrderPriority, OrderStatus, RequestItem } from '../../types';
import {
  MobilePageScaffold,
  MobileDetailHeader,
  MobileSectionCard,
  MobileEmptyState,
  MobileFormSheet,
  MobileConfirmSheet,
} from '@shared/components/mobile';
import { useHaptics } from '@shared/hooks/useHaptics';
import './MobileOrderDetail.css';

dayjs.extend(relativeTime);

const STATUS_COLORS: Record<string, string> = {
  new: '#1890ff',
  awaiting_info: '#faad14',
  in_progress: '#13c2c2',
  ordered: '#722ed1',
  shipped: '#2f54eb',
  received: '#52c41a',
  cancelled: '#ff4d4f',
  assigned: '#13c2c2',
  sourcing: '#faad14',
  in_transfer: '#2f54eb',
  fulfilled: '#52c41a',
  closed: '#8c8c8c',
};

const PRIORITY_COLORS: Record<OrderPriority, string> = {
  low: '#8c8c8c',
  normal: '#1890ff',
  high: '#faad14',
  critical: '#ff4d4f',
};

const statusOptions: Array<{ label: string; value: OrderStatus }> = [
  { label: 'New', value: 'new' },
  { label: 'Awaiting Info', value: 'awaiting_info' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Ordered', value: 'ordered' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Received', value: 'received' },
  { label: 'Cancelled', value: 'cancelled' },
];

const priorityOptions: Array<{ label: string; value: OrderPriority }> = [
  { label: 'Low', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
];

interface EditFormValues {
  title: string;
  description?: string;
  priority?: OrderPriority[];
  status?: OrderStatus[];
  notes?: string;
}

interface MarkOrderedValues {
  vendor?: string;
  tracking_number?: string;
}

interface SendMessageValues {
  subject: string;
  message: string;
}

export const MobileOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const haptics = useHaptics();

  const [editOpen, setEditOpen] = useState(false);
  const [markOrderedOpen, setMarkOrderedOpen] = useState(false);
  const [deliveredConfirmOpen, setDeliveredConfirmOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  const [editForm] = Form.useForm<EditFormValues>();
  const [orderedForm] = Form.useForm<MarkOrderedValues>();
  const [messageForm] = Form.useForm<SendMessageValues>();

  const { data: order, isLoading } = useGetOrderQuery(Number(orderId));
  const { data: messages = [], isLoading: messagesLoading } = useGetOrderMessagesQuery(
    Number(orderId)
  );
  const { data: requestItems = [] } = useGetOrderRequestItemsQuery(Number(orderId));

  const [updateOrder, { isLoading: updating }] = useUpdateOrderMutation();
  const [markAsOrdered, { isLoading: marking }] = useMarkOrderAsOrderedMutation();
  const [markAsDelivered, { isLoading: markingDelivered }] = useMarkOrderAsDeliveredMutation();
  const [createMessage, { isLoading: sending }] = useCreateOrderMessageMutation();
  const [markItemsReceived] = useMarkOrderRequestItemsReceivedMutation();
  const [updateRequestItem] = useUpdateOrderRequestItemMutation();

  const openEdit = () => {
    if (!order) return;
    editForm.setFieldsValue({
      title: order.title,
      description: order.description,
      priority: [order.priority],
      status: [order.status],
      notes: order.notes,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      const updates: UpdateOrderRequest = {
        title: values.title,
        description: values.description,
        priority: values.priority?.[0],
        status: values.status?.[0],
        notes: values.notes,
      };
      await updateOrder({ orderId: Number(orderId), updates }).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Order updated' });
      setEditOpen(false);
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return; // validation error
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to update order' });
    }
  };

  const handleMarkAsOrdered = async () => {
    try {
      const values = await orderedForm.validateFields();
      const data: MarkOrderedRequest = {
        vendor: values.vendor,
        tracking_number: values.tracking_number,
      };
      await markAsOrdered({ orderId: Number(orderId), data }).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Marked as ordered' });
      setMarkOrderedOpen(false);
      orderedForm.resetFields();
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to mark as ordered' });
    }
  };

  const handleMarkAsDelivered = async () => {
    try {
      await markAsDelivered({ orderId: Number(orderId) }).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Marked as delivered' });
      setDeliveredConfirmOpen(false);
    } catch {
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to mark as delivered' });
    }
  };

  const handleSendMessage = async () => {
    try {
      const values = await messageForm.validateFields();
      await createMessage({
        orderId: Number(orderId),
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

  const handleUpdateItemStatus = async (itemId: number, status: RequestItem['status']) => {
    try {
      await updateRequestItem({
        orderId: Number(orderId),
        itemId,
        updates: { status },
      }).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Item updated' });
    } catch {
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to update item' });
    }
  };

  const handleMarkItemReceived = async (itemId: number) => {
    try {
      await markItemsReceived({
        orderId: Number(orderId),
        itemIds: [itemId],
      }).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Item marked received' });
    } catch {
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to mark received' });
    }
  };

  if (isLoading || !order) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <SpinLoading />
      </div>
    );
  }

  const canMarkOrdered = ['new', 'in_progress', 'awaiting_info'].includes(order.status);
  const canMarkDelivered = order.status === 'shipped';

  return (
    <MobilePageScaffold>
      <MobileDetailHeader
        title={order.order_number}
        subtitle={order.title}
        tags={
          <>
            <Tag color={STATUS_COLORS[order.status]} fill="outline">
              {statusOptions.find((s) => s.value === order.status)?.label || order.status}
            </Tag>
            <Tag color={PRIORITY_COLORS[order.priority]} fill="outline">
              {order.priority}
            </Tag>
            {order.order_type && (
              <Tag fill="outline">{order.order_type}</Tag>
            )}
            {order.is_late && (
              <Tag color="danger" fill="outline">Overdue</Tag>
            )}
            {order.due_soon && !order.is_late && (
              <Tag color="warning" fill="outline">Due Soon</Tag>
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
        {/* ---- Details ---- */}
        <Tabs.Tab title="Details" key="details">
          <MobileSectionCard title="Summary">
            <List>
              {order.part_number && (
                <List.Item extra={order.part_number}>Part Number</List.Item>
              )}
              {order.quantity && (
                <List.Item extra={`${order.quantity} ${order.unit || 'each'}`}>
                  Quantity
                </List.Item>
              )}
              {order.requester && (
                <List.Item
                  extra={`${order.requester.first_name} ${order.requester.last_name}`}
                >
                  Requester
                </List.Item>
              )}
              {order.buyer ? (
                <List.Item extra={`${order.buyer.first_name} ${order.buyer.last_name}`}>
                  Buyer
                </List.Item>
              ) : (
                <List.Item extra={<Tag fill="outline">Unassigned</Tag>}>Buyer</List.Item>
              )}
              {order.vendor && <List.Item extra={order.vendor}>Vendor</List.Item>}
              {order.tracking_number && (
                <List.Item extra={order.tracking_number}>Tracking #</List.Item>
              )}
              {order.expected_due_date && (
                <List.Item
                  extra={
                    <span
                      style={{ color: order.is_late ? '#ff4d4f' : undefined }}
                    >
                      {dayjs(order.expected_due_date).format('MMM D, YYYY')}
                    </span>
                  }
                >
                  Due
                </List.Item>
              )}
              <List.Item extra={dayjs(order.created_at).format('MMM D, YYYY')}>
                Created
              </List.Item>
              <List.Item extra={dayjs(order.updated_at).fromNow()}>Last Updated</List.Item>
            </List>
          </MobileSectionCard>

          {order.description && (
            <MobileSectionCard title="Description">
              <div className="mobile-order-detail__paragraph">{order.description}</div>
            </MobileSectionCard>
          )}

          {order.notes && (
            <MobileSectionCard title="Notes">
              <div className="mobile-order-detail__paragraph">{order.notes}</div>
            </MobileSectionCard>
          )}

          {/* Actions */}
          <MobileSectionCard title="Actions">
            <div className="mobile-order-detail__actions">
              {canMarkOrdered && (
                <Button
                  block
                  color="primary"
                  onClick={() => setMarkOrderedOpen(true)}
                >
                  Mark as Ordered
                </Button>
              )}
              {canMarkDelivered && (
                <Button
                  block
                  color="success"
                  loading={markingDelivered}
                  onClick={() => setDeliveredConfirmOpen(true)}
                >
                  Mark as Delivered
                </Button>
              )}
              <Button block fill="outline" onClick={openEdit}>
                Edit Record
              </Button>
            </div>
          </MobileSectionCard>
        </Tabs.Tab>

        {/* ---- Items ---- */}
        <Tabs.Tab title={`Items (${requestItems.length})`} key="items">
          {requestItems.length === 0 ? (
            <MobileEmptyState
              title="No request items"
              description="This fulfillment record is not linked to any request items."
            />
          ) : (
            <List>
              {requestItems.map((item) => (
                <List.Item
                  key={item.id}
                  title={item.description}
                  description={
                    <>
                      {item.request && (
                        <div style={{ fontSize: 12 }}>
                          <Link to={`/requests/${item.request.id}`}>
                            {item.request.request_number}
                          </Link>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        <Tag fill="outline">{item.status}</Tag>
                        <Tag fill="outline">
                          {item.quantity} {item.unit || 'each'}
                        </Tag>
                        {item.part_number && (
                          <Tag fill="outline">PN: {item.part_number}</Tag>
                        )}
                      </div>
                    </>
                  }
                >
                  {item.status !== 'received' && item.status !== 'cancelled' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      {item.status === 'ordered' && (
                        <Button
                          size="mini"
                          fill="outline"
                          onClick={() => handleUpdateItemStatus(item.id, 'shipped')}
                        >
                          Shipped
                        </Button>
                      )}
                      <Button
                        size="mini"
                        color="primary"
                        onClick={() => handleMarkItemReceived(item.id)}
                      >
                        <CheckOutline /> Received
                      </Button>
                    </div>
                  )}
                </List.Item>
              ))}
            </List>
          )}
        </Tabs.Tab>

        {/* ---- Messages ---- */}
        <Tabs.Tab
          title={`Messages (${messages.length})`}
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
          ) : messages.length === 0 ? (
            <MobileEmptyState title="No messages" description="Start a conversation about this order." />
          ) : (
            <div className="mobile-order-detail__messages">
              {messages
                .filter((m) => !m.parent_message_id)
                .map((msg) => (
                  <MobileSectionCard
                    key={msg.id}
                    title={`${msg.sender?.first_name ?? ''} ${msg.sender?.last_name ?? ''}`.trim()}
                    extra={<span style={{ fontSize: 12 }}>{dayjs(msg.sent_date).fromNow()}</span>}
                  >
                    <div className="mobile-order-detail__message-subject">{msg.subject}</div>
                    <div className="mobile-order-detail__message-body">{msg.message}</div>
                  </MobileSectionCard>
                ))}
            </div>
          )}
        </Tabs.Tab>
      </Tabs>

      {/* ------- Edit sheet ------- */}
      <MobileFormSheet
        visible={editOpen}
        title="Edit Fulfillment Record"
        onClose={() => setEditOpen(false)}
        onSubmit={handleSaveEdit}
        submitting={updating}
        submitLabel="Save"
        fullScreen
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Title" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Description" />
          </Form.Item>
          <Form.Item name="priority" label="Priority">
            <Selector options={priorityOptions} multiple={false} />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Selector
              options={statusOptions.map((s) => ({ label: s.label, value: s.value }))}
              multiple={false}
            />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Notes" />
          </Form.Item>
        </Form>
      </MobileFormSheet>

      {/* ------- Mark ordered sheet ------- */}
      <MobileFormSheet
        visible={markOrderedOpen}
        title="Mark as Ordered"
        subtitle="Record vendor and tracking details"
        onClose={() => setMarkOrderedOpen(false)}
        onSubmit={handleMarkAsOrdered}
        submitting={marking}
        submitLabel="Mark Ordered"
      >
        <Form form={orderedForm} layout="vertical">
          <Form.Item name="vendor" label="Vendor">
            <Input placeholder="Enter vendor name" />
          </Form.Item>
          <Form.Item name="tracking_number" label="Tracking Number">
            <Input placeholder="Enter tracking number" />
          </Form.Item>
        </Form>
      </MobileFormSheet>

      {/* ------- Send message sheet ------- */}
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

      {/* ------- Delivered confirm ------- */}
      <MobileConfirmSheet
        visible={deliveredConfirmOpen}
        title="Mark as Delivered?"
        description="This will update the order status and notify the requester."
        confirmLabel="Yes, mark delivered"
        onConfirm={handleMarkAsDelivered}
        onClose={() => setDeliveredConfirmOpen(false)}
        loading={markingDelivered}
      />

    </MobilePageScaffold>
  );
};
