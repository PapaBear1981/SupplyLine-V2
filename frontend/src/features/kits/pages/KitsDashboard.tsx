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
import { useIsMobile } from '@shared/hooks/useMobile';
import { MobileKitsList } from '../components/mobile';
import { useFeatures } from '@features/auth/hooks/useFeatures';
import { NewFieldLocationModal } from '../components/NewFieldLocationModal';
import { EditKitModal } from '../components/EditKitModal';

const { Title } = Typography;
const { Option } = Select;

const KitsDashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { kitManagement } = useFeatures();
  const [statusFilter, setStatusFilter] = useState<KitStatus | undefined>();
  const [aircraftTypeFilter, setAircraftTypeFilter] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [newLocationOpen, setNewLocationOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);

  const { data: kits = [], isLoading, error, refetch } = useGetKitsQuery({
    status: statusFilter,
    aircraft_type_id: aircraftTypeFilter,
  });

  const { data: aircraftTypes = [] } = useGetAircraftTypesQuery({});

  // Render mobile version
  if (isMobile) {
    return <MobileKitsList />;
  }

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
      case 'deployed':
        return 'processing';
      case 'maintenance':
        return 'warning';
      case 'inactive':
        return 'default';
      case 'retired':
        return 'error';
      default:
        return 'default';
    }
  };

  const nameColumn = {
    title: kitManagement ? 'Kit Name' : 'Field Location',
    dataIndex: 'name',
    key: 'name',
    render: (name: string, record: Kit) =>
      kitManagement ? (
        <Button
          type="link"
          style={{ padding: 0, height: 'auto' }}
          onClick={() => navigate(`/kits/${record.id}`)}
        >
          {name}
        </Button>
      ) : (
        <Button
          type="link"
          style={{ padding: 0, height: 'auto' }}
          onClick={() => setEditingKit(record)}
        >
          {name}
        </Button>
      ),
    sorter: (a: Kit, b: Kit) => a.name.localeCompare(b.name),
  };

  const identityColumns: ColumnsType<Kit> = [
    {
      title: 'Tail #',
      dataIndex: 'aircraft_tail_number',
      key: 'aircraft_tail_number',
      render: (v?: string | null) => v || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Tanker #',
      dataIndex: 'tanker_scooper_number',
      key: 'tanker_scooper_number',
      render: (v?: string | null) => v || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Trailer #',
      dataIndex: 'trailer_number',
      key: 'trailer_number',
      render: (v?: string | null) => v || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Address',
      dataIndex: 'location_address',
      key: 'location_address',
      render: (v?: string | null) => v || <span style={{ color: '#999' }}>—</span>,
    },
  ];

  const statusColumn = {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: KitStatus) => (
      <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
    ),
    filters: [
      { text: 'Active', value: 'active' },
      { text: 'Deployed', value: 'deployed' },
      { text: 'Maintenance', value: 'maintenance' },
      { text: 'Inactive', value: 'inactive' },
      { text: 'Retired', value: 'retired' },
    ],
    onFilter: (value: boolean | React.Key, record: Kit) => record.status === value,
  };

  const aircraftTypeColumn = {
    title: 'Aircraft Type',
    dataIndex: 'aircraft_type_name',
    key: 'aircraft_type_name',
    sorter: (a: Kit, b: Kit) =>
      (a.aircraft_type_name || '').localeCompare(b.aircraft_type_name || ''),
  };

  const kitMgmtColumns: ColumnsType<Kit> = [
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
  ];

  const assignedColumn = {
    title: 'Assigned To',
    dataIndex: 'assigned_user_name',
    key: 'assigned_user_name',
    render: (name?: string | null) =>
      name || <span style={{ color: '#999' }}>Unassigned</span>,
    sorter: (a: Kit, b: Kit) =>
      (a.assigned_user_name || '').localeCompare(b.assigned_user_name || ''),
  };

  const columns: ColumnsType<Kit> = kitManagement
    ? [
        nameColumn,
        aircraftTypeColumn,
        statusColumn,
        ...kitMgmtColumns,
        assignedColumn,
      ]
    : [
        nameColumn,
        ...identityColumns,
        statusColumn,
        aircraftTypeColumn,
        assignedColumn,
      ];

  return (
    <div style={{ padding: '24px' }} data-testid="kits-page">
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Title level={2}>
              <ToolOutlined />{' '}
              {kitManagement ? 'Mobile Warehouse (Kits)' : 'Field Locations'}
            </Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() =>
                kitManagement ? navigate('/kits/new') : setNewLocationOpen(true)
              }
              data-testid="kits-create-button"
            >
              {kitManagement ? 'Create New Kit' : 'Register Field Location'}
            </Button>
          </Space>
        </Col>

        {/* Statistics Cards */}
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={kitManagement ? 'Active Kits' : 'Active Locations'}
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
        {kitManagement && (
          <>
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
                  valueStyle={{
                    color: pendingReorders > 0 ? '#cf1322' : '#3f8600',
                  }}
                />
              </Card>
            </Col>
          </>
        )}

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

      <NewFieldLocationModal
        open={newLocationOpen}
        onClose={() => setNewLocationOpen(false)}
      />
      <EditKitModal
        open={editingKit !== null}
        kit={editingKit}
        onClose={() => setEditingKit(null)}
      />
    </div>
  );
};

export default KitsDashboard;
