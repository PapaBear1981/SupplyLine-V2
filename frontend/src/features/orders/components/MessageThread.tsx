import { useState } from 'react';
import {
  Card,
  List,
  Avatar,
  Button,
  Form,
  Input,
  Space,
  Typography,
  Collapse,
  Badge,
  message as antdMessage,
} from 'antd';
import {
  MessageOutlined,
  SendOutlined,
  UserOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { ProcurementOrderMessage, UserRequestMessage } from '../types';

dayjs.extend(relativeTime);

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface MessageThreadProps {
  messages: (ProcurementOrderMessage | UserRequestMessage)[];
  loading?: boolean;
  onSendMessage: (data: { subject: string; message: string; parent_message_id?: number }) => Promise<void>;
  onMarkAsRead?: (messageId: number) => Promise<void>;
}

export const MessageThread: React.FC<MessageThreadProps> = ({
  messages,
  loading,
  onSendMessage,
  onMarkAsRead,
}) => {
  const [form] = Form.useForm();
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  // Group messages by thread (parent and replies)
  const topLevelMessages = messages.filter((msg) => !msg.parent_message_id);

  const getReplies = (messageId: number) => {
    return messages.filter((msg) => msg.parent_message_id === messageId);
  };

  const handleSendMessage = async (values: { subject: string; message: string }) => {
    try {
      setSending(true);
      await onSendMessage({
        ...values,
        parent_message_id: replyToId || undefined,
      });
      form.resetFields();
      setReplyToId(null);
      antdMessage.success('Message sent successfully');
    } catch {
      antdMessage.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleMarkAsRead = async (messageId: number) => {
    if (onMarkAsRead) {
      try {
        await onMarkAsRead(messageId);
        antdMessage.success('Message marked as read');
      } catch {
        antdMessage.error('Failed to mark message as read');
      }
    }
  };

  const renderMessage = (msg: ProcurementOrderMessage | UserRequestMessage, isReply = false) => {
    const replies = getReplies(msg.id);
    const unreadReplies = replies.filter((r) => !r.is_read).length;

    return (
      <List.Item
        key={msg.id}
        style={{ paddingLeft: isReply ? 40 : 0 }}
        actions={[
          !msg.is_read && onMarkAsRead && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleMarkAsRead(msg.id)}
            >
              Mark as Read
            </Button>
          ),
          !isReply && (
            <Button
              type="link"
              size="small"
              icon={<MessageOutlined />}
              onClick={() => {
                setReplyToId(msg.id);
                form.setFieldsValue({ subject: `Re: ${msg.subject}` });
              }}
            >
              Reply ({replies.length})
            </Button>
          ),
        ].filter(Boolean)}
      >
        <List.Item.Meta
          avatar={
            <Badge dot={!msg.is_read}>
              <Avatar icon={<UserOutlined />} />
            </Badge>
          }
          title={
            <Space>
              <Text strong>
                {msg.sender?.first_name} {msg.sender?.last_name}
              </Text>
              {!msg.is_read && <Badge status="processing" text="Unread" />}
            </Space>
          }
          description={
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary">{dayjs(msg.sent_date).fromNow()}</Text>
              <Text strong>{msg.subject}</Text>
              <Paragraph style={{ marginBottom: 0 }}>{msg.message}</Paragraph>
              {replies.length > 0 && !isReply && (
                <Collapse
                  ghost
                  items={[
                    {
                      key: 'replies',
                      label: (
                        <Space>
                          <MessageOutlined />
                          <Text>
                            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
                          </Text>
                          {unreadReplies > 0 && <Badge count={unreadReplies} />}
                        </Space>
                      ),
                      children: (
                        <List
                          dataSource={replies}
                          renderItem={(reply) => renderMessage(reply, true)}
                          split={false}
                        />
                      ),
                    },
                  ]}
                />
              )}
            </Space>
          }
        />
      </List.Item>
    );
  };

  return (
    <Card title="Messages" extra={<MessageOutlined />}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Message Composer */}
        <Form form={form} onFinish={handleSendMessage} layout="vertical">
          {replyToId && (
            <Space style={{ marginBottom: 8 }}>
              <Text type="secondary">Replying to message</Text>
              <Button size="small" type="link" onClick={() => {
                setReplyToId(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          )}
          <Form.Item
            name="subject"
            label="Subject"
            rules={[{ required: true, message: 'Please enter a subject' }]}
          >
            <Input placeholder="Message subject" />
          </Form.Item>
          <Form.Item
            name="message"
            label="Message"
            rules={[{ required: true, message: 'Please enter a message' }]}
          >
            <TextArea rows={4} placeholder="Type your message here..." />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={sending}
            >
              Send Message
            </Button>
          </Form.Item>
        </Form>

        {/* Message List */}
        <List
          loading={loading}
          dataSource={topLevelMessages}
          renderItem={(msg) => renderMessage(msg)}
          locale={{ emptyText: 'No messages yet. Start a conversation!' }}
        />
      </Space>
    </Card>
  );
};
