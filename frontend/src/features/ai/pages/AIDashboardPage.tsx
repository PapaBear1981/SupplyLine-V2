/**
 * AI Dashboard Page
 *
 * Comprehensive overview of AI agent system including:
 * - System metrics (CPU, memory, disk)
 * - Agent status cards
 * - Active alerts
 * - Recent agent actions
 * - Quick-access chat
 */
import { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Space,
  Tabs,
  Progress,
  Tag,
  List,
  Badge,
  Segmented,
  Empty,
  Spin,
} from 'antd';
import {
  RobotOutlined,
  AlertOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useGetAIDashboardQuery, useGetAIAlertsQuery } from '../services/aiApi';
import { AIAgentStatusCards } from '../components/AIAgentStatusCards';
import { AIAlertsList } from '../components/AIAlertsList';
import type { AIActionLog, AIAlert } from '../types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

const getProgressStatus = (value: number): 'success' | 'normal' | 'exception' => {
  if (value > 90) return 'exception';
  if (value > 75) return 'normal';
  return 'success';
};

const severityIcons: Record<string, React.ReactNode> = {
  critical: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
  warning: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
  info: <InfoCircleOutlined style={{ color: '#1677ff' }} />,
};

export const AIDashboardPage = () => {
  const { data: dashboard, isLoading, refetch } = useGetAIDashboardQuery(undefined, {
    pollingInterval: 30000, // Refresh every 30 seconds
  });
  const [alertFilter, setAlertFilter] = useState<string>('active');

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">Loading AI Dashboard...</Text>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return <Empty description="Unable to load AI dashboard data" />;
  }

  const { agents, alert_counts, recent_alerts, recent_actions, system_metrics, conversation_count } = dashboard;
  const totalActiveAlerts = alert_counts.active_critical + alert_counts.active_warning + alert_counts.active_info;

  return (
    <div style={{ padding: '0 4px' }}>
      <Space style={{ marginBottom: 24, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <RobotOutlined style={{ fontSize: 24 }} />
          <Title level={2} style={{ margin: 0 }}>
            AI Command Center
          </Title>
        </Space>
        <Space>
          <Tag color={totalActiveAlerts === 0 ? 'success' : totalActiveAlerts > 5 ? 'error' : 'warning'}>
            {totalActiveAlerts === 0 ? 'All Systems Normal' : `${totalActiveAlerts} Active Alerts`}
          </Tag>
          <Text type="secondary">{agents.total_agents} agents running</Text>
        </Space>
      </Space>

      {/* System Metrics Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="CPU Usage"
              value={system_metrics.cpu_percent}
              suffix="%"
              valueStyle={{
                color: system_metrics.cpu_percent > 80 ? '#ff4d4f' : system_metrics.cpu_percent > 60 ? '#faad14' : '#52c41a',
              }}
            />
            <Progress
              percent={system_metrics.cpu_percent}
              status={getProgressStatus(system_metrics.cpu_percent)}
              showInfo={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Memory Usage"
              value={system_metrics.memory_percent}
              suffix="%"
              valueStyle={{
                color: system_metrics.memory_percent > 85 ? '#ff4d4f' : system_metrics.memory_percent > 70 ? '#faad14' : '#52c41a',
              }}
            />
            <Progress
              percent={system_metrics.memory_percent}
              status={getProgressStatus(system_metrics.memory_percent)}
              showInfo={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Disk Usage"
              value={system_metrics.disk_percent}
              suffix="%"
              valueStyle={{
                color: system_metrics.disk_percent > 90 ? '#ff4d4f' : '#52c41a',
              }}
            />
            <Progress
              percent={system_metrics.disk_percent}
              status={getProgressStatus(system_metrics.disk_percent)}
              showInfo={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Space direction="vertical" size={0} style={{ width: '100%' }}>
              <Statistic title="Active Alerts" value={totalActiveAlerts} />
              <Space size={4}>
                {alert_counts.active_critical > 0 && (
                  <Tag color="red">{alert_counts.active_critical} critical</Tag>
                )}
                {alert_counts.active_warning > 0 && (
                  <Tag color="orange">{alert_counts.active_warning} warning</Tag>
                )}
                {alert_counts.active_info > 0 && (
                  <Tag color="blue">{alert_counts.active_info} info</Tag>
                )}
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Agent Status Cards */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            <span>AI Agents</span>
          </Space>
        }
        size="small"
        style={{ marginBottom: 24 }}
      >
        <AIAgentStatusCards />
      </Card>

      {/* Alerts and Actions */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <AlertOutlined />
                <span>Alerts</span>
                <Badge count={totalActiveAlerts} />
              </Space>
            }
            size="small"
            extra={
              <Segmented
                size="small"
                value={alertFilter}
                onChange={(val) => setAlertFilter(val as string)}
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Resolved', value: 'resolved' },
                  { label: 'All', value: 'all' },
                ]}
              />
            }
          >
            <AIAlertsList limit={10} compact statusFilter={alertFilter} />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <HistoryOutlined />
                <span>Recent Agent Actions</span>
              </Space>
            }
            size="small"
          >
            <List
              dataSource={recent_actions}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No recent actions" /> }}
              renderItem={(action: AIActionLog) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      action.result === 'success' ? (
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                      )
                    }
                    title={
                      <Space size={4}>
                        <Text style={{ fontSize: 13 }}>{action.description}</Text>
                        <Tag
                          color={action.result === 'success' ? 'green' : 'red'}
                          style={{ fontSize: 10 }}
                        >
                          {action.result}
                        </Tag>
                      </Space>
                    }
                    description={
                      <Space size={4}>
                        <Tag style={{ fontSize: 10 }}>{action.action_type}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(action.created_at).fromNow()}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          {/* Quick Stats */}
          <Card size="small" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic title="Your Conversations" value={conversation_count} prefix={<RobotOutlined />} />
              </Col>
              <Col span={12}>
                <Statistic title="Resolved Today" value={alert_counts.resolved_today} prefix={<CheckCircleOutlined />} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
