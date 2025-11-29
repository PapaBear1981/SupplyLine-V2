import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tabs, Tag, Spin, Empty, Progress, Descriptions } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  HistoryOutlined,
  FileSearchOutlined,
  SafetyOutlined,
  WarningOutlined,
  LockOutlined,
} from '@ant-design/icons';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';

import {
  useGetUserActivityReportQuery,
  useGetSystemStatsReportQuery,
  useGetAuditLogReportQuery,
} from '../services/reportsApi';
import type { ReportTimeframe, UserActivityItem, AuditLogItem } from '../types';

import styles from '../pages/ReportsPage.module.scss';

interface AdminReportsProps {
  timeframe: ReportTimeframe;
  dateParams: Record<string, string | ReportTimeframe>;
  onReportDataChange: (data: unknown, reportType: string) => void;
}

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96', '#8c8c8c'];

export function AdminReports({ timeframe, dateParams, onReportDataChange }: AdminReportsProps) {
  const [activeSubTab, setActiveSubTab] = useState('system');

  const { data: activityData, isLoading: activityLoading } = useGetUserActivityReportQuery(dateParams);
  const { data: systemData, isLoading: systemLoading } = useGetSystemStatsReportQuery();
  const { data: auditData, isLoading: auditLoading } = useGetAuditLogReportQuery(dateParams);

  useEffect(() => {
    if (activeSubTab === 'system' && systemData) {
      onReportDataChange(systemData, 'system-stats');
    } else if (activeSubTab === 'activity' && activityData) {
      onReportDataChange(activityData, 'user-activity');
    } else if (activeSubTab === 'audit' && auditData) {
      onReportDataChange(auditData, 'audit-log');
    }
  }, [activeSubTab, systemData, activityData, auditData, onReportDataChange]);

  const activityColumns: ColumnsType<UserActivityItem> = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (date: string) => new Date(date).toLocaleString(),
      sorter: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    },
    {
      title: 'User',
      dataIndex: 'user_name',
      key: 'user_name',
    },
    {
      title: 'Employee #',
      dataIndex: 'employee_number',
      key: 'employee_number',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => <Tag>{action}</Tag>,
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
    },
  ];

  const auditColumns: ColumnsType<AuditLogItem> = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (date: string) => new Date(date).toLocaleString(),
      sorter: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    },
    {
      title: 'User',
      dataIndex: 'user_name',
      key: 'user_name',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => {
        let color = 'default';
        if (action.toLowerCase().includes('create')) color = 'green';
        else if (action.toLowerCase().includes('update') || action.toLowerCase().includes('edit')) color = 'blue';
        else if (action.toLowerCase().includes('delete')) color = 'red';
        return <Tag color={color}>{action}</Tag>;
      },
    },
    {
      title: 'Resource Type',
      dataIndex: 'resource_type',
      key: 'resource_type',
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
    },
  ];

  const tabItems = [
    {
      key: 'system',
      label: 'System Overview',
      children: (
        <Spin spinning={systemLoading}>
          {systemData ? (
            <>
              {/* User Stats */}
              <Card title={<><UserOutlined /> User Statistics</>} style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]}>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="Total Users"
                      value={systemData.users.total}
                      prefix={<TeamOutlined />}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="Active Users"
                      value={systemData.users.active}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="Locked Accounts"
                      value={systemData.users.locked}
                      valueStyle={{ color: systemData.users.locked > 0 ? '#ff4d4f' : undefined }}
                      prefix={<LockOutlined />}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Statistic
                      title="New This Month"
                      value={systemData.users.newThisMonth}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 24 }}>
                  <Col span={12}>
                    <div style={{ height: 250 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={systemData.users.byDepartment}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {systemData.users.byDepartment.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Col>
                  <Col span={12}>
                    <h4>Users by Department</h4>
                    {systemData.users.byDepartment.slice(0, 5).map((dept, index) => (
                      <div key={dept.name} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>{dept.name}</span>
                          <span>{dept.value} users</span>
                        </div>
                        <Progress
                          percent={Math.round((dept.value / systemData.users.total) * 100)}
                          strokeColor={COLORS[index % COLORS.length]}
                          showInfo={false}
                          size="small"
                        />
                      </div>
                    ))}
                  </Col>
                </Row>
              </Card>

              {/* Inventory Stats */}
              <Card title={<><SafetyOutlined /> Inventory Overview</>} style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]}>
                  <Col xs={12} sm={4}>
                    <Statistic
                      title="Tools"
                      value={systemData.inventory.totalTools}
                      prefix={<ToolOutlined />}
                    />
                  </Col>
                  <Col xs={12} sm={4}>
                    <Statistic
                      title="Chemicals"
                      value={systemData.inventory.totalChemicals}
                      prefix={<ExperimentOutlined />}
                    />
                  </Col>
                  <Col xs={12} sm={4}>
                    <Statistic
                      title="Kits"
                      value={systemData.inventory.totalKits}
                      prefix={<InboxOutlined />}
                    />
                  </Col>
                  <Col xs={12} sm={4}>
                    <Statistic
                      title="Low Stock Alerts"
                      value={systemData.inventory.lowStockAlerts}
                      valueStyle={{ color: systemData.inventory.lowStockAlerts > 0 ? '#faad14' : undefined }}
                      prefix={<WarningOutlined />}
                    />
                  </Col>
                  <Col xs={12} sm={4}>
                    <Statistic
                      title="Expiration Alerts"
                      value={systemData.inventory.expirationAlerts}
                      valueStyle={{ color: systemData.inventory.expirationAlerts > 0 ? '#ff4d4f' : undefined }}
                      prefix={<WarningOutlined />}
                    />
                  </Col>
                  <Col xs={12} sm={4}>
                    <Statistic
                      title="Calibration Alerts"
                      value={systemData.inventory.calibrationAlerts}
                      valueStyle={{ color: systemData.inventory.calibrationAlerts > 0 ? '#faad14' : undefined }}
                      prefix={<WarningOutlined />}
                    />
                  </Col>
                </Row>
              </Card>

              {/* Order Stats */}
              <Card title={<><ShoppingCartOutlined /> Order & Request Overview</>} style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]}>
                  <Col xs={12} sm={4}>
                    <Statistic
                      title="Total Orders"
                      value={systemData.orders.totalOrders}
                    />
                  </Col>
                  <Col xs={12} sm={4}>
                    <Statistic
                      title="Pending Orders"
                      value={systemData.orders.pendingOrders}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                  <Col xs={12} sm={4}>
                    <Statistic
                      title="Late Orders"
                      value={systemData.orders.lateOrders}
                      valueStyle={{ color: systemData.orders.lateOrders > 0 ? '#ff4d4f' : undefined }}
                    />
                  </Col>
                  <Col xs={12} sm={4}>
                    <Statistic
                      title="Total Requests"
                      value={systemData.orders.totalRequests}
                    />
                  </Col>
                  <Col xs={12} sm={4}>
                    <Statistic
                      title="Pending Requests"
                      value={systemData.orders.pendingRequests}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                </Row>
              </Card>

              {/* Activity Stats */}
              <Card title={<><HistoryOutlined /> Activity Summary</>}>
                <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }}>
                  <Descriptions.Item label="Checkouts Today">{systemData.activity.checkoutsToday}</Descriptions.Item>
                  <Descriptions.Item label="Checkouts This Week">{systemData.activity.checkoutsThisWeek}</Descriptions.Item>
                  <Descriptions.Item label="Checkouts This Month">{systemData.activity.checkoutsThisMonth}</Descriptions.Item>
                  <Descriptions.Item label="Issuances Today">{systemData.activity.issuancesToday}</Descriptions.Item>
                  <Descriptions.Item label="Issuances This Week">{systemData.activity.issuancesThisWeek}</Descriptions.Item>
                  <Descriptions.Item label="Issuances This Month">{systemData.activity.issuancesThisMonth}</Descriptions.Item>
                </Descriptions>
              </Card>
            </>
          ) : (
            <Empty description="No system data available" />
          )}
        </Spin>
      ),
    },
    {
      key: 'activity',
      label: 'User Activity',
      children: (
        <Spin spinning={activityLoading}>
          {activityData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={8}>
                  <Card>
                    <Statistic
                      title="Total Activities"
                      value={activityData.summary.totalActivities}
                      prefix={<HistoryOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card>
                    <Statistic
                      title="Unique Users"
                      value={activityData.summary.uniqueUsers}
                      prefix={<UserOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card>
                    <Statistic
                      title="Top Action"
                      value={activityData.summary.topActions[0]?.name || 'N/A'}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                  <Card title="Activity by Day">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activityData.activityByDay}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="count" stroke="#1890ff" fill="#e6f7ff" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="Most Active Users">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activityData.activityByUser.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#722ed1" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card title="Activity by Type" style={{ marginBottom: 24 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ height: 250 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={activityData.activityByType}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {activityData.activityByType.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Col>
                  <Col span={12}>
                    {activityData.summary.topActions.slice(0, 5).map((action, index) => (
                      <div key={action.name} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>{action.name}</span>
                          <span>{action.value} times</span>
                        </div>
                        <Progress
                          percent={Math.round((action.value / activityData.summary.totalActivities) * 100)}
                          strokeColor={COLORS[index % COLORS.length]}
                          showInfo={false}
                        />
                      </div>
                    ))}
                  </Col>
                </Row>
              </Card>

              <Card title="Activity Log">
                <Table
                  columns={activityColumns}
                  dataSource={activityData.activities}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 900 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No activity data available" />
          )}
        </Spin>
      ),
    },
    {
      key: 'audit',
      label: 'Audit Log',
      children: (
        <Spin spinning={auditLoading}>
          {auditData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Total Records"
                      value={auditData.summary.total}
                      prefix={<FileSearchOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Creates"
                      value={auditData.summary.creates}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Updates"
                      value={auditData.summary.updates}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Deletes"
                      value={auditData.summary.deletes}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                  <Card title="Audit Activity by Day">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={auditData.logsByDay}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="count" stroke="#13c2c2" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="Actions Distribution">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={auditData.logsByAction.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#13c2c2" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card title="Audit Log Details">
                <Table
                  columns={auditColumns}
                  dataSource={auditData.logs}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 800 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No audit data available" />
          )}
        </Spin>
      ),
    },
  ];

  return (
    <Tabs
      activeKey={activeSubTab}
      onChange={setActiveSubTab}
      items={tabItems}
      className={styles.subTabs}
    />
  );
}
