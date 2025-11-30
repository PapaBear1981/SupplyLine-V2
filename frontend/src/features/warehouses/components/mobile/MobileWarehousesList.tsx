import { useState, useMemo } from 'react';
import {
  List,
  SearchBar,
  Tag,
  Skeleton,
  InfiniteScroll,
  PullToRefresh,
  FloatingBubble,
  Popup,
  Form,
  Input,
  Button,
  Picker,
  Switch,
  Toast,
  Dialog,
  SwipeAction,
  Empty,
} from 'antd-mobile';
import { AddOutline, FilterOutline, CloseOutline } from 'antd-mobile-icons';
import {
  HomeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import {
  useGetWarehousesQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  useDeleteWarehouseMutation,
} from '../../services/warehousesApi';
import type { Warehouse, WarehouseType, WarehouseFormData } from '../../types';
import './MobileWarehousesList.css';

// Warehouse type color mapping
const warehouseTypeColors: Record<WarehouseType, string> = {
  main: '#1890ff',
  satellite: '#52c41a',
};

const warehouseTypeOptions = [
  [
    { label: 'Main', value: 'main' },
    { label: 'Satellite', value: 'satellite' },
  ],
];

export const MobileWarehousesList = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<WarehouseType | ''>('');
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [showFormPopup, setShowFormPopup] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();

  // API queries
  const { data: warehousesData, isLoading, isFetching, refetch } = useGetWarehousesQuery({
    page,
    per_page: 20,
    warehouse_type: typeFilter || undefined,
  });
  const [createWarehouse, { isLoading: isCreating }] = useCreateWarehouseMutation();
  const [updateWarehouse, { isLoading: isUpdating }] = useUpdateWarehouseMutation();
  const [deleteWarehouse] = useDeleteWarehouseMutation();

  const warehouses = warehousesData?.warehouses || [];
  const hasMore = warehousesData ? page < warehousesData.pagination.pages : false;

  // Filter warehouses by search query
  const filteredWarehouses = useMemo(() => {
    if (!searchQuery) return warehouses;

    const lowerQuery = searchQuery.toLowerCase();
    return warehouses.filter(warehouse =>
      warehouse.name.toLowerCase().includes(lowerQuery) ||
      warehouse.city?.toLowerCase().includes(lowerQuery) ||
      warehouse.state?.toLowerCase().includes(lowerQuery) ||
      warehouse.address?.toLowerCase().includes(lowerQuery)
    );
  }, [warehouses, searchQuery]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleRefresh = async () => {
    setPage(1);
    await refetch();
  };

  const loadMore = async () => {
    if (hasMore) {
      setPage(p => p + 1);
    }
  };

  const handleWarehouseClick = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setShowDetailPopup(true);
  };

  const handleCreate = () => {
    setFormMode('create');
    setSelectedWarehouse(null);
    form.resetFields();
    form.setFieldsValue({
      warehouse_type: 'satellite',
      is_active: true,
      country: 'USA',
    });
    setShowFormPopup(true);
  };

  const handleEdit = (warehouse: Warehouse) => {
    setFormMode('edit');
    setSelectedWarehouse(warehouse);
    form.setFieldsValue({
      name: warehouse.name,
      address: warehouse.address || '',
      city: warehouse.city || '',
      state: warehouse.state || '',
      zip_code: warehouse.zip_code || '',
      country: warehouse.country || 'USA',
      warehouse_type: warehouse.warehouse_type,
      is_active: warehouse.is_active,
      contact_person: warehouse.contact_person || '',
      contact_phone: warehouse.contact_phone || '',
      contact_email: warehouse.contact_email || '',
    });
    setShowDetailPopup(false);
    setShowFormPopup(true);
  };

  const handleDelete = async (warehouse: Warehouse) => {
    const confirmed = await Dialog.confirm({
      content: `Are you sure you want to delete warehouse "${warehouse.name}"?`,
    });
    if (confirmed) {
      try {
        await deleteWarehouse(warehouse.id).unwrap();
        Toast.show({ content: 'Warehouse deleted', icon: 'success' });
        refetch();
      } catch {
        Toast.show({ content: 'Failed to delete warehouse', icon: 'fail' });
      }
    }
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      const formData: WarehouseFormData = {
        name: values.name,
        address: values.address || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        zip_code: values.zip_code || undefined,
        country: values.country || undefined,
        warehouse_type: values.warehouse_type,
        is_active: values.is_active !== undefined ? values.is_active : true,
        contact_person: values.contact_person || undefined,
        contact_phone: values.contact_phone || undefined,
        contact_email: values.contact_email || undefined,
      };

      if (formMode === 'create') {
        await createWarehouse(formData).unwrap();
        Toast.show({ content: 'Warehouse created', icon: 'success' });
      } else if (selectedWarehouse) {
        await updateWarehouse({ id: selectedWarehouse.id, data: formData }).unwrap();
        Toast.show({ content: 'Warehouse updated', icon: 'success' });
      }
      setShowFormPopup(false);
      refetch();
    } catch {
      Toast.show({ content: 'Failed to save warehouse', icon: 'fail' });
    }
  };

  const renderWarehouseItem = (warehouse: Warehouse) => (
    <SwipeAction
      key={warehouse.id}
      rightActions={[
        {
          key: 'edit',
          text: 'Edit',
          color: 'primary',
          onClick: () => handleEdit(warehouse),
        },
        {
          key: 'delete',
          text: 'Delete',
          color: 'danger',
          onClick: () => handleDelete(warehouse),
        },
      ]}
    >
      <List.Item
        onClick={() => handleWarehouseClick(warehouse)}
        prefix={
          <div
            className="warehouse-icon"
            style={{
              background: `${warehouseTypeColors[warehouse.warehouse_type]}15`,
              color: warehouseTypeColors[warehouse.warehouse_type]
            }}
          >
            <HomeOutlined />
          </div>
        }
        description={
          <div className="warehouse-item-desc">
            {warehouse.city && warehouse.state && (
              <span>{warehouse.city}, {warehouse.state}</span>
            )}
            {warehouse.address && (
              <span className="warehouse-address">{warehouse.address}</span>
            )}
            <div className="warehouse-item-tags">
              <Tag
                color={warehouseTypeColors[warehouse.warehouse_type]}
                fill="outline"
                style={{ '--border-radius': '4px' }}
              >
                {warehouse.warehouse_type}
              </Tag>
              <Tag
                color={warehouse.is_active ? 'success' : 'default'}
                fill="outline"
                style={{ '--border-radius': '4px' }}
              >
                {warehouse.is_active ? (
                  <>
                    <CheckCircleOutlined /> Active
                  </>
                ) : (
                  <>
                    <CloseCircleOutlined /> Inactive
                  </>
                )}
              </Tag>
            </div>
          </div>
        }
        arrow
      >
        <div className="warehouse-item-title">{warehouse.name}</div>
        {(warehouse.tools_count !== undefined || warehouse.chemicals_count !== undefined) && (
          <div className="warehouse-item-subtitle">
            {warehouse.tools_count !== undefined && `${warehouse.tools_count} tools`}
            {warehouse.tools_count !== undefined && warehouse.chemicals_count !== undefined && ' • '}
            {warehouse.chemicals_count !== undefined && `${warehouse.chemicals_count} chemicals`}
          </div>
        )}
      </List.Item>
    </SwipeAction>
  );

  return (
    <div className="mobile-warehouses-list">
      {/* Search Bar */}
      <div className="search-bar-container">
        <SearchBar
          placeholder="Search warehouses..."
          value={searchQuery}
          onChange={handleSearch}
          className="search-bar"
        />
        <div
          className={`filter-button ${typeFilter ? 'active' : ''}`}
          onClick={() => setShowFilterPopup(true)}
        >
          <FilterOutline />
        </div>
      </div>

      {/* Active Filters */}
      {typeFilter && (
        <div className="active-filters">
          <Tag
            color="primary"
            fill="outline"
            style={{ '--border-radius': '12px' }}
          >
            {typeFilter}
            <CloseOutline
              onClick={() => {
                setTypeFilter('');
                setPage(1);
              }}
              style={{ marginLeft: 4 }}
            />
          </Tag>
        </div>
      )}

      {/* Warehouse List */}
      <PullToRefresh onRefresh={handleRefresh}>
        {isLoading ? (
          <div style={{ padding: 16 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} animated className="warehouse-skeleton" />
            ))}
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <Empty description="No warehouses found" style={{ padding: '48px 0' }} />
        ) : (
          <List>
            {filteredWarehouses.map(renderWarehouseItem)}
          </List>
        )}
      </PullToRefresh>

      <InfiniteScroll loadMore={loadMore} hasMore={hasMore && !isFetching} />

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
            <span>Filter Warehouses</span>
            <Button
              size="small"
              onClick={() => {
                setTypeFilter('');
                setShowFilterPopup(false);
                setPage(1);
              }}
            >
              Clear
            </Button>
          </div>
          <List>
            <List.Item
              extra={typeFilter || 'All'}
              onClick={() => {}}
            >
              Type
            </List.Item>
          </List>
          <div className="filter-options">
            {warehouseTypeOptions[0].map(option => (
              <Tag
                key={option.value}
                color={typeFilter === option.value ? 'primary' : 'default'}
                onClick={() => {
                  setTypeFilter(option.value as WarehouseType);
                  setShowFilterPopup(false);
                  setPage(1);
                }}
                style={{ margin: 4, padding: '6px 12px' }}
              >
                {option.label}
              </Tag>
            ))}
          </div>
        </div>
      </Popup>

      {/* Warehouse Detail Popup */}
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
        {selectedWarehouse && (
          <div className="detail-popup">
            <div className="detail-header">
              <div className="detail-title">{selectedWarehouse.name}</div>
              <Tag color={warehouseTypeColors[selectedWarehouse.warehouse_type]}>
                {selectedWarehouse.warehouse_type}
              </Tag>
            </div>
            <List>
              <List.Item
                extra={
                  <Tag color={selectedWarehouse.is_active ? 'success' : 'default'}>
                    {selectedWarehouse.is_active ? 'Active' : 'Inactive'}
                  </Tag>
                }
              >
                Status
              </List.Item>
              {selectedWarehouse.address && (
                <List.Item extra={selectedWarehouse.address}>Address</List.Item>
              )}
              {selectedWarehouse.city && (
                <List.Item extra={selectedWarehouse.city}>City</List.Item>
              )}
              {selectedWarehouse.state && (
                <List.Item extra={selectedWarehouse.state}>State</List.Item>
              )}
              {selectedWarehouse.zip_code && (
                <List.Item extra={selectedWarehouse.zip_code}>ZIP Code</List.Item>
              )}
              {selectedWarehouse.country && (
                <List.Item extra={selectedWarehouse.country}>Country</List.Item>
              )}
              {selectedWarehouse.contact_person && (
                <List.Item extra={selectedWarehouse.contact_person}>Contact Person</List.Item>
              )}
              {selectedWarehouse.contact_phone && (
                <List.Item extra={selectedWarehouse.contact_phone}>Contact Phone</List.Item>
              )}
              {selectedWarehouse.contact_email && (
                <List.Item extra={selectedWarehouse.contact_email}>Contact Email</List.Item>
              )}
              {selectedWarehouse.tools_count !== undefined && (
                <List.Item extra={selectedWarehouse.tools_count}>Tools Count</List.Item>
              )}
              {selectedWarehouse.chemicals_count !== undefined && (
                <List.Item extra={selectedWarehouse.chemicals_count}>Chemicals Count</List.Item>
              )}
              {selectedWarehouse.expendables_count !== undefined && (
                <List.Item extra={selectedWarehouse.expendables_count}>Expendables Count</List.Item>
              )}
            </List>
            <div className="detail-actions">
              <Button block color="primary" onClick={() => handleEdit(selectedWarehouse)}>
                Edit Warehouse
              </Button>
            </div>
          </div>
        )}
      </Popup>

      {/* Warehouse Form Popup */}
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
            <span>{formMode === 'create' ? 'Add New Warehouse' : 'Edit Warehouse'}</span>
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
                {formMode === 'create' ? 'Create Warehouse' : 'Save Changes'}
              </Button>
            }
          >
            <Form.Item
              name="name"
              label="Warehouse Name"
              rules={[{ required: true, message: 'Warehouse name is required' }]}
            >
              <Input placeholder="e.g., Main Distribution Center" />
            </Form.Item>
            <Form.Item
              name="warehouse_type"
              label="Warehouse Type"
              rules={[{ required: true, message: 'Warehouse type is required' }]}
              trigger="onConfirm"
              onClick={(_e, pickerRef) => pickerRef.current?.open()}
            >
              <Picker columns={warehouseTypeOptions}>
                {(items) => items[0]?.label || 'Select type'}
              </Picker>
            </Form.Item>
            <Form.Item name="address" label="Address">
              <Input placeholder="Street address" />
            </Form.Item>
            <Form.Item name="city" label="City">
              <Input placeholder="City" />
            </Form.Item>
            <Form.Item name="state" label="State">
              <Input placeholder="State" />
            </Form.Item>
            <Form.Item name="zip_code" label="ZIP Code">
              <Input placeholder="ZIP code" />
            </Form.Item>
            <Form.Item name="country" label="Country">
              <Input placeholder="Country" />
            </Form.Item>
            <Form.Item name="contact_person" label="Contact Person">
              <Input placeholder="Contact name" />
            </Form.Item>
            <Form.Item name="contact_phone" label="Contact Phone">
              <Input placeholder="Phone number" />
            </Form.Item>
            <Form.Item
              name="contact_email"
              label="Contact Email"
              rules={[{ type: 'email', message: 'Please enter a valid email' }]}
            >
              <Input placeholder="email@example.com" />
            </Form.Item>
            <Form.Item
              name="is_active"
              label="Active Status"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Form>
        </div>
      </Popup>
    </div>
  );
};
