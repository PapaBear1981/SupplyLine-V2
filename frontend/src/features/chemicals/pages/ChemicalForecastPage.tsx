import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AlertOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useGetChemicalForecastQuery } from '../services/chemicalsApi';
import type { ChemicalForecastRow, ChemicalForecastParams } from '../types';
import { useCreateRequestMutation } from '@features/orders/services/requestsApi';

const { Title, Text, Paragraph } = Typography;

const URGENCY_CONFIG: Record<string, { color: string; label: string; icon?: React.ReactNode }> = {
  critical:    { color: 'error',   label: 'Critical — Order Now' },
  soon:        { color: 'warning', label: 'Reorder Soon' },
  expiry_risk: { color: 'gold',    label: 'Expiry Risk' },
  ok:          { color: 'success', label: 'OK' },
  no_data:     { color: 'default', label: 'No Usage Data' },
};

const urgencyTagColor: Record<string, string> = {
  critical:    'red',
  soon:        'orange',
  expiry_risk: 'gold',
  ok:          'green',
  no_data:     'default',
};

interface ReorderModalProps {
  row: ChemicalForecastRow | null;
  onClose: () => void;
}

const ReorderModal = ({ row, onClose }: ReorderModalProps) => {
  const [form] = Form.useForm();
  const [createRequest, { isLoading }] = useCreateRequestMutation();

  if (!row) return null;

  const handleSubmit = async (values: { quantity: number; notes: string; priority: string }) => {
    try {
      await createRequest({
        title: `Reorder: ${row.description} (${row.part_number})`,
        description: `Forecast-driven reorder request. Current stock: ${row.current_quantity} ${row.unit}. Days remaining: ${row.days_of_stock_remaining ?? 'N/A'}.`,
        priority: values.priority as 'routine' | 'urgent' | 'aog',
        notes: values.notes || undefined,
        request_type: 'manual',
        items: [
          {
            item_type: 'chemical',
            part_number: row.part_number,
            description: row.description,
            quantity: values.quantity,
            unit: row.unit,
          },
        ],
      }).unwrap();
      message.success(`Reorder request created for ${row.part_number}`);
      onClose();
    } catch {
      message.error('Failed to create reorder request');
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ShoppingCartOutlined />
          Request Reorder — {row.part_number}
        </Space>
      }
      open={!!row}
      onCancel={onClose}
      footer={null}
      width={480}
    >
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {row.description}
        {row.manufacturer && ` · ${row.manufacturer}`}
      </Paragraph>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Statistic title="Current Stock" value={row.current_quantity} suffix={row.unit} valueStyle={{ fontSize: 16 }} />
        </Col>
        <Col span={8}>
          <Statistic title="Weekly Use" value={row.weekly_consumption_rate.toFixed(1)} suffix={row.unit} valueStyle={{ fontSize: 16 }} />
        </Col>
        <Col span={8}>
          <Statistic
            title="Days Left"
            value={row.days_of_stock_remaining ?? '—'}
            valueStyle={{ fontSize: 16, color: row.urgency === 'critical' ? '#ff4d4f' : row.urgency === 'soon' ? '#fa8c16' : undefined }}
          />
        </Col>
      </Row>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          quantity: row.recommended_order_quantity ?? 1,
          priority: row.urgency === 'critical' ? 'aog' : row.urgency === 'soon' ? 'urgent' : 'routine',
          notes: '',
        }}
      >
        <Form.Item name="quantity" label={`Order Quantity (${row.unit})`} rules={[{ required: true }]}>
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="priority" label="Priority">
          <Select>
            <Select.Option value="routine">Routine</Select.Option>
            <Select.Option value="urgent">Urgent</Select.Option>
            <Select.Option value="aog">AOG — Aircraft on Ground</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="notes" label="Notes (optional)">
          <Form.Item name="notes" noStyle>
            <input
              style={{ width: '100%', padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6 }}
              placeholder="Additional context for procurement..."
            />
          </Form.Item>
        </Form.Item>
        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={isLoading} icon={<ShoppingCartOutlined />}>
              Submit Request
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export const ChemicalForecastPage = () => {
  const [params, setParams] = useState<ChemicalForecastParams>({
    analysis_days: 90,
    lead_time_days: 14,
    safety_stock_days: 14,
  });
  const [filterMode, setFilterMode] = useState<'all' | 'attention' | 'expiry'>('all');
  const [reorderRow, setReorderRow] = useState<ChemicalForecastRow | null>(null);

  const { data, isFetching, refetch, error } = useGetChemicalForecastQuery(params);

  const filteredForecasts = (data?.forecasts ?? []).filter((row) => {
    if (filterMode === 'attention') return row.urgency === 'critical' || row.urgency === 'soon';
    if (filterMode === 'expiry')    return row.urgency === 'expiry_risk' || row.waste_risk_quantity > 0;
    return true;
  });

  const columns: ColumnsType<ChemicalForecastRow> = [
    {
      title: 'Chemical',
      key: 'chemical',
      width: 220,
      render: (_, row) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{row.part_number}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{row.description}</Text>
          {row.manufacturer && (
            <>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>{row.manufacturer}</Text>
            </>
          )}
        </div>
      ),
    },
    {
      title: 'Stock',
      key: 'stock',
      width: 90,
      align: 'right',
      render: (_, row) => (
        <Text>{row.current_quantity} {row.unit}</Text>
      ),
    },
    {
      title: 'Use / Week',
      dataIndex: 'weekly_consumption_rate',
      width: 95,
      align: 'right',
      sorter: (a, b) => a.weekly_consumption_rate - b.weekly_consumption_rate,
      render: (val, row) => val > 0
        ? <Text>{val.toFixed(1)} {row.unit}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Days Left',
      dataIndex: 'days_of_stock_remaining',
      width: 90,
      align: 'right',
      sorter: (a, b) => (a.days_of_stock_remaining ?? 9999) - (b.days_of_stock_remaining ?? 9999),
      render: (val) => {
        if (val === null) return <Text type="secondary">—</Text>;
        const color = val <= 14 ? '#ff4d4f' : val <= 28 ? '#fa8c16' : '#52c41a';
        return <Text style={{ color, fontWeight: 600 }}>{Math.round(val)}</Text>;
      },
    },
    {
      title: 'Depletion',
      dataIndex: 'projected_depletion_date',
      width: 105,
      render: (val) => val ? <Text style={{ fontSize: 12 }}>{val}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Expiry',
      dataIndex: 'earliest_expiry_date',
      width: 105,
      sorter: (a, b) => (a.earliest_expiry_date ?? 'z').localeCompare(b.earliest_expiry_date ?? 'z'),
      render: (val, row) => {
        if (!val) return <Text type="secondary">—</Text>;
        const urgent = row.days_until_expiry !== null && row.days_until_expiry <= 30;
        return <Text style={{ fontSize: 12, color: urgent ? '#fa8c16' : undefined }}>{val}</Text>;
      },
    },
    {
      title: 'Waste Risk',
      dataIndex: 'waste_risk_quantity',
      width: 95,
      align: 'right',
      sorter: (a, b) => a.waste_risk_quantity - b.waste_risk_quantity,
      render: (val, row) => val > 0
        ? <Text type="warning">{val.toFixed(1)} {row.unit}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Urgency',
      dataIndex: 'urgency',
      width: 130,
      filters: [
        { text: 'Critical', value: 'critical' },
        { text: 'Soon', value: 'soon' },
        { text: 'Expiry Risk', value: 'expiry_risk' },
        { text: 'OK', value: 'ok' },
        { text: 'No Data', value: 'no_data' },
      ],
      onFilter: (value, record) => record.urgency === value,
      render: (val) => (
        <Tag color={urgencyTagColor[val] ?? 'default'}>
          {URGENCY_CONFIG[val]?.label ?? val}
        </Tag>
      ),
    },
    {
      title: 'Rec. Order',
      dataIndex: 'recommended_order_quantity',
      width: 100,
      align: 'right',
      render: (val, row) => val
        ? <Text strong>{val} {row.unit}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_, row) => (
        <Tooltip title="Request Reorder">
          <Button
            size="small"
            icon={<ShoppingCartOutlined />}
            onClick={() => setReorderRow(row)}
            type={row.needs_reorder ? 'primary' : 'default'}
          />
        </Tooltip>
      ),
    },
  ];

  const summary = data?.summary;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <ExperimentOutlined style={{ marginRight: 8 }} />
          Chemical Demand Forecast
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
          Consumption-based reorder and expiry forecasting across all active chemical inventory.
        </Paragraph>
      </div>

      {error && (
        <Alert message="Failed to load forecast data" type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      {/* Config row */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap align="center">
          <Text strong>Analysis window:</Text>
          <Select
            value={params.analysis_days}
            onChange={(v) => setParams((p) => ({ ...p, analysis_days: v }))}
            style={{ width: 110 }}
            options={[
              { value: 30,  label: '30 days' },
              { value: 60,  label: '60 days' },
              { value: 90,  label: '90 days' },
              { value: 180, label: '180 days' },
              { value: 365, label: '1 year' },
            ]}
          />
          <Text strong>Lead time:</Text>
          <InputNumber
            min={1} max={90}
            value={params.lead_time_days}
            onChange={(v) => setParams((p) => ({ ...p, lead_time_days: v ?? 14 }))}
            addonAfter="days"
            style={{ width: 115 }}
          />
          <Text strong>Safety stock:</Text>
          <InputNumber
            min={0} max={90}
            value={params.safety_stock_days}
            onChange={(v) => setParams((p) => ({ ...p, safety_stock_days: v ?? 14 }))}
            addonAfter="days"
            style={{ width: 115 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Summary cards */}
      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" style={{ borderColor: '#ff4d4f' }}>
              <Statistic
                title={<><AlertOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />Critical</>}
                value={summary.critical}
                valueStyle={{ color: '#ff4d4f' }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>Order now</Text>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" style={{ borderColor: '#fa8c16' }}>
              <Statistic
                title={<><WarningOutlined style={{ color: '#fa8c16', marginRight: 4 }} />Reorder Soon</>}
                value={summary.reorder_soon}
                valueStyle={{ color: '#fa8c16' }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>Within safety window</Text>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" style={{ borderColor: '#faad14' }}>
              <Statistic
                title="Expiry Risk"
                value={summary.expiry_risk}
                valueStyle={{ color: '#faad14' }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>May expire unused</Text>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic title="OK" value={summary.ok} valueStyle={{ color: '#52c41a' }} />
              <Text type="secondary" style={{ fontSize: 11 }}>Sufficient stock</Text>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic title="No Usage Data" value={summary.no_history} />
              <Text type="secondary" style={{ fontSize: 11 }}>No issuance history</Text>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" style={{ borderColor: summary.total_waste_risk_qty > 0 ? '#faad14' : undefined }}>
              <Statistic
                title="Waste Risk"
                value={summary.total_waste_risk_qty.toFixed(1)}
                suffix="units"
                valueStyle={{ color: summary.total_waste_risk_qty > 0 ? '#faad14' : undefined }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>Projected loss to expiry</Text>
            </Card>
          </Col>
        </Row>
      )}

      {/* Filter bar */}
      <Space style={{ marginBottom: 12 }}>
        <Text type="secondary">Show:</Text>
        <Button
          type={filterMode === 'all' ? 'primary' : 'default'}
          size="small"
          onClick={() => setFilterMode('all')}
        >
          All ({data?.forecasts?.length ?? 0})
        </Button>
        <Button
          type={filterMode === 'attention' ? 'primary' : 'default'}
          size="small"
          danger={filterMode === 'attention'}
          onClick={() => setFilterMode('attention')}
        >
          <Badge count={(summary?.critical ?? 0) + (summary?.reorder_soon ?? 0)} size="small">
            Needs Attention
          </Badge>
        </Button>
        <Button
          type={filterMode === 'expiry' ? 'primary' : 'default'}
          size="small"
          onClick={() => setFilterMode('expiry')}
        >
          Expiry Risk ({summary?.expiry_risk ?? 0})
        </Button>
      </Space>

      <Table
        dataSource={filteredForecasts}
        columns={columns}
        rowKey="part_number"
        loading={isFetching}
        size="small"
        pagination={{ pageSize: 25, showSizeChanger: true }}
        scroll={{ x: 1000 }}
        rowClassName={(row) =>
          row.urgency === 'critical' ? 'ant-table-row-danger'
          : row.urgency === 'soon' ? 'ant-table-row-warning'
          : ''
        }
      />

      <ReorderModal row={reorderRow} onClose={() => setReorderRow(null)} />

      {data?.parameters && (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
          Based on {data.parameters.analysis_window_days}-day consumption history ·
          Lead time {data.parameters.lead_time_days}d ·
          Safety stock {data.parameters.safety_stock_days}d ·
          Generated {new Date(data.generated_at ?? '').toLocaleString()}
        </Text>
      )}
    </div>
  );
};
