import { useState, useMemo } from 'react';
import {
  List,
  SearchBar,
  Tag,
  Skeleton,
  PullToRefresh,
  FloatingBubble,
  Popup,
  Form,
  Input,
  Button,
  Picker,
  TextArea,
  Toast,
  Dialog,
  SwipeAction,
  Empty,
} from 'antd-mobile';
import { AddOutline, FilterOutline, CloseOutline } from 'antd-mobile-icons';
import {
  ToolOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  useGetKitsQuery,
  useGetAircraftTypesQuery,
  useCreateKitMutation,
  useUpdateKitMutation,
  useDeleteKitMutation,
} from '../../services/kitsApi';
import type { Kit, KitStatus, KitFormData } from '../../types';
import { MobileKitDetail } from './MobileKitDetail';
import './MobileKitsList.css';

// Status color mapping
const statusColors: Record<KitStatus, string> = {
  active: '#52c41a',
  deployed: '#1890ff',
  maintenance: '#faad14',
  inactive: '#8c8c8c',
  retired: '#ff4d4f',
};

const statusOptions = [
  [
    { label: 'Active', value: 'active' },
    { label: 'Deployed', value: 'deployed' },
    { label: 'Maintenance', value: 'maintenance' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'Retired', value: 'retired' },
  ],
];

