import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tabs, Tag, Spin, Empty, Progress } from 'antd';
import {
  ToolOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  StopOutlined,
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
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';

import {
  useGetToolInventoryReportQuery,
  useGetCheckoutHistoryReportQuery,
  useGetCalibrationReportQuery,
  useGetDepartmentUsageReportQuery,
} from '../services/reportsApi';
import type { ReportTimeframe, ToolInventoryItem, CheckoutHistoryItem, CalibrationItem } from '../types';

import styles from '../pages/ReportsPage.module.scss';

interface ToolReportsProps {
  timeframe: ReportTimeframe;
  dateParams: Record<string, string | ReportTimeframe>;
  onReportDataChange: (data: unknown, reportType: string) => void;
}

const COLORS = ['#52c41a', '#1890ff', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'];

export function ToolReports({ dateParams, onReportDataChange }: ToolReportsProps) {
  const [activeSubTab, setActiveSubTab] = useState('inventory');

  const { data: inventoryData, isLoading: inventoryLoading } = useGetToolInventoryReportQuery(dateParams);
  const { data: checkoutData, isLoading: checkoutLoading } = useGetCheckoutHistoryReportQuery(dateParams);
  const { data: calibrationData, isLoading: calibrationLoading } = useGetCalibrationReportQuery(dateParams);
  const { data: departmentData, isLoading: departmentLoading } = useGetDepartmentUsageReportQuery(dateParams);

  useEffect(() => {
    if (activeSubTab === 'inventory' && inventoryData) {
      onReportDataChange(inventoryData, 'tool-inventory');
    } else if (activeSubTab === 'checkouts' && checkoutData) {
      onReportDataChange(checkoutData, 'checkout-history');
    } else if (activeSubTab === 'calibration' && calibrationData) {
      onReportDataChange(calibrationData, 'calibration');
    } else if (activeSubTab === 'departments' && departmentData) {
      onReportDataChange(departmentData, 'department-usage');
    }
  }, [activeSubTab, inventoryData, checkoutData, calibrationData, departmentData, onReportDataChange]);

  const inventoryColumns: ColumnsType<ToolInventoryItem> = [
    {
      title: 'Tool #',
      dataIndex: 'tool_number',
      key: 'tool_number',
      sorter: (a, b) => a.tool_number.localeCompare(b.tool_number),
    },
    {
      title: 'Serial #',
      dataIndex: 'serial_number',
      key: 'serial_number',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      filters: inventoryData?.byCategory.map(c => ({ text: c.name, value: c.name })) || [],
      onFilter: (value, record) => record.category === value,
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config: Record<string, { color: string; icon: React.ReactNode }> = {
          available: { color: 'success', icon: <CheckCircleOutlined /> },
          checked_out: { color: 'warning', icon: <ClockCircleOutlined /> },
          maintenance: { color: 'error', icon: <WarningOutlined /> },
          retired: { color: 'default', icon: <StopOutlined /> },
        };
        const { color, icon } = config[status] || config.available;
        return <Tag color={color} icon={icon}>{status.replace('_', ' ').toUpperCase()}</Tag>;
      },
    },
  ];

  const checkoutColumns: ColumnsType<CheckoutHistoryItem> = [
    {
      title: 'Tool #',
      dataIndex: 'tool_number',
      key: 'tool_number',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'User',
      dataIndex: 'user_name',
      key: 'user_name',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Checkout Date',
      dataIndex: 'checkout_date',
      key: 'checkout_date',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.checkout_date).getTime() - new Date(b.checkout_date).getTime(),
    },
    {
      title: 'Return Date',
      dataIndex: 'return_date',
      key: 'return_date',
      render: (date: string | null) => date ? new Date(date).toLocaleDateString() : <Tag color="orange">Active</Tag>,
    },
    {
      title: 'Duration (days)',
      dataIndex: 'duration',
      key: 'duration',
    },
  ];

  const calibrationColumns: ColumnsType<CalibrationItem> = [
    {
      title: 'Tool #',
      dataIndex: 'tool_number',
      key: 'tool_number',
    },
    {
      title: 'Serial #',
      dataIndex: 'serial_number',
      key: 'serial_number',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Last Calibration',
      dataIndex: 'calibration_date',
      key: 'calibration_date',
      render: (date: string | null) => date ? new Date(date).toLocaleDateString() : 'N/A',
    },
    {
      title: 'Due Date',
      dataIndex: 'calibration_due_date',
      key: 'calibration_due_date',
      render: (date: string | null) => date ? new Date(date).toLocaleDateString() : 'N/A',
    },
    {
      title: 'Days Until Due',
      dataIndex: 'days_until_due',
      key: 'days_until_due',
      render: (days: number | null) => {
        if (days === null) return 'N/A';
        if (days < 0) return <Tag color="error">{Math.abs(days)} days overdue</Tag>;
        if (days <= 14) return <Tag color="warning">{days} days</Tag>;
        return <Tag color="success">{days} days</Tag>;
      },
      sorter: (a, b) => (a.days_until_due || 999) - (b.days_until_due || 999),
    },
    {
      title: 'Status',
      dataIndex: 'calibration_status',
      key: 'calibration_status',
      render: (status: string) => {
        const config: Record<string, string> = {
          current: 'success',
          due_soon: 'warning',
          overdue: 'error',
          not_required: 'default',
        };
        return <Tag color={config[status]}>{status.replace('_', ' ').toUpperCase()}</Tag>;
      },
    },
  ];

  const tabItems = [
    {
      key: 'inventory',
      label: 'Inventory',
      children: (
        <Spin spinning={inventoryLoading}>
          {inventoryData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Total Tools"
                      value={inventoryData.summary.total}
                      prefix={<ToolOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Available"
                      value={inventoryData.summary.available}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Checked Out"
                      value={inventoryData.summary.checked_out}
                      valueStyle={{ color: '#faad14' }}
                      prefix={<ClockCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Maintenance"
                      value={inventoryData.summary.maintenance}
                      valueStyle={{ color: '#ff4d4f' }}
                      prefix={<WarningOutlined />}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                  <Card title="Tools by Category">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={inventoryData.byCategory}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {inventoryData.byCategory.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="Tools by Location">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={inventoryData.byLocation.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#1890ff" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card title="Tool Inventory Details">
                <Table
                  columns={inventoryColumns}
                  dataSource={inventoryData.tools}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 800 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No inventory data available" />
          )}
        </Spin>
      ),
    },
    {
      key: 'checkouts',
      label: 'Checkout History',
      children: (
        <Spin spinning={checkoutLoading}>
          {checkoutData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Total Checkouts"
                      value={checkoutData.stats.totalCheckouts}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Returned"
                      value={checkoutData.stats.returnedCheckouts}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Currently Out"
                      value={checkoutData.stats.currentlyCheckedOut}
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Avg Duration (days)"
                      value={checkoutData.stats.averageDuration}
                      precision={1}
                    />
                  </Card>
                </Col>
              </Row>

              <Card title="Checkout Trends" style={{ marginBottom: 24 }}>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={checkoutData.checkoutsByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="checkouts" stroke="#1890ff" name="Checkouts" />
                      <Line type="monotone" dataKey="returns" stroke="#52c41a" name="Returns" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Checkout History Details">
                <Table
                  columns={checkoutColumns}
                  dataSource={checkoutData.checkouts}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 800 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No checkout data available" />
          )}
        </Spin>
      ),
    },
    {
      key: 'calibration',
      label: 'Calibration',
      children: (
        <Spin spinning={calibrationLoading}>
          {calibrationData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Requiring Calibration"
                      value={calibrationData.summary.total}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Current"
                      value={calibrationData.summary.current}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Due Soon"
                      value={calibrationData.summary.dueSoon}
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Overdue"
                      value={calibrationData.summary.overdue}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
              </Row>

              <Card title="Calibration Status Distribution" style={{ marginBottom: 24 }}>
                <Row gutter={16} align="middle">
                  <Col span={12}>
                    <div style={{ height: 250 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Current', value: calibrationData.summary.current, color: '#52c41a' },
                              { name: 'Due Soon', value: calibrationData.summary.dueSoon, color: '#faad14' },
                              { name: 'Overdue', value: calibrationData.summary.overdue, color: '#ff4d4f' },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#52c41a" />
                            <Cell fill="#faad14" />
                            <Cell fill="#ff4d4f" />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ padding: 16 }}>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Current</span>
                          <span>{calibrationData.summary.current} tools</span>
                        </div>
                        <Progress
                          percent={Math.round((calibrationData.summary.current / calibrationData.summary.total) * 100)}
                          strokeColor="#52c41a"
                          showInfo={false}
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Due Soon</span>
                          <span>{calibrationData.summary.dueSoon} tools</span>
                        </div>
                        <Progress
                          percent={Math.round((calibrationData.summary.dueSoon / calibrationData.summary.total) * 100)}
                          strokeColor="#faad14"
                          showInfo={false}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span>Overdue</span>
                          <span>{calibrationData.summary.overdue} tools</span>
                        </div>
                        <Progress
                          percent={Math.round((calibrationData.summary.overdue / calibrationData.summary.total) * 100)}
                          strokeColor="#ff4d4f"
                          showInfo={false}
                        />
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>

              <Card title="Calibration Details">
                <Table
                  columns={calibrationColumns}
                  dataSource={calibrationData.tools}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 800 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No calibration data available" />
          )}
        </Spin>
      ),
    },
    {
      key: 'departments',
      label: 'Department Usage',
      children: (
        <Spin spinning={departmentLoading}>
          {departmentData ? (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                  <Card title="Checkouts by Department">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={departmentData.checkoutsByDepartment}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {departmentData.checkoutsByDepartment.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="Tool Usage by Category">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={departmentData.toolUsageByCategory.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="checkouts" fill="#1890ff" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card title="Department Usage Details">
                <Table
                  columns={[
                    { title: 'Department', dataIndex: 'name', key: 'name' },
                    { title: 'Total Checkouts', dataIndex: 'totalCheckouts', key: 'totalCheckouts', sorter: (a, b) => a.totalCheckouts - b.totalCheckouts },
                    { title: 'Currently Checked Out', dataIndex: 'currentlyCheckedOut', key: 'currentlyCheckedOut' },
                    { title: 'Avg Duration (days)', dataIndex: 'averageDuration', key: 'averageDuration', render: (v: number) => v.toFixed(1) },
                    { title: 'Most Used Category', dataIndex: 'mostUsedCategory', key: 'mostUsedCategory', render: (v: string) => <Tag>{v}</Tag> },
                  ]}
                  dataSource={departmentData.departments}
                  rowKey="name"
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No department usage data available" />
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
