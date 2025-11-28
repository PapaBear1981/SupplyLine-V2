import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Table,
  Tag,
  Space,
  Select,
  Input,
  Alert,
  Typography,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  ToolOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useGetKitsQuery, useGetAircraftTypesQuery } from '../services/kitsApi';
import type { Kit, KitStatus } from '../types';

const { Title } = Typography;
const { Option } = Select;

const KitsDashboard = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<KitStatus | undefined>();
  const [aircraftTypeFilter, setAircraftTypeFilter] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: kits = [], isLoading, error, refetch } = useGetKitsQuery({
    status: statusFilter,
    aircraft_type_id: aircraftTypeFilter,
  });

  const { data: aircraftTypes = [] } = useGetAircraftTypesQuery({});

  // Filter kits by search query
  const filteredKits = kits.filter((kit) =>
    kit.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate statistics
  const activeKits = kits.filter((kit) => kit.status === 'active').length;
  const maintenanceKits = kits.filter((kit) => kit.status === 'maintenance').length;
  const totalItems = kits.reduce((sum, kit) => sum + (kit.item_count || 0), 0);
  const pendingReorders = kits.reduce((sum, kit) => sum + (kit.pending_reorders || 0), 0);

  const getStatusColor = (status: KitStatus) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'maintenance':
        return 'warning';
      case 'inactive':
        return 'default';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<Kit> = [
    {
      title: 'Kit Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Kit) => (
        <a onClick={() => navigate(`/kits/${record.id}`)}>{name}</a>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Aircraft Type',
      dataIndex: 'aircraft_type_name',
      key: 'aircraft_type_name',
      sorter: (a, b) => (a.aircraft_type_name || '').localeCompare(b.aircraft_type_name || ''),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: KitStatus) => (
        <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
      ),
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Maintenance', value: 'maintenance' },
        { text: 'Inactive', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Boxes',
      dataIndex: 'box_count',
      key: 'box_count',
      sorter: (a, b) => (a.box_count || 0) - (b.box_count || 0),
    },
    {
      title: 'Items',
      dataIndex: 'item_count',
      key: 'item_count',
      sorter: (a, b) => (a.item_count || 0) - (b.item_count || 0),
    },
    {
      title: 'Pending Reorders',
      dataIndex: 'pending_reorders',
      key: 'pending_reorders',
      render: (count: number) =>
        count > 0 ? (
          <Badge count={count} showZero style={{ backgroundColor: '#faad14' }} />
        ) : (
          <span>0</span>
        ),
      sorter: (a, b) => (a.pending_reorders || 0) - (b.pending_reorders || 0),
    },
    {
      title: 'Created By',
      dataIndex: 'creator_name',
      key: 'creator_name',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: Kit) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/kits/${record.id}`)}>
            View
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/kits/${record.id}/edit`)}
          >
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Title level={2}>
              <ToolOutlined /> Mobile Warehouse (Kits)
            </Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => navigate('/kits/new')}
            >
              Create New Kit
            </Button>
          </Space>
        </Col>

        {/* Statistics Cards */}
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Kits"
              value={activeKits}
              prefix={<ToolOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="In Maintenance"
              value={maintenanceKits}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Items"
              value={totalItems}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending Reorders"
              value={pendingReorders}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: pendingReorders > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>

        {/* Filters */}
        <Col span={24}>
          <Card>
            <Row gutter={16} align="middle">
              <Col xs={24} sm={8} md={6}>
                <Input
                  placeholder="Search kits..."
                  prefix={<SearchOutlined />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  allowClear
                />
              </Col>
              <Col xs={24} sm={8} md={6}>
                <Select
                  placeholder="Filter by status"
                  style={{ width: '100%' }}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  allowClear
                >
                  <Option value="active">Active</Option>
                  <Option value="maintenance">Maintenance</Option>
                  <Option value="inactive">Inactive</Option>
                </Select>
              </Col>
              <Col xs={24} sm={8} md={6}>
                <Select
                  placeholder="Filter by aircraft type"
                  style={{ width: '100%' }}
                  value={aircraftTypeFilter}
                  onChange={setAircraftTypeFilter}
                  allowClear
                >
                  {aircraftTypes.map((type) => (
                    <Option key={type.id} value={type.id}>
                      {type.name}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col>
                <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                  Refresh
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Kits Table */}
        <Col span={24}>
          <Card>
            {error && (
              <Alert
                message="Error loading kits"
                description="Unable to fetch kits data. Please try again."
                type="error"
                style={{ marginBottom: 16 }}
              />
            )}
            <Table
              columns={columns}
              dataSource={filteredKits}
              rowKey="id"
              loading={isLoading}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} kits`,
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default KitsDashboard;
