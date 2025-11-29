import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tabs, Tag, Spin, Empty, Progress } from 'antd';
import {
  ShoppingCartOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  TruckOutlined,
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
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';

import {
  useGetProcurementOrderReportQuery,
  useGetUserRequestReportQuery,
} from '../services/reportsApi';
import type {
  ReportTimeframe,
  ProcurementOrderReportItem,
  UserRequestReportItem
} from '../types';

import styles from '../pages/ReportsPage.module.scss';

interface OrderReportsProps {
  timeframe: ReportTimeframe;
  dateParams: Record<string, string | ReportTimeframe>;
  onReportDataChange: (data: unknown, reportType: string) => void;
}

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96', '#8c8c8c'];

export function OrderReports({ dateParams, onReportDataChange }: OrderReportsProps) {
  const [activeSubTab, setActiveSubTab] = useState('procurement');

  const { data: procurementData, isLoading: procurementLoading } = useGetProcurementOrderReportQuery(dateParams);
  const { data: requestData, isLoading: requestLoading } = useGetUserRequestReportQuery(dateParams);

  useEffect(() => {
    if (activeSubTab === 'procurement' && procurementData) {
      onReportDataChange(procurementData, 'procurement-orders');
    } else if (activeSubTab === 'requests' && requestData) {
      onReportDataChange(requestData, 'user-requests');
    }
  }, [activeSubTab, procurementData, requestData, onReportDataChange]);

  const procurementColumns: ColumnsType<ProcurementOrderReportItem> = [
    {
      title: 'Order #',
      dataIndex: 'order_number',
      key: 'order_number',
      sorter: (a, b) => (a.order_number || '').localeCompare(b.order_number || ''),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: 'Requester',
      dataIndex: 'requester_name',
      key: 'requester_name',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => {
        const colors: Record<string, string> = {
          low: 'default',
          normal: 'blue',
          high: 'orange',
          critical: 'red',
        };
        return <Tag color={colors[priority]}>{priority.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          new: 'blue',
          awaiting_info: 'orange',
          in_progress: 'purple',
          ordered: 'cyan',
          shipped: 'geekblue',
          received: 'green',
          cancelled: 'default',
        };
        return <Tag color={colors[status]}>{status.replace('_', ' ').toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Vendor',
      dataIndex: 'vendor',
      key: 'vendor',
      ellipsis: true,
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (date: string | null) => date ? new Date(date).toLocaleDateString() : 'N/A',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
  ];

  const requestColumns: ColumnsType<UserRequestReportItem> = [
    {
      title: 'Request #',
      dataIndex: 'request_number',
      key: 'request_number',
      sorter: (a, b) => (a.request_number || '').localeCompare(b.request_number || ''),
    },
    {
      title: 'Requester',
      dataIndex: 'requester_name',
      key: 'requester_name',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Items',
      dataIndex: 'total_items',
      key: 'total_items',
    },
    {
      title: 'Pending',
      dataIndex: 'items_pending',
      key: 'items_pending',
      render: (count: number) => count > 0 ? <Tag color="orange">{count}</Tag> : '-',
    },
    {
      title: 'Received',
      dataIndex: 'items_received',
      key: 'items_received',
      render: (count: number) => count > 0 ? <Tag color="green">{count}</Tag> : '-',
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => {
        const colors: Record<string, string> = {
          low: 'default',
          normal: 'blue',
          high: 'orange',
          critical: 'red',
        };
        return <Tag color={colors[priority]}>{priority.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          new: 'blue',
          awaiting_info: 'orange',
          in_progress: 'purple',
          partially_ordered: 'cyan',
          ordered: 'geekblue',
          partially_received: 'lime',
          received: 'green',
          cancelled: 'default',
        };
        return <Tag color={colors[status]}>{status.replace(/_/g, ' ').toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Buyer',
      dataIndex: 'buyer_name',
      key: 'buyer_name',
      render: (name: string | null) => name || '-',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
  ];

  const tabItems = [
    {
      key: 'procurement',
      label: 'Procurement Orders',
      children: (
        <Spin spinning={procurementLoading}>
          {procurementData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Total Orders"
                      value={procurementData.summary.total}
                      prefix={<ShoppingCartOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="New"
                      value={procurementData.summary.new}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="In Progress"
                      value={procurementData.summary.inProgress}
                      valueStyle={{ color: '#722ed1' }}
                      prefix={<ClockCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Ordered"
                      value={procurementData.summary.ordered}
                      valueStyle={{ color: '#13c2c2' }}
                      prefix={<TruckOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Received"
                      value={procurementData.summary.received}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Avg Processing (days)"
                      value={procurementData.summary.averageProcessingTime}
                      precision={1}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={8}>
                  <Card title="Orders by Status">
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={procurementData.byStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {procurementData.byStatus.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card title="Orders by Priority">
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={procurementData.byPriority}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#1890ff" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card title="Orders by Month">
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={procurementData.ordersByMonth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="count" stroke="#1890ff" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              {procurementData.topVendors.length > 0 && (
                <Card title="Top Vendors" style={{ marginBottom: 24 }}>
                  <Row gutter={16}>
                    <Col span={12}>
                      {procurementData.topVendors.slice(0, 5).map((vendor, index) => (
                        <div key={vendor.name} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>{index + 1}. {vendor.name}</span>
                            <span>{vendor.orders} orders</span>
                          </div>
                          <Progress
                            percent={Math.round((vendor.orders / procurementData.summary.total) * 100)}
                            strokeColor={COLORS[index % COLORS.length]}
                            showInfo={false}
                          />
                        </div>
                      ))}
                    </Col>
                    <Col span={12}>
                      <div style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={procurementData.topVendors.slice(0, 5)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={100} />
                            <Tooltip />
                            <Bar dataKey="orders" fill="#52c41a" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Col>
                  </Row>
                </Card>
              )}

              <Card title="Procurement Order Details">
                <Table
                  columns={procurementColumns}
                  dataSource={procurementData.orders}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 1100 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No procurement order data available" />
          )}
        </Spin>
      ),
    },
    {
      key: 'requests',
      label: 'User Requests',
      children: (
        <Spin spinning={requestLoading}>
          {requestData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Total Requests"
                      value={requestData.summary.total}
                      prefix={<FileTextOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Open"
                      value={requestData.summary.open}
                      valueStyle={{ color: '#faad14' }}
                      prefix={<ClockCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Completed"
                      value={requestData.summary.completed}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Avg Completion (days)"
                      value={requestData.summary.averageCompletionTime}
                      precision={1}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={8}>
                  <Card title="Requests by Status">
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={requestData.byStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {requestData.byStatus.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card title="Requests by Department">
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={requestData.byDepartment.slice(0, 8)} layout="vertical">
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
                <Col xs={24} md={8}>
                  <Card title="Requests by Month">
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={requestData.requestsByMonth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="count" stroke="#722ed1" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              {requestData.topRequesters.length > 0 && (
                <Card title="Top Requesters" style={{ marginBottom: 24 }}>
                  {requestData.topRequesters.slice(0, 5).map((user, index) => (
                    <div key={user.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>{index + 1}. {user.name}</span>
                        <span>{user.requests} requests</span>
                      </div>
                      <Progress
                        percent={Math.round((user.requests / requestData.summary.total) * 100)}
                        strokeColor={COLORS[index % COLORS.length]}
                        showInfo={false}
                      />
                    </div>
                  ))}
                </Card>
              )}

              <Card title="User Request Details">
                <Table
                  columns={requestColumns}
                  dataSource={requestData.requests}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 1100 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No user request data available" />
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
