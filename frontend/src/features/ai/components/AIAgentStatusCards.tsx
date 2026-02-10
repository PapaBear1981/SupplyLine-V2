/**
 * AI Agent Status Cards
 *
 * Displays status cards for each registered AI agent with toggle controls.
 */
import { Card, Row, Col, Tag, Button, Space, Typography, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  MonitorOutlined,
  MessageOutlined,
  BugOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useGetAIAgentsQuery, useToggleAIAgentMutation } from '../services/aiApi';
import type { AIAgent } from '../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;

const agentIcons: Record<string, React.ReactNode> = {
  monitor: <MonitorOutlined style={{ fontSize: 24 }} />,
  assistant: <MessageOutlined style={{ fontSize: 24 }} />,
  diagnostic: <BugOutlined style={{ fontSize: 24 }} />,
  analytics: <BarChartOutlined style={{ fontSize: 24 }} />,
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  active: { color: 'success', icon: <CheckCircleOutlined /> },
  error: { color: 'error', icon: <CloseCircleOutlined /> },
  stopped: { color: 'default', icon: <PauseCircleOutlined /> },
  disabled: { color: 'default', icon: <PauseCircleOutlined /> },
  initialized: { color: 'processing', icon: <SyncOutlined spin /> },
  paused: { color: 'warning', icon: <ExclamationCircleOutlined /> },
};

export const AIAgentStatusCards = () => {
  const { data, isLoading } = useGetAIAgentsQuery();
  const [toggleAgent, { isLoading: isToggling }] = useToggleAIAgentMutation();

  if (isLoading) {
    return <Card loading />;
  }

  const agents = data?.agents || [];

  return (
    <Row gutter={[16, 16]}>
      {agents.map((agent: AIAgent) => {
        const config = statusConfig[agent.status] || statusConfig.initialized;
        const isActive = agent.status === 'active';

        return (
          <Col xs={24} sm={12} lg={6} key={agent.name}>
            <Card
              hoverable
              size="small"
              style={{
                borderLeft: `4px solid ${isActive ? '#52c41a' : agent.status === 'error' ? '#ff4d4f' : '#d9d9d9'}`,
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Space>
                  {agentIcons[agent.agent_type] || <MonitorOutlined />}
                  <div>
                    <Text strong style={{ display: 'block' }}>
                      {agent.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                    <Tag color={config.color as string} icon={config.icon}>
                      {agent.status}
                    </Tag>
                  </div>
                </Space>

                <Paragraph
                  type="secondary"
                  style={{ fontSize: 12, marginBottom: 4 }}
                  ellipsis={{ rows: 2 }}
                >
                  {agent.description}
                </Paragraph>

                {agent.error_message && (
                  <Text type="danger" style={{ fontSize: 11 }}>
                    Error: {agent.error_message}
                  </Text>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Interval: {agent.interval}s
                    {agent.last_heartbeat && (
                      <>
                        {' '}| Last beat: {dayjs(agent.last_heartbeat).fromNow()}
                      </>
                    )}
                  </Text>
                  <Tooltip title={isActive ? 'Stop Agent' : 'Start Agent'}>
                    <Button
                      size="small"
                      type={isActive ? 'default' : 'primary'}
                      icon={isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                      loading={isToggling}
                      onClick={() =>
                        toggleAgent({
                          agentName: agent.name,
                          action: isActive ? 'stop' : 'start',
                        })
                      }
                    />
                  </Tooltip>
                </div>
              </Space>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
};