export const MobileKitsList = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<KitStatus | ''>('');
  const [aircraftTypeFilter, setAircraftTypeFilter] = useState<number | undefined>();
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [showFormPopup, setShowFormPopup] = useState(false);
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [form] = Form.useForm();

  // API queries
  const { data: kits = [], isLoading, refetch } = useGetKitsQuery({
    status: statusFilter || undefined,
    aircraft_type_id: aircraftTypeFilter,
  });
  const { data: aircraftTypes = [] } = useGetAircraftTypesQuery({});
  const [createKit, { isLoading: isCreating }] = useCreateKitMutation();
  const [updateKit, { isLoading: isUpdating }] = useUpdateKitMutation();
  const [deleteKit] = useDeleteKitMutation();

  // Filter kits by search query
  const filteredKits = useMemo(() => {
    return kits.filter((kit) =>
      kit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kit.aircraft_type_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [kits, searchQuery]);

  const aircraftTypeOptions = useMemo(() => {
    return [[
      { label: 'All Aircraft Types', value: '' },
      ...aircraftTypes.map(type => ({
        label: type.name,
        value: type.id,
      })),
    ]];
  }, [aircraftTypes]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const handleKitClick = (kit: Kit) => {
    setSelectedKit(kit);
    setShowDetailPopup(true);
  };

  const handleCreate = () => {
    setFormMode('create');
    setSelectedKit(null);
    form.resetFields();
    setShowFormPopup(true);
  };

  const handleEdit = (kit: Kit) => {
    setFormMode('edit');
    setSelectedKit(kit);
    form.setFieldsValue({
      name: kit.name,
      aircraft_type_id: kit.aircraft_type_id,
      description: kit.description || '',
      status: kit.status,
    });
    setShowDetailPopup(false);
    setShowFormPopup(true);
  };

  const handleDelete = async (kit: Kit) => {
    const confirmed = await Dialog.confirm({
      content: `Are you sure you want to delete kit "${kit.name}"?`,
    });
    if (confirmed) {
      try {
        await deleteKit(kit.id).unwrap();
        Toast.show({ content: 'Kit deleted', icon: 'success' });
        refetch();
      } catch {
        Toast.show({ content: 'Failed to delete kit', icon: 'fail' });
      }
    }
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      const formData: KitFormData = {
        name: values.name,
        aircraft_type_id: values.aircraft_type_id,
        description: values.description || undefined,
        status: values.status || 'active',
      };

      if (formMode === 'create') {
        await createKit(formData).unwrap();
        Toast.show({ content: 'Kit created', icon: 'success' });
      } else if (selectedKit) {
        await updateKit({ id: selectedKit.id, data: formData }).unwrap();
        Toast.show({ content: 'Kit updated', icon: 'success' });
      }
      setShowFormPopup(false);
      refetch();
    } catch {
      Toast.show({ content: 'Failed to save kit', icon: 'fail' });
    }
  };

  const getStatusIcon = (kit: Kit) => {
    if (kit.pending_reorders && kit.pending_reorders > 0) {
      return <ExclamationCircleOutlined />;
    }
    if (kit.status === 'maintenance') {
      return <WarningOutlined />;
    }
    if (kit.status === 'active' || kit.status === 'deployed') {
      return <CheckCircleOutlined />;
    }
    return <ToolOutlined />;
  };

  const renderKitItem = (kit: Kit) => (
    <SwipeAction
      key={kit.id}
      rightActions={[
        {
          key: 'edit',
          text: 'Edit',
          color: 'primary',
          onClick: () => handleEdit(kit),
        },
        {
          key: 'delete',
          text: 'Delete',
          color: 'danger',
          onClick: () => handleDelete(kit),
        },
      ]}
    >
      <List.Item
        onClick={() => handleKitClick(kit)}
        prefix={
          <div className="kit-icon" style={{ background: `${statusColors[kit.status]}15`, color: statusColors[kit.status] }}>
            {getStatusIcon(kit)}
          </div>
        }
        description={
          <div className="kit-item-desc">
            <span>{kit.aircraft_type_name || 'No Aircraft Type'}</span>
            {kit.description && <span className="kit-description">{kit.description}</span>}
            <div className="kit-item-tags">
              <Tag color={statusColors[kit.status]} fill="outline" style={{ '--border-radius': '4px' }}>
                {kit.status.replace('_', ' ')}
              </Tag>
              {kit.box_count !== undefined && (
                <Tag color="default" fill="outline" style={{ '--border-radius': '4px' }}>
                  {kit.box_count} {kit.box_count === 1 ? 'box' : 'boxes'}
                </Tag>
              )}
              {kit.item_count !== undefined && (
                <Tag color="default" fill="outline" style={{ '--border-radius': '4px' }}>
                  {kit.item_count} {kit.item_count === 1 ? 'item' : 'items'}
                </Tag>
              )}
              {kit.pending_reorders !== undefined && kit.pending_reorders > 0 && (
                <Tag color="warning" fill="solid" style={{ '--border-radius': '4px' }}>
                  <ExclamationCircleOutlined /> {kit.pending_reorders} pending
                </Tag>
              )}
            </div>
          </div>
        }
        arrow
      >
        <div className="kit-item-title">{kit.name}</div>
        {kit.trailer_number && (
          <div className="kit-item-subtitle">Trailer: {kit.trailer_number}</div>
        )}
      </List.Item>
    </SwipeAction>
  );

  return (
    <div className="mobile-kits-list">
      {/* Search Bar */}
      <div className="search-bar-container">
        <SearchBar
          placeholder="Search kits..."
          value={searchQuery}
          onChange={handleSearch}
          className="search-bar"
        />
        <div
          className={`filter-button ${statusFilter || aircraftTypeFilter ? 'active' : ''}`}
          onClick={() => setShowFilterPopup(true)}
        >
          <FilterOutline />
        </div>
      </div>

      {/* Active Filters */}
      {(statusFilter || aircraftTypeFilter) && (
        <div className="active-filters">
          {statusFilter && (
            <Tag
              color="primary"
              fill="outline"
              style={{ '--border-radius': '12px' }}
            >
              {statusFilter.replace('_', ' ')}
              <CloseOutline
                onClick={() => setStatusFilter('')}
                style={{ marginLeft: 4 }}
              />
            </Tag>
          )}
          {aircraftTypeFilter && (
            <Tag
              color="primary"
              fill="outline"
              style={{ '--border-radius': '12px' }}
            >
              {aircraftTypes.find(t => t.id === aircraftTypeFilter)?.name}
              <CloseOutline
                onClick={() => setAircraftTypeFilter(undefined)}
                style={{ marginLeft: 4 }}
              />
            </Tag>
          )}
        </div>
      )}

      {/* Kit List */}
      <PullToRefresh onRefresh={handleRefresh}>
        {isLoading ? (
          <div style={{ padding: 16 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} animated className="kit-skeleton" />
            ))}
          </div>
        ) : filteredKits.length === 0 ? (
          <Empty description="No kits found" style={{ padding: '48px 0' }} />
        ) : (
          <List>
            {filteredKits.map(renderKitItem)}
          </List>
        )}
      </PullToRefresh>

      {/* Floating Add Button */}
      <FloatingBubble
        style={{
          '--initial-position-bottom': '76px',
          '--initial-position-right': '16px',
          '--edge-distance': '16px',
        }}
        onClick={handleCreate}
      >
        <AddOutline fontSize={24} />
      </FloatingBubble>

      {/* Filter Popup */}
      <Popup
        visible={showFilterPopup}
        onMaskClick={() => setShowFilterPopup(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
      >
        <div className="filter-popup">
          <div className="filter-header">
            <span>Filter Kits</span>
            <Button
              size="small"
              onClick={() => {
                setStatusFilter('');
                setAircraftTypeFilter(undefined);
                setShowFilterPopup(false);
              }}
            >
              Clear
            </Button>
          </div>
          <List>
            <List.Item
              extra={statusFilter || 'All'}
              onClick={() => {}}
            >
              Status
            </List.Item>
          </List>
          <div className="filter-options">
            {statusOptions[0].map(option => (
              <Tag
                key={option.value}
                color={statusFilter === option.value ? 'primary' : 'default'}
                onClick={() => {
                  setStatusFilter(option.value as KitStatus);
                  setShowFilterPopup(false);
                }}
                style={{ margin: 4, padding: '6px 12px' }}
              >
                {option.label}
              </Tag>
            ))}
          </div>
          <List style={{ marginTop: 16 }}>
            <List.Item
              extra={aircraftTypes.find(t => t.id === aircraftTypeFilter)?.name || 'All'}
              onClick={() => {}}
            >
              Aircraft Type
            </List.Item>
          </List>
          <div className="filter-options">
            <Tag
              color={!aircraftTypeFilter ? 'primary' : 'default'}
              onClick={() => {
                setAircraftTypeFilter(undefined);
                setShowFilterPopup(false);
              }}
              style={{ margin: 4, padding: '6px 12px' }}
            >
              All Aircraft Types
            </Tag>
            {aircraftTypes.map(type => (
              <Tag
                key={type.id}
                color={aircraftTypeFilter === type.id ? 'primary' : 'default'}
                onClick={() => {
                  setAircraftTypeFilter(type.id);
                  setShowFilterPopup(false);
                }}
                style={{ margin: 4, padding: '6px 12px' }}
              >
                {type.name}
              </Tag>
            ))}
          </div>
        </div>
      </Popup>

      {/* Kit Detail Popup */}
      <Popup
        visible={showDetailPopup}
        onMaskClick={() => setShowDetailPopup(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        {selectedKit && (
          <MobileKitDetail
            kit={selectedKit}
            onEdit={handleEdit}
            onClose={() => setShowDetailPopup(false)}
          />
        )}
      </Popup>

      {/* Kit Form Popup */}
      <Popup
        visible={showFormPopup}
        onMaskClick={() => setShowFormPopup(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          height: '90vh',
          overflow: 'auto',
        }}
      >
        <div className="form-popup">
          <div className="form-header">
            <span>{formMode === 'create' ? 'Add New Kit' : 'Edit Kit'}</span>
            <CloseOutline onClick={() => setShowFormPopup(false)} />
          </div>
          <Form
            form={form}
            layout="vertical"
            footer={
              <Button
                block
                color="primary"
                loading={isCreating || isUpdating}
                onClick={handleFormSubmit}
              >
                {formMode === 'create' ? 'Create Kit' : 'Save Changes'}
              </Button>
            }
          >
            <Form.Item
              name="name"
              label="Kit Name"
              rules={[{ required: true, message: 'Kit name is required' }]}
            >
              <Input placeholder="Enter kit name" />
            </Form.Item>
            <Form.Item
              name="aircraft_type_id"
              label="Aircraft Type"
              rules={[{ required: true, message: 'Aircraft type is required' }]}
              trigger="onConfirm"
              onClick={(_e, pickerRef) => pickerRef.current?.open()}
            >
              <Picker columns={aircraftTypeOptions}>
                {(items) => {
                  const selected = aircraftTypes.find(t => t.id === items[0]?.value);
                  return selected?.name || 'Select aircraft type';
                }}
              </Picker>
            </Form.Item>
            <Form.Item
              name="description"
              label="Description"
            >
              <TextArea placeholder="Enter description (optional)" rows={3} />
            </Form.Item>
            <Form.Item
              name="status"
              label="Status"
              trigger="onConfirm"
              onClick={(_e, pickerRef) => pickerRef.current?.open()}
            >
              <Picker columns={statusOptions}>
                {(items) => items[0]?.label || 'Select status'}
              </Picker>
            </Form.Item>
          </Form>
        </div>
      </Popup>
    </div>
  );
};
