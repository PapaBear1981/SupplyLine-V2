import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tabs, Tag, Spin, Empty, Progress, Alert } from 'antd';
import {
  ExperimentOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  DeleteOutlined,
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
  useGetChemicalInventoryReportQuery,
  useGetChemicalExpirationReportQuery,
  useGetChemicalUsageReportQuery,
  useGetChemicalWasteReportQuery,
} from '../services/reportsApi';
import type { ReportTimeframe, ChemicalInventoryItem, ChemicalExpirationItem, ChemicalUsageItem, ChemicalWasteItem } from '../types';

import styles from '../pages/ReportsPage.module.scss';

interface ChemicalReportsProps {
  timeframe: ReportTimeframe;
  dateParams: Record<string, string | ReportTimeframe>;
  onReportDataChange: (data: unknown, reportType: string) => void;
}

const COLORS = ['#52c41a', '#faad14', '#ff4d4f', '#8c8c8c', '#1890ff', '#722ed1'];

export function ChemicalReports({ timeframe, dateParams, onReportDataChange }: ChemicalReportsProps) {
  const [activeSubTab, setActiveSubTab] = useState('inventory');

  const { data: inventoryData, isLoading: inventoryLoading } = useGetChemicalInventoryReportQuery(dateParams);
  const { data: expirationData, isLoading: expirationLoading } = useGetChemicalExpirationReportQuery(dateParams);
  const { data: usageData, isLoading: usageLoading } = useGetChemicalUsageReportQuery(dateParams);
  const { data: wasteData, isLoading: wasteLoading } = useGetChemicalWasteReportQuery(dateParams);

  useEffect(() => {
    if (activeSubTab === 'inventory' && inventoryData) {
      onReportDataChange(inventoryData, 'chemical-inventory');
    } else if (activeSubTab === 'expiration' && expirationData) {
      onReportDataChange(expirationData, 'chemical-expiration');
    } else if (activeSubTab === 'usage' && usageData) {
      onReportDataChange(usageData, 'chemical-usage');
    } else if (activeSubTab === 'waste' && wasteData) {
      onReportDataChange(wasteData, 'chemical-waste');
    }
  }, [activeSubTab, inventoryData, expirationData, usageData, wasteData, onReportDataChange]);

  const inventoryColumns: ColumnsType<ChemicalInventoryItem> = [
    {
      title: 'Part #',
      dataIndex: 'part_number',
      key: 'part_number',
      sorter: (a, b) => a.part_number.localeCompare(b.part_number),
    },
    {
      title: 'Lot #',
      dataIndex: 'lot_number',
      key: 'lot_number',
    },
    {
      title: 'Description',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Manufacturer',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
    },
    {
      title: 'Quantity',
      key: 'quantity',
      render: (_, record) => `${record.quantity} ${record.unit}`,
      sorter: (a, b) => a.quantity - b.quantity,
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: 'Expiration',
      dataIndex: 'expiration_date',
      key: 'expiration_date',
      render: (date: string | null) => date ? new Date(date).toLocaleDateString() : 'N/A',
      sorter: (a, b) => {
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config: Record<string, { color: string; icon: React.ReactNode }> = {
          available: { color: 'success', icon: <CheckCircleOutlined /> },
          low_stock: { color: 'warning', icon: <WarningOutlined /> },
          out_of_stock: { color: 'error', icon: <CloseCircleOutlined /> },
          expired: { color: 'default', icon: <CloseCircleOutlined /> },
        };
        const { color, icon } = config[status] || config.available;
        return <Tag color={color} icon={icon}>{status.replace('_', ' ').toUpperCase()}</Tag>;
      },
    },
  ];

  const expirationColumns: ColumnsType<ChemicalExpirationItem> = [
    {
      title: 'Part #',
      dataIndex: 'part_number',
      key: 'part_number',
    },
    {
      title: 'Lot #',
      dataIndex: 'lot_number',
      key: 'lot_number',
    },
    {
      title: 'Description',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Quantity',
      key: 'quantity',
      render: (_, record) => `${record.quantity} ${record.unit}`,
    },
    {
      title: 'Expiration Date',
      dataIndex: 'expiration_date',
      key: 'expiration_date',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime(),
    },
    {
      title: 'Days Until',
      dataIndex: 'days_until_expiration',
      key: 'days_until_expiration',
      render: (days: number) => {
        if (days < 0) return <Tag color="error">{Math.abs(days)} days ago</Tag>;
        if (days <= 30) return <Tag color="warning">{days} days</Tag>;
        return <Tag color="success">{days} days</Tag>;
      },
      sorter: (a, b) => a.days_until_expiration - b.days_until_expiration,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config: Record<string, string> = {
          expired: 'error',
          expiring_soon: 'warning',
          ok: 'success',
        };
        return <Tag color={config[status]}>{status.replace('_', ' ').toUpperCase()}</Tag>;
      },
    },
  ];

  const usageColumns: ColumnsType<ChemicalUsageItem> = [
    {
      title: 'Date',
      dataIndex: 'used_date',
      key: 'used_date',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.used_date).getTime() - new Date(b.used_date).getTime(),
    },
    {
      title: 'Part #',
      dataIndex: 'part_number',
      key: 'part_number',
    },
    {
      title: 'Chemical',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Quantity Used',
      key: 'quantity_used',
      render: (_, record) => `${record.quantity_used} ${record.unit}`,
    },
    {
      title: 'Used By',
      dataIndex: 'used_by',
      key: 'used_by',
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      ellipsis: true,
    },
  ];

  const wasteColumns: ColumnsType<ChemicalWasteItem> = [
    {
      title: 'Part #',
      dataIndex: 'part_number',
      key: 'part_number',
    },
    {
      title: 'Lot #',
      dataIndex: 'lot_number',
      key: 'lot_number',
    },
    {
      title: 'Chemical',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Quantity',
      key: 'quantity',
      render: (_, record) => `${record.quantity} ${record.unit}`,
    },
    {
      title: 'Waste Reason',
      dataIndex: 'waste_reason',
      key: 'waste_reason',
      render: (reason: string) => {
        const colors: Record<string, string> = {
          expired: 'orange',
          contaminated: 'red',
          damaged: 'magenta',
          other: 'default',
        };
        return <Tag color={colors[reason]}>{reason.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Waste Date',
      dataIndex: 'waste_date',
      key: 'waste_date',
      render: (date: string | null) => date ? new Date(date).toLocaleDateString() : 'N/A',
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
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Total Chemicals"
                      value={inventoryData.summary.total}
                      prefix={<ExperimentOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Total Quantity"
                      value={inventoryData.summary.totalQuantity}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Available"
                      value={inventoryData.summary.available}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Low Stock"
                      value={inventoryData.summary.lowStock}
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Out of Stock"
                      value={inventoryData.summary.outOfStock}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Expired"
                      value={inventoryData.summary.expired}
                      valueStyle={{ color: '#8c8c8c' }}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                  <Card title="Status Distribution">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={inventoryData.byStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {inventoryData.byStatus.map((entry, index) => (
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
                <Col xs={24} md={12}>
                  <Card title="By Manufacturer">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={inventoryData.byManufacturer.slice(0, 10)}>
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

              <Card title="Chemical Inventory Details">
                <Table
                  columns={inventoryColumns}
                  dataSource={inventoryData.chemicals}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 900 }}
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
      key: 'expiration',
      label: 'Expiration Tracking',
      children: (
        <Spin spinning={expirationLoading}>
          {expirationData ? (
            <>
              {(expirationData.summary.expired > 0 || expirationData.summary.expiringSoon > 0) && (
                <Alert
                  message="Expiration Alerts"
                  description={`${expirationData.summary.expired} chemicals have expired. ${expirationData.summary.expiringSoon} chemicals are expiring soon.`}
                  type={expirationData.summary.expired > 0 ? 'error' : 'warning'}
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Expired"
                      value={expirationData.summary.expired}
                      valueStyle={{ color: '#ff4d4f' }}
                      prefix={<CloseCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Expiring Soon"
                      value={expirationData.summary.expiringSoon}
                      valueStyle={{ color: '#faad14' }}
                      prefix={<WarningOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="30 Days"
                      value={expirationData.summary.expiring30Days}
                      prefix={<HistoryOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="60 Days"
                      value={expirationData.summary.expiring60Days}
                      prefix={<HistoryOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="90 Days"
                      value={expirationData.summary.expiring90Days}
                      prefix={<HistoryOutlined />}
                    />
                  </Card>
                </Col>
              </Row>

              <Card title="Expiration Timeline (Next 6 Months)" style={{ marginBottom: 24 }}>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={expirationData.expirationTimeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="#faad14" fill="#fffbe6" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Expiration Details">
                <Table
                  columns={expirationColumns}
                  dataSource={expirationData.chemicals}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 800 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No expiration data available" />
          )}
        </Spin>
      ),
    },
    {
      key: 'usage',
      label: 'Usage Analytics',
      children: (
        <Spin spinning={usageLoading}>
          {usageData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={8}>
                  <Card>
                    <Statistic
                      title="Total Used"
                      value={usageData.summary.totalUsed}
                      prefix={<ExperimentOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card>
                    <Statistic
                      title="Unique Chemicals"
                      value={usageData.summary.uniqueChemicals}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card>
                    <Statistic
                      title="Top User"
                      value={usageData.summary.topUsers[0]?.name || 'N/A'}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                  <Card title="Usage Trend">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={usageData.usageByDay}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="quantity" stroke="#1890ff" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="Top Chemicals Used">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={usageData.usageByChemical.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={150} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#722ed1" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card title="Top Users">
                <div style={{ marginBottom: 24 }}>
                  {usageData.summary.topUsers.slice(0, 5).map((user, index) => (
                    <div key={user.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span>{index + 1}. {user.name}</span>
                        <span>{user.value} units</span>
                      </div>
                      <Progress
                        percent={Math.round((user.value / usageData.summary.totalUsed) * 100)}
                        strokeColor={COLORS[index % COLORS.length]}
                        showInfo={false}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Usage History">
                <Table
                  columns={usageColumns}
                  dataSource={usageData.usage}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 800 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No usage data available" />
          )}
        </Spin>
      ),
    },
    {
      key: 'waste',
      label: 'Waste Tracking',
      children: (
        <Spin spinning={wasteLoading}>
          {wasteData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={8}>
                  <Card>
                    <Statistic
                      title="Total Waste"
                      value={wasteData.summary.totalWaste}
                      prefix={<DeleteOutlined />}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card>
                    <Statistic
                      title="Items Wasted"
                      value={wasteData.waste.length}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={8}>
                  <Card>
                    <Statistic
                      title="Est. Cost"
                      value={wasteData.summary.estimatedCost}
                      prefix="$"
                      precision={2}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                  <Card title="Waste by Reason">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={wasteData.summary.wasteByReason.filter(r => r.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {wasteData.summary.wasteByReason.map((_, index) => (
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
                  <Card title="Waste by Month">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={wasteData.wasteByMonth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="quantity" fill="#ff4d4f" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card title="Waste Details">
                <Table
                  columns={wasteColumns}
                  dataSource={wasteData.waste}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 800 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No waste data available" />
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
