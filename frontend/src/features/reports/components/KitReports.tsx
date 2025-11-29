import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tabs, Tag, Spin, Empty, Progress } from 'antd';
import {
  InboxOutlined,
  SendOutlined,
  SwapOutlined,
  ShoppingOutlined,
  WarningOutlined,
  CheckCircleOutlined,
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
  useGetKitInventoryReportQuery,
  useGetKitIssuanceReportQuery,
  useGetKitTransferReportQuery,
  useGetKitReorderReportQuery,
} from '../services/reportsApi';
import type {
  ReportTimeframe,
  KitInventoryReportItem,
  KitIssuanceReportItem,
  KitTransferReportItem,
  KitReorderReportItem
} from '../types';

import styles from '../pages/ReportsPage.module.scss';

interface KitReportsProps {
  timeframe: ReportTimeframe;
  dateParams: Record<string, string | ReportTimeframe>;
  onReportDataChange: (data: unknown, reportType: string) => void;
}

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2'];

export function KitReports({ dateParams, onReportDataChange }: KitReportsProps) {
  const [activeSubTab, setActiveSubTab] = useState('inventory');

  const { data: inventoryData, isLoading: inventoryLoading } = useGetKitInventoryReportQuery(dateParams);
  const { data: issuanceData, isLoading: issuanceLoading } = useGetKitIssuanceReportQuery(dateParams);
  const { data: transferData, isLoading: transferLoading } = useGetKitTransferReportQuery(dateParams);
  const { data: reorderData, isLoading: reorderLoading } = useGetKitReorderReportQuery(dateParams);

  useEffect(() => {
    if (activeSubTab === 'inventory' && inventoryData) {
      onReportDataChange(inventoryData, 'kit-inventory');
    } else if (activeSubTab === 'issuances' && issuanceData) {
      onReportDataChange(issuanceData, 'kit-issuances');
    } else if (activeSubTab === 'transfers' && transferData) {
      onReportDataChange(transferData, 'kit-transfers');
    } else if (activeSubTab === 'reorders' && reorderData) {
      onReportDataChange(reorderData, 'kit-reorders');
    }
  }, [activeSubTab, inventoryData, issuanceData, transferData, reorderData, onReportDataChange]);

  const inventoryColumns: ColumnsType<KitInventoryReportItem> = [
    {
      title: 'Kit Name',
      dataIndex: 'kit_name',
      key: 'kit_name',
      sorter: (a, b) => a.kit_name.localeCompare(b.kit_name),
    },
    {
      title: 'Aircraft Type',
      dataIndex: 'aircraft_type',
      key: 'aircraft_type',
      filters: inventoryData?.byAircraftType.map(t => ({ text: t.name, value: t.name })) || [],
      onFilter: (value, record) => record.aircraft_type === value,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'active' ? 'success' : status === 'inactive' ? 'default' : 'warning';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Items',
      dataIndex: 'total_items',
      key: 'total_items',
      sorter: (a, b) => a.total_items - b.total_items,
    },
    {
      title: 'Expendables',
      dataIndex: 'total_expendables',
      key: 'total_expendables',
    },
    {
      title: 'Low Stock',
      dataIndex: 'low_stock_items',
      key: 'low_stock_items',
      render: (count: number) => count > 0 ? <Tag color="warning">{count}</Tag> : '-',
    },
    {
      title: 'Boxes',
      dataIndex: 'boxes',
      key: 'boxes',
    },
    {
      title: 'Last Activity',
      dataIndex: 'last_activity',
      key: 'last_activity',
      render: (date: string | null) => date ? new Date(date).toLocaleDateString() : 'N/A',
    },
  ];

  const issuanceColumns: ColumnsType<KitIssuanceReportItem> = [
    {
      title: 'Date',
      dataIndex: 'issued_date',
      key: 'issued_date',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a, b) => new Date(a.issued_date).getTime() - new Date(b.issued_date).getTime(),
    },
    {
      title: 'Kit',
      dataIndex: 'kit_name',
      key: 'kit_name',
    },
    {
      title: 'Item',
      dataIndex: 'item_name',
      key: 'item_name',
      ellipsis: true,
    },
    {
      title: 'Part #',
      dataIndex: 'part_number',
      key: 'part_number',
    },
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: 'Issued To',
      dataIndex: 'issued_to',
      key: 'issued_to',
    },
    {
      title: 'Issued By',
      dataIndex: 'issued_by',
      key: 'issued_by',
    },
    {
      title: 'Work Order',
      dataIndex: 'work_order',
      key: 'work_order',
    },
  ];

  const transferColumns: ColumnsType<KitTransferReportItem> = [
    {
      title: 'Date',
      dataIndex: 'transferred_date',
      key: 'transferred_date',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Source Kit',
      dataIndex: 'source_kit_name',
      key: 'source_kit_name',
    },
    {
      title: 'Destination',
      dataIndex: 'destination_name',
      key: 'destination_name',
    },
    {
      title: 'Dest. Type',
      dataIndex: 'destination_type',
      key: 'destination_type',
      render: (type: string) => <Tag color={type === 'kit' ? 'blue' : 'green'}>{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Item',
      dataIndex: 'item_name',
      key: 'item_name',
      ellipsis: true,
    },
    {
      title: 'Part #',
      dataIndex: 'part_number',
      key: 'part_number',
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: 'Transferred By',
      dataIndex: 'transferred_by',
      key: 'transferred_by',
    },
  ];

  const reorderColumns: ColumnsType<KitReorderReportItem> = [
    {
      title: 'Date',
      dataIndex: 'requested_date',
      key: 'requested_date',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Kit',
      dataIndex: 'kit_name',
      key: 'kit_name',
    },
    {
      title: 'Item',
      dataIndex: 'item_name',
      key: 'item_name',
      ellipsis: true,
    },
    {
      title: 'Part #',
      dataIndex: 'part_number',
      key: 'part_number',
    },
    {
      title: 'Qty',
      dataIndex: 'quantity_requested',
      key: 'quantity_requested',
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => {
        const colors: Record<string, string> = {
          low: 'default',
          medium: 'blue',
          high: 'orange',
          urgent: 'red',
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
          pending: 'default',
          approved: 'blue',
          ordered: 'cyan',
          fulfilled: 'success',
          cancelled: 'error',
        };
        return <Tag color={colors[status]}>{status.replace('_', ' ').toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Requested By',
      dataIndex: 'requested_by',
      key: 'requested_by',
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
                      title="Total Kits"
                      value={inventoryData.summary.totalKits}
                      prefix={<InboxOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Active Kits"
                      value={inventoryData.summary.activeKits}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Total Items"
                      value={inventoryData.summary.totalItems}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Expendables"
                      value={inventoryData.summary.totalExpendables}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Low Stock Alerts"
                      value={inventoryData.summary.lowStockAlerts}
                      valueStyle={{ color: inventoryData.summary.lowStockAlerts > 0 ? '#faad14' : undefined }}
                      prefix={<WarningOutlined />}
                    />
                  </Card>
                </Col>
              </Row>

              <Card title="Kits by Aircraft Type" style={{ marginBottom: 24 }}>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={inventoryData.byAircraftType}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {inventoryData.byAircraftType.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Kit Inventory Details">
                <Table
                  columns={inventoryColumns}
                  dataSource={inventoryData.kits}
                  rowKey="kit_id"
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
      key: 'issuances',
      label: 'Issuances',
      children: (
        <Spin spinning={issuanceLoading}>
          {issuanceData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Total Issuances"
                      value={issuanceData.summary.totalIssuances}
                      prefix={<SendOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Unique Kits"
                      value={issuanceData.summary.uniqueKits}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Unique Items"
                      value={issuanceData.summary.uniqueItems}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Total Quantity"
                      value={issuanceData.summary.totalQuantity}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                  <Card title="Issuances by Day">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={issuanceData.issuancesByDay}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="count" stroke="#1890ff" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="Top Kits">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={issuanceData.issuancesByKit.slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={150} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#1890ff" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card title="Top Items Issued" style={{ marginBottom: 24 }}>
                {issuanceData.topItems.slice(0, 5).map((item, index) => (
                  <div key={item.name} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{index + 1}. {item.name}</span>
                      <span>{item.value} issued</span>
                    </div>
                    <Progress
                      percent={Math.round((item.value / issuanceData.summary.totalQuantity) * 100)}
                      strokeColor={COLORS[index % COLORS.length]}
                      showInfo={false}
                    />
                  </div>
                ))}
              </Card>

              <Card title="Issuance Details">
                <Table
                  columns={issuanceColumns}
                  dataSource={issuanceData.issuances}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 1000 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No issuance data available" />
          )}
        </Spin>
      ),
    },
    {
      key: 'transfers',
      label: 'Transfers',
      children: (
        <Spin spinning={transferLoading}>
          {transferData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Total Transfers"
                      value={transferData.summary.totalTransfers}
                      prefix={<SwapOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Kit to Kit"
                      value={transferData.summary.toKits}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="To Warehouse"
                      value={transferData.summary.toWarehouse}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card>
                    <Statistic
                      title="Unique Items"
                      value={transferData.summary.uniqueItems}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                  <Card title="Transfers by Day">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={transferData.transfersByDay}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="count" stroke="#722ed1" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card title="Transfer Activity by Kit">
                    <div style={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={transferData.transfersByKit.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="outgoing" fill="#ff4d4f" name="Outgoing" />
                          <Bar dataKey="incoming" fill="#52c41a" name="Incoming" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card title="Transfer Details">
                <Table
                  columns={transferColumns}
                  dataSource={transferData.transfers}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 900 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No transfer data available" />
          )}
        </Spin>
      ),
    },
    {
      key: 'reorders',
      label: 'Reorder Requests',
      children: (
        <Spin spinning={reorderLoading}>
          {reorderData ? (
            <>
              <Row gutter={[16, 16]} className={styles.statsRow}>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Total Reorders"
                      value={reorderData.summary.totalReorders}
                      prefix={<ShoppingOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Pending"
                      value={reorderData.summary.pending}
                      valueStyle={{ color: '#8c8c8c' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Approved"
                      value={reorderData.summary.approved}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Ordered"
                      value={reorderData.summary.ordered}
                      valueStyle={{ color: '#13c2c2' }}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={4}>
                  <Card>
                    <Statistic
                      title="Received"
                      value={reorderData.summary.received}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={8}>
                  <Card title="By Priority">
                    <div style={{ height: 250 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reorderData.byPriority}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {reorderData.byPriority.map((entry, index) => (
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
                  <Card title="By Status">
                    <div style={{ height: 250 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reorderData.byStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {reorderData.byStatus.map((_, index) => (
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
                  <Card title="By Month">
                    <div style={{ height: 250 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reorderData.reordersByMonth}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#faad14" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </Col>
              </Row>

              <Card title="Reorder Request Details">
                <Table
                  columns={reorderColumns}
                  dataSource={reorderData.reorders}
                  rowKey="id"
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 1000 }}
                />
              </Card>
            </>
          ) : (
            <Empty description="No reorder data available" />
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
