import { useRef, useState, useEffect } from 'react';
import {
  FloatingBubble,
  Popup,
  SafeArea,
  TextArea,
  Button,
  Toast,
  SpinLoading,
} from 'antd-mobile';
import { CloseOutline, DeleteOutline } from 'antd-mobile-icons';
import { RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import {
  useGetAISettingsQuery,
  useSendChatMessageMutation,
  type ChatMessage,
} from '@features/admin/services/aiApi';
import { useHaptics } from '@shared/hooks/useHaptics';
import './MobileAIAssistant.css';

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Hello! I'm the SupplyLine AI Assistant. I can help with inventory, kits, orders, calibration, and more. What would you like to know?",
};

/**
 * Mobile-friendly full-screen version of the AI assistant. Renders as a
 * FloatingBubble trigger (bottom-left so it doesn't conflict with the
 * global Scan FAB) that opens a full-screen Popup with a chat thread.
 * Re-uses useSendChatMessageMutation so conversations behave identically
 * to the desktop AIAssistant drawer.
 */
export const MobileAIAssistant = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const haptics = useHaptics();

  const { data: aiSettings, isLoading: settingsLoading } = useGetAISettingsQuery();
  const [sendMessage, { isLoading: sending }] = useSendChatMessageMutation();

  const isAvailable = Boolean(aiSettings?.enabled && aiSettings?.api_key_configured);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending, open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !isAvailable) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    haptics.trigger('selection');

    try {
      const apiMessages = next.filter((m) => m !== WELCOME_MESSAGE);
      const result = await sendMessage({ messages: apiMessages }).unwrap();
      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
      haptics.trigger('success');
    } catch (err) {
      haptics.trigger('error');
      const error = err as { data?: { error?: string } };
      const errText = error?.data?.error || 'Something went wrong. Please try again.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, I hit an error: ${errText}` },
      ]);
    }
  };

  const handleClear = () => {
    if (sending) return;
    setMessages([WELCOME_MESSAGE]);
    setInput('');
    Toast.show({ content: 'Conversation cleared', duration: 1000 });
  };

  // Don't render anything if AI is disabled system-wide
  if (settingsLoading || !aiSettings?.enabled) return null;

  return (
    <>
      <FloatingBubble
        style={{
          '--initial-position-bottom': '88px',
          '--initial-position-left': '16px',
          '--edge-distance': '16px',
          '--background': '#1677ff',
        }}
        onClick={() => setOpen(true)}
        aria-label="AI Assistant"
      >
        <RobotOutlined style={{ fontSize: 24, color: '#fff' }} />
      </FloatingBubble>

      <Popup
        visible={open}
        onMaskClick={() => setOpen(false)}
        position="bottom"
        destroyOnClose={false}
        bodyStyle={{
          height: '100dvh',
          maxHeight: '100dvh',
          background: 'var(--adm-color-background)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="mobile-ai">
          <SafeArea position="top" />
          <div className="mobile-ai__header">
            <div className="mobile-ai__title">
              <RobotOutlined style={{ color: '#1677ff', fontSize: 20 }} />
              <span>AI Assistant</span>
            </div>
            <div className="mobile-ai__header-actions">
              <button
                type="button"
                className="mobile-ai__icon-btn"
                onClick={handleClear}
                aria-label="Clear conversation"
              >
                <DeleteOutline fontSize={20} />
              </button>
              <button
                type="button"
                className="mobile-ai__icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <CloseOutline fontSize={22} />
              </button>
            </div>
          </div>

          {!isAvailable && (
            <div className="mobile-ai__not-configured">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>AI not configured</div>
              <div style={{ fontSize: 13 }}>
                Ask an admin to configure the AI provider in the Admin → AI Settings page.
              </div>
            </div>
          )}

          <div className="mobile-ai__messages">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={idx}
                  className={`mobile-ai__row ${isUser ? 'mobile-ai__row--user' : ''}`}
                >
                  {!isUser && (
                    <div className="mobile-ai__avatar mobile-ai__avatar--bot">
                      <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
                    </div>
                  )}
                  <div
                    className={`mobile-ai__bubble ${
                      isUser ? 'mobile-ai__bubble--user' : 'mobile-ai__bubble--bot'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {isUser && (
                    <div className="mobile-ai__avatar mobile-ai__avatar--user">
                      <UserOutlined style={{ color: '#555', fontSize: 14 }} />
                    </div>
                  )}
                </div>
              );
            })}
            {sending && (
              <div className="mobile-ai__row">
                <div className="mobile-ai__avatar mobile-ai__avatar--bot">
                  <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
                </div>
                <div className="mobile-ai__bubble mobile-ai__bubble--bot">
                  <SpinLoading style={{ '--size': '18px' } as React.CSSProperties} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {aiSettings && (
            <div className="mobile-ai__meta">
              {aiSettings.provider.charAt(0).toUpperCase() + aiSettings.provider.slice(1)}
              {aiSettings.model ? ` · ${aiSettings.model}` : ''}
            </div>
          )}

          <div className="mobile-ai__input">
            <TextArea
              value={input}
              onChange={setInput}
              placeholder={isAvailable ? 'Ask about inventory…' : 'AI not configured'}
              disabled={!isAvailable || sending}
              autoSize={{ minRows: 1, maxRows: 4 }}
              rows={1}
            />
            <Button
              color="primary"
              size="middle"
              disabled={!isAvailable || !input.trim() || sending}
              onClick={handleSend}
              aria-label="Send"
            >
              <SendOutlined />
            </Button>
          </div>
          <SafeArea position="bottom" />
        </div>
      </Popup>
    </>
  );
};
