import { useState, useRef, useEffect } from 'react';
import {
  Button,
  Drawer,
  Input,
  Typography,
  Space,
  Spin,
  Alert,
  Tooltip,
  theme,
} from 'antd';
import {
  RobotOutlined,
  SendOutlined,
  CloseOutlined,
  UserOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useGetAISettingsQuery, useSendChatMessageMutation } from '@features/admin/services/aiApi';
import type { ChatMessage } from '@features/admin/services/aiApi';
import { useTheme } from '@features/settings/contexts/ThemeContext';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Hello! I'm the SupplyLine AI Assistant. I can help you with questions about tool and chemical inventory, calibration status, kits, procurement, and how to navigate the system. What would you like to know?",
};

interface MessageBubbleProps {
  msg: ChatMessage;
  isDark: boolean;
  colorBgContainer: string;
}

const MessageBubble = ({ msg, isDark, colorBgContainer }: MessageBubbleProps) => {
  const isUser = msg.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#1677ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
        </div>
      )}

      <div
        style={{
          maxWidth: '80%',
          padding: '8px 12px',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser
            ? '#1677ff'
            : isDark
            ? '#1f1f1f'
            : colorBgContainer,
          border: isUser ? 'none' : `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
          color: isUser ? '#fff' : undefined,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      >
        <Text style={{ color: isUser ? '#fff' : undefined, fontSize: 13 }}>
          {msg.content}
        </Text>
      </div>

      {isUser && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <UserOutlined style={{ color: '#595959', fontSize: 14 }} />
        </div>
      )}
    </div>
  );
};

export const AIAssistant = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { themeConfig } = useTheme();
  const isDark = themeConfig.mode === 'dark';
  const { token: { colorBgContainer } } = theme.useToken();

  const { data: aiSettings, isLoading: settingsLoading } = useGetAISettingsQuery();
  const [sendMessage, { isLoading: sending }] = useSendChatMessageMutation();

  const isAvailable = aiSettings?.enabled && (aiSettings?.api_key_configured || aiSettings?.provider === 'ollama');

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');

    try {
      // Send conversation history (skip the welcome message for API calls)
      const apiMessages = updatedMessages.filter((m) => m !== WELCOME_MESSAGE || messages.length === 1);
      const result = await sendMessage({ messages: apiMessages }).unwrap();
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
    } catch (err: unknown) {
      const error = err as { data?: { error?: string } };
      const errText = error?.data?.error || 'Something went wrong. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${errText}` }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([WELCOME_MESSAGE]);
    setInput('');
  };

  // Don't render the button if settings are still loading or AI is disabled
  if (settingsLoading || !aiSettings?.enabled) return null;

  return (
    <>
      {/* Floating trigger button */}
      <Tooltip title="AI Assistant" placement="left">
        <Button
          type="primary"
          shape="circle"
          icon={<RobotOutlined />}
          size="large"
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            zIndex: 1000,
            width: 52,
            height: 52,
            fontSize: 22,
            boxShadow: '0 4px 16px rgba(22,119,255,0.4)',
          }}
        />
      </Tooltip>

      {/* Chat drawer */}
      <Drawer
        title={
          <Space>
            <RobotOutlined style={{ color: '#1677ff' }} />
            <span>SupplyLine AI Assistant</span>
          </Space>
        }
        placement="right"
        width={420}
        open={open}
        onClose={() => setOpen(false)}
        closeIcon={<CloseOutlined />}
        extra={
          <Tooltip title="Clear conversation">
            <Button
              icon={<ClearOutlined />}
              size="small"
              onClick={handleClear}
              type="text"
            />
          </Tooltip>
        }
        styles={{
          body: {
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          },
        }}
      >
        {/* Not configured warning */}
        {!isAvailable && (
          <div style={{ padding: 16 }}>
            <Alert
              message="AI Assistant not configured"
              description="Ask an administrator to configure the AI provider in the Admin → AI Assistant settings."
              type="warning"
              showIcon
            />
          </div>
        )}

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px 8px',
            background: isDark ? '#141414' : '#fafafa',
          }}
        >
          {messages.map((msg, idx) => (
            <MessageBubble
              key={idx}
              msg={msg}
              isDark={isDark}
              colorBgContainer={colorBgContainer}
            />
          ))}

          {sending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#1677ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '12px 12px 12px 2px',
                  background: isDark ? '#1f1f1f' : colorBgContainer,
                  border: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
                }}
              >
                <Spin size="small" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Model info bar */}
        {aiSettings && (
          <div
            style={{
              padding: '4px 16px',
              borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
              background: isDark ? '#1f1f1f' : '#f9f9f9',
            }}
          >
            <Paragraph style={{ margin: 0, fontSize: 11 }} type="secondary">
              {aiSettings.provider.charAt(0).toUpperCase() + aiSettings.provider.slice(1)}
              {aiSettings.model ? ` · ${aiSettings.model}` : ''}
            </Paragraph>
          </div>
        )}

        {/* Input area */}
        <div
          style={{
            padding: 12,
            borderTop: `1px solid ${isDark ? '#303030' : '#f0f0f0'}`,
            background: colorBgContainer,
          }}
        >
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAvailable ? 'Ask anything about your inventory…  (Enter to send)' : 'AI not configured'}
              disabled={!isAvailable || sending}
              autoSize={{ minRows: 1, maxRows: 5 }}
              style={{ borderRadius: '6px 0 0 6px', resize: 'none' }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={sending}
              disabled={!isAvailable || !input.trim()}
              style={{ height: 'auto', borderRadius: '0 6px 6px 0' }}
            />
          </Space.Compact>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
            Shift+Enter for new line · Enter to send
          </Text>
        </div>
      </Drawer>
    </>
  );
};
