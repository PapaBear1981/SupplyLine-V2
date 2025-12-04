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
  TextArea,
  DatePicker,
  Toast,
  Dialog,
  SwipeAction,
  Empty,
} from 'antd-mobile';
import { AddOutline, FilterOutline, CloseOutline } from 'antd-mobile-icons';
import {
  ExperimentOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetChemicalsQuery, useCreateChemicalMutation, useUpdateChemicalMutation, useDeleteChemicalMutation } from '../../services/chemicalsApi';
import { useGetWarehousesQuery } from '@features/warehouses/services/warehousesApi';
import type { Chemical, ChemicalStatus, ChemicalFormData } from '../../types';
import './MobileChemicalsList.css';

// Status color mapping
const statusColors: Record<ChemicalStatus, string> = {
  available: '#52c41a',
  low_stock: '#faad14',
  out_of_stock: '#ff4d4f',
  expired: '#8c8c8c',
};

const statusOptions = [
  [
    { label: 'Available', value: 'available' },
    { label: 'Low Stock', value: 'low_stock' },
    { label: 'Out of Stock', value: 'out_of_stock' },
    { label: 'Expired', value: 'expired' },
  ],
];

export const MobileChemicalsList = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChemicalStatus | ''>('');
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [showFormPopup, setShowFormPopup] = useState(false);
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();

  // API queries
  const { data: chemicalsData, isLoading, isFetching, refetch } = useGetChemicalsQuery({
    page,
    per_page: 20,
    q: searchQuery || undefined,
    status: statusFilter || undefined,
  });
  const { data: warehousesData } = useGetWarehousesQuery();
  const [createChemical, { isLoading: isCreating }] = useCreateChemicalMutation();
  const [updateChemical, { isLoading: isUpdating }] = useUpdateChemicalMutation();
  const [deleteChemical] = useDeleteChemicalMutation();

  const chemicals = chemicalsData?.chemicals || [];
  const hasMore = chemicalsData ? page < chemicalsData.pagination.pages : false;

  const warehouseOptions = useMemo(() => {
    const warehouses = warehousesData?.warehouses || [];
    if (warehouses.length === 0) {
      return [[{ label: 'Loading...', value: '' }]];
    }
    return [[
      ...warehouses.map(w => ({
        label: w.name,
        value: w.id,
      })),
    ]];
  }, [warehousesData]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
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

  const handleChemicalClick = (chemical: Chemical) => {
    setSelectedChemical(chemical);
    setShowDetailPopup(true);
  };

  const handleCreate = () => {
    setFormMode('create');
    setSelectedChemical(null);
    form.resetFields();
    setShowFormPopup(true);
  };

  const handleEdit = (chemical: Chemical) => {
    setFormMode('edit');
    setSelectedChemical(chemical);

    // Parse expiration date safely
    let expirationDate: Date | undefined;
    if (chemical.expiration_date) {
      const parsed = dayjs(chemical.expiration_date);
      if (parsed.isValid()) {
        expirationDate = parsed.toDate();
      }
    }

    form.setFieldsValue({
      part_number: chemical.part_number,
      lot_number: chemical.lot_number,
      description: chemical.description || '',
      manufacturer: chemical.manufacturer || '',
      quantity: chemical.quantity,
      unit: chemical.unit,
      location: chemical.location || '',
      category: chemical.category || '',
      status: chemical.status,
      warehouse_id: chemical.warehouse_id,
      expiration_date: expirationDate,
      minimum_stock_level: chemical.minimum_stock_level,
      notes: chemical.notes || '',
    });
    setShowDetailPopup(false);
    setShowFormPopup(true);
  };

  const handleDelete = async (chemical: Chemical) => {
    const confirmed = await Dialog.confirm({
      content: `Are you sure you want to delete chemical ${chemical.part_number}?`,
    });
    if (confirmed) {
      try {
        await deleteChemical(chemical.id).unwrap();
        Toast.show({ content: 'Chemical deleted', icon: 'success' });
        refetch();
      } catch {
        Toast.show({ content: 'Failed to delete chemical', icon: 'fail' });
      }
    }
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();

      const formData: ChemicalFormData = {
        part_number: values.part_number,
        lot_number: values.lot_number,
        description: values.description || undefined,
        manufacturer: values.manufacturer || undefined,
        quantity: values.quantity,
        unit: values.unit,
        location: values.location,  // Required field
        category: values.category || undefined,
        status: values.status || 'available',
        warehouse_id: values.warehouse_id || undefined,
        expiration_date: values.expiration_date ? dayjs(values.expiration_date).format('YYYY-MM-DD') : undefined,
        minimum_stock_level: values.minimum_stock_level || undefined,
        notes: values.notes || undefined,
      };

      if (formMode === 'create') {
        await createChemical(formData).unwrap();
        Toast.show({ content: 'Chemical created', icon: 'success' });
      } else if (selectedChemical) {
        await updateChemical({ id: selectedChemical.id, data: formData }).unwrap();
        Toast.show({ content: 'Chemical updated', icon: 'success' });
      }
      setShowFormPopup(false);
      refetch();
    } catch {
      Toast.show({ content: 'Failed to save chemical', icon: 'fail' });
    }
  };

  const renderChemicalItem = (chemical: Chemical) => (
    <SwipeAction
      key={chemical.id}
      rightActions={[
        {
          key: 'edit',
          text: 'Edit',
          color: 'primary',
          onClick: () => handleEdit(chemical),
        },
        {
          key: 'delete',
          text: 'Delete',
          color: 'danger',
          onClick: () => handleDelete(chemical),
        },
      ]}
    >
      <List.Item
        onClick={() => handleChemicalClick(chemical)}
        prefix={
          <div className="chemical-icon" style={{ background: `${statusColors[chemical.status]}15`, color: statusColors[chemical.status] }}>
            <ExperimentOutlined />
          </div>
        }
        description={
          <div className="chemical-item-desc">
            <span>{chemical.description || 'No description'}</span>
            <div className="chemical-item-tags">
              <Tag color={statusColors[chemical.status]} fill="outline" style={{ '--border-radius': '4px' }}>
                {chemical.status.replace('_', ' ')}
              </Tag>
              {chemical.expiring_soon && (
                <Tag
                  color="#faad14"
                  fill="outline"
                  style={{ '--border-radius': '4px' }}
                >
                  <ClockCircleOutlined /> Expiring Soon
                </Tag>
              )}
              {chemical.needs_reorder && (
                <Tag
                  color="#ff4d4f"
                  fill="outline"
                  style={{ '--border-radius': '4px' }}
                >
                  <ExclamationCircleOutlined /> Reorder
                </Tag>
              )}
            </div>
          </div>
        }
        arrow
      >
        <div className="chemical-item-title">{chemical.part_number}</div>
        <div className="chemical-item-subtitle">
          Lot: {chemical.lot_number} • Qty: {chemical.quantity} {chemical.unit}
        </div>
      </List.Item>
    </SwipeAction>
  );

  return (
    <div className="mobile-chemicals-list">
      {/* Search Bar */}
      <div className="search-bar-container">
        <SearchBar
          placeholder="Search chemicals..."
          value={searchQuery}
          onChange={handleSearch}
          className="search-bar"
        />
        <div
          className={`filter-button ${statusFilter ? 'active' : ''}`}
          onClick={() => setShowFilterPopup(true)}
        >
          <FilterOutline />
        </div>
      </div>

      {/* Active Filters */}
      {statusFilter && (
        <div className="active-filters">
          <Tag
            color="primary"
            fill="outline"
            style={{ '--border-radius': '12px' }}
          >
            {statusFilter.replace('_', ' ')}
            <CloseOutline
              onClick={() => {
                setStatusFilter('');
                setPage(1);
              }}
              style={{ marginLeft: 4 }}
            />
          </Tag>
        </div>
      )}

      {/* Chemical List */}
      <PullToRefresh onRefresh={handleRefresh}>
        {isLoading ? (
          <div style={{ padding: 16 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} animated className="chemical-skeleton" />
            ))}
          </div>
        ) : chemicals.length === 0 ? (
          <Empty description="No chemicals found" style={{ padding: '48px 0' }} />
        ) : (
          <List>
            {chemicals.map(renderChemicalItem)}
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
            <span>Filter Chemicals</span>
            <Button
              size="small"
              onClick={() => {
                setStatusFilter('');
                setShowFilterPopup(false);
                setPage(1);
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
                  setStatusFilter(option.value as ChemicalStatus);
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

      {/* Chemical Detail Popup */}
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
        {selectedChemical && (
          <div className="detail-popup">
            <div className="detail-header">
              <div className="detail-title">{selectedChemical.part_number}</div>
              <Tag color={statusColors[selectedChemical.status]}>
                {selectedChemical.status.replace('_', ' ')}
              </Tag>
            </div>
            <List>
              <List.Item extra={selectedChemical.lot_number}>Lot Number</List.Item>
              {selectedChemical.description && (
                <List.Item extra={selectedChemical.description}>Description</List.Item>
              )}
              {selectedChemical.manufacturer && (
                <List.Item extra={selectedChemical.manufacturer}>Manufacturer</List.Item>
              )}
              <List.Item extra={`${selectedChemical.quantity} ${selectedChemical.unit}`}>Quantity</List.Item>
              {selectedChemical.location && (
                <List.Item extra={selectedChemical.location}>Location</List.Item>
              )}
              {selectedChemical.category && (
                <List.Item extra={selectedChemical.category}>Category</List.Item>
              )}
              {selectedChemical.warehouse_name && (
                <List.Item extra={selectedChemical.warehouse_name}>Warehouse</List.Item>
              )}
              {selectedChemical.expiration_date && (
                <List.Item
                  extra={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {dayjs(selectedChemical.expiration_date).format('MMM D, YYYY')}
                      {selectedChemical.expiring_soon && (
                        <Tag color="#faad14" fill="outline">Soon</Tag>
                      )}
                    </div>
                  }
                >
                  Expiration Date
                </List.Item>
              )}
              {selectedChemical.minimum_stock_level && (
                <List.Item extra={selectedChemical.minimum_stock_level}>Minimum Stock Level</List.Item>
              )}
              <List.Item extra={dayjs(selectedChemical.date_added).format('MMM D, YYYY')}>
                Date Added
              </List.Item>
              {selectedChemical.notes && (
                <List.Item>
                  <div>
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>Notes</div>
                    <div style={{ color: 'var(--adm-color-text-secondary)', fontSize: 14 }}>
                      {selectedChemical.notes}
                    </div>
                  </div>
                </List.Item>
              )}
            </List>
            <div className="detail-actions">
              <Button block color="primary" onClick={() => handleEdit(selectedChemical)}>
                Edit Chemical
              </Button>
            </div>
          </div>
        )}
      </Popup>

      {/* Chemical Form Popup */}
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
            <span>{formMode === 'create' ? 'Add New Chemical' : 'Edit Chemical'}</span>
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
                {formMode === 'create' ? 'Create Chemical' : 'Save Changes'}
              </Button>
            }
          >
            <Form.Item
              name="part_number"
              label="Part Number"
              rules={[{ required: true, message: 'Part number is required' }]}
            >
              <Input placeholder="Enter part number" />
            </Form.Item>
            <Form.Item
              name="lot_number"
              label="Lot Number"
              rules={[{ required: true, message: 'Lot number is required' }]}
            >
              <Input placeholder="Enter lot number" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <TextArea placeholder="Enter description (optional)" rows={2} />
            </Form.Item>
            <Form.Item name="manufacturer" label="Manufacturer">
              <Input placeholder="Enter manufacturer (optional)" />
            </Form.Item>
            <Form.Item
              name="quantity"
              label="Quantity"
              rules={[{ required: true, message: 'Quantity is required' }]}
            >
              <Input type="number" placeholder="Enter quantity" />
            </Form.Item>
            <Form.Item
              name="unit"
              label="Unit"
              rules={[{ required: true, message: 'Unit is required' }]}
            >
              <Input placeholder="e.g., kg, L, units" />
            </Form.Item>
            <Form.Item
              name="location"
              label="Location"
              rules={[{ required: true, message: 'Please enter the storage location (e.g., shelf, bin)' }]}
            >
              <Input placeholder="e.g., Shelf A-1, Bin 5" />
            </Form.Item>
            <Form.Item name="category" label="Category">
              <Input placeholder="Enter category (optional)" />
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
            <Form.Item
              name="warehouse_id"
              label="Warehouse"
              rules={[{ required: true, message: 'Warehouse is required' }]}
              trigger="onConfirm"
              onClick={(_e, pickerRef) => pickerRef.current?.open()}
            >
              <Picker columns={warehouseOptions}>
                {(items) => items[0]?.label || 'Select warehouse'}
              </Picker>
            </Form.Item>
            <Form.Item
              name="expiration_date"
              label="Expiration Date"
              trigger="onConfirm"
              onClick={(_e, datePickerRef) => datePickerRef.current?.open()}
            >
              <DatePicker>
                {(value) => value ? dayjs(value).format('YYYY-MM-DD') : 'Select date'}
              </DatePicker>
            </Form.Item>
            <Form.Item name="minimum_stock_level" label="Minimum Stock Level">
              <Input type="number" placeholder="Enter minimum stock level (optional)" />
            </Form.Item>
            <Form.Item name="notes" label="Notes">
              <TextArea placeholder="Enter notes (optional)" rows={3} />
            </Form.Item>
          </Form>
        </div>
      </Popup>
    </div>
  );
};
