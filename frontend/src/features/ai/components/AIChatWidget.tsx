/**
 * Floating AI Chat Widget
 *
 * A collapsible chat interface that allows users to interact with AI agents.
 * Appears as a floating button that expands into a full chat panel.
 */
import { useState, useRef, useEffect } from 'react';
import {
  Button,
  Input,
  Card,
  Typography,
  Space,
  Select,
  Badge,
  Tooltip,
  Spin,
} from 'antd';
import {
  RobotOutlined,
  SendOutlined,
  CloseOutlined,
  MinusOutlined,
  MessageOutlined,
  ThunderboltOutlined,
  MonitorOutlined,
  BugOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useSendAIChatMessageMutation } from '../services/aiApi';
import type { AIMessage } from '../types';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  message_type: string;
  timestamp: Date;
}

const AGENT_OPTIONS = [
  { value: 'user_assistant', label: 'Assistant', icon: <MessageOutlined /> },
  { value: 'system_monitor', label: 'Monitor', icon: <MonitorOutlined /> },
  { value: 'diagnostic', label: 'Diagnostic', icon: <BugOutlined /> },
  { value: 'analytics', label: 'Analytics', icon: <BarChartOutlined /> },
];

export const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm your SupplyLine AI assistant. How can I help you today? Type **help** to see what I can do.",
      message_type: 'text',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('user_assistant');
  const [conversationId, setConversationId] = useState<number | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sendMessage, { isLoading }] = useSendAIChatMessageMutation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      message_type: 'text',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');

    try {
      const result = await sendMessage({
        message: text,
        agent_name: selectedAgent,
        conversation_id: conversationId,
      }).unwrap();

      setConversationId(result.conversation_id);

      const assistantMsg: ChatMessage = {
        id: `assistant-${result.message.id}`,
        role: 'assistant',
        content: result.message.content,
        message_type: result.message.message_type,
        timestamp: new Date(result.message.created_at),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        message_type: 'text',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const agentIcon = AGENT_OPTIONS.find((a) => a.value === selectedAgent)?.icon || <RobotOutlined />;

  if (!isOpen) {
    return (
      <Tooltip title="AI Assistant" placement="left">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<RobotOutlined />}
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            width: 56,
            height: 56,
            fontSize: 24,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
          }}
        />
      </Tooltip>
    );
  }

  if (isMinimized) {
    return (
      <Card
        size="small"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          width: 280,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          cursor: 'pointer',
        }}
        onClick={() => setIsMinimized(false)}
      >
        <Space>
          <RobotOutlined />
          <Text strong>AI Assistant</Text>
          <Badge count={0} />
        </Space>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <RobotOutlined />
          <Text strong>AI Assistant</Text>
          <Select
            size="small"
            value={selectedAgent}
            onChange={(val) => {
              setSelectedAgent(val);
              setConversationId(undefined);
            }}
            options={AGENT_OPTIONS.map((opt) => ({
              value: opt.value,
              label: (
                <Space size={4}>
                  {opt.icon}
                  {opt.label}
                </Space>
              ),
            }))}
            style={{ width: 140 }}
          />
        </Space>
      }
      extra={
        <Space>
          <Button
            type="text"
            size="small"
            icon={<MinusOutlined />}
            onClick={() => setIsMinimized(true)}
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => setIsOpen(false)}
          />
        </Space>
      }
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1000,
        width: 420,
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
      }}
      styles={{
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        },
      }}
    >
      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          maxHeight: 'calc(70vh - 140px)',
          minHeight: 300,
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 12,
                backgroundColor: msg.role === 'user' ? '#1677ff' : '#f0f0f0',
                color: msg.role === 'user' ? '#fff' : 'inherit',
              }}
            >
              {msg.role === 'assistant' && (
                <div style={{ marginBottom: 4 }}>
                  <Space size={4}>
                    {agentIcon}
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {AGENT_OPTIONS.find((a) => a.value === selectedAgent)?.label || 'AI'}
                    </Text>
                  </Space>
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5 }}>
                {msg.content}
              </div>
              <div style={{ textAlign: 'right', marginTop: 4 }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: 10,
                    color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : undefined,
                  }}
                >
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ padding: '12px 16px', borderRadius: 12, backgroundColor: '#f0f0f0' }}>
              <Spin size="small" />
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                Thinking...
              </Text>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0' }}>
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            autoSize={{ minRows: 1, maxRows: 3 }}
            style={{ borderRadius: '8px 0 0 8px' }}
            disabled={isLoading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={isLoading}
            style={{ borderRadius: '0 8px 8px 0', height: 'auto' }}
          />
        </Space.Compact>
      </div>
    </Card>
  );
};
