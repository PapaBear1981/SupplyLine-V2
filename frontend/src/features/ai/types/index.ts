/**
 * TypeScript types for the AI Agent system.
 */

export interface AIAgent {
  name: string;
  agent_type: 'monitor' | 'assistant' | 'diagnostic' | 'analytics';
  description: string;
  status: 'active' | 'paused' | 'error' | 'disabled' | 'stopped' | 'initialized';
  interval: number;
  error_message: string | null;
  db_id?: number;
  last_heartbeat?: string | null;
  created_at?: string | null;
}

export interface AIAgentsResponse {
  total_agents: number;
  agents: AIAgent[];
}

export interface AIConversation {
  id: number;
  agent_id: number;
  user_id: number;
  title: string | null;
  status: 'active' | 'archived' | 'resolved';
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface AIMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_type: 'text' | 'suggestion' | 'action' | 'alert' | 'chart';
  metadata_json: string | null;
  created_at: string;
}

export interface AIChatRequest {
  message: string;
  agent_name?: string;
  conversation_id?: number;
}

export interface AIChatResponse {
  conversation_id: number;
  message: AIMessage;
  agent_name: string;
}

export interface AIAlert {
  id: number;
  agent_id: number;
  severity: 'critical' | 'warning' | 'info';
  category: 'performance' | 'error' | 'security' | 'inventory' | 'maintenance';
  title: string;
  description: string;
  details_json: string | null;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledged_by: number | null;
  resolved_by: number | null;
  resolved_at: string | null;
  auto_resolved: boolean;
  created_at: string;
}

export interface AIAlertsResponse {
  alerts: AIAlert[];
  active_counts: {
    critical: number;
    warning: number;
    info: number;
  };
  total: number;
}

export interface AIMetric {
  id: number;
  metric_name: string;
  metric_value: number;
  metric_unit: string | null;
  category: string;
  tags_json: string | null;
  recorded_at: string;
}

export interface AIActionLog {
  id: number;
  agent_id: number;
  action_type: 'auto_remediation' | 'suggestion' | 'notification' | 'escalation';
  description: string;
  target: string | null;
  result: 'success' | 'failure' | 'pending';
  details_json: string | null;
  created_at: string;
}

export interface AIDashboardData {
  agents: AIAgentsResponse;
  alert_counts: {
    active_critical: number;
    active_warning: number;
    active_info: number;
    resolved_today: number;
  };
  recent_alerts: AIAlert[];
  recent_actions: AIActionLog[];
  system_metrics: {
    cpu_percent: number;
    memory_percent: number;
    memory_available_mb: number;
    disk_percent: number;
  };
  conversation_count: number;
}
