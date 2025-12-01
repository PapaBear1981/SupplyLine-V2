import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Switch,
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
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetToolsQuery, useCreateToolMutation, useUpdateToolMutation, useDeleteToolMutation } from '../../services/toolsApi';
import { useGetWarehousesQuery } from '@features/warehouses/services/warehousesApi';
import type { Tool, ToolStatus, CalibrationStatus, ToolFormData } from '../../types';
import './MobileToolsList.css';

// Status color mapping
const statusColors: Record<ToolStatus, string> = {
  available: '#52c41a',
  checked_out: '#1890ff',
  maintenance: '#faad14',
  retired: '#8c8c8c',
};

// Calibration status color mapping
const calibrationColors: Record<CalibrationStatus, string> = {
  current: '#52c41a',
  due_soon: '#faad14',
  overdue: '#ff4d4f',
  not_applicable: '#8c8c8c',
};

const statusOptions = [
  [
    { label: 'Available', value: 'available' },
    { label: 'Checked Out', value: 'checked_out' },
    { label: 'Maintenance', value: 'maintenance' },
    { label: 'Retired', value: 'retired' },
  ],
];

export const MobileToolsList = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ToolStatus | ''>('');
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [showFormPopup, setShowFormPopup] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [page, setPage] = useState(1);
  const [form] = Form.useForm();

  // API queries
  const { data: toolsData, isLoading, isFetching, refetch } = useGetToolsQuery({
    page,
    per_page: 20,
    q: searchQuery || undefined,
    status: statusFilter || undefined,
  });
  const { data: warehousesData } = useGetWarehousesQuery();
  const [createTool, { isLoading: isCreating }] = useCreateToolMutation();
  const [updateTool, { isLoading: isUpdating }] = useUpdateToolMutation();
  const [deleteTool] = useDeleteToolMutation();

  const tools = toolsData?.tools || [];
  const hasMore = toolsData ? page < toolsData.pages : false;

  const warehouseOptions = useMemo(() => {
    return [[
      { label: 'None', value: '' },
      ...(warehousesData?.warehouses || []).map(w => ({
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

  const handleToolClick = (tool: Tool) => {
    setSelectedTool(tool);
    setShowDetailPopup(true);
  };

  const handleCreate = () => {
    setFormMode('create');
    setSelectedTool(null);
    form.resetFields();
    setShowFormPopup(true);
  };

  const handleEdit = (tool: Tool) => {
    setFormMode('edit');
    setSelectedTool(tool);
    form.setFieldsValue({
      tool_number: tool.tool_number,
      serial_number: tool.serial_number,
      lot_number: tool.lot_number || '',
      description: tool.description,
      condition: tool.condition,
      location: tool.location,
      category: tool.category || '',
      status: tool.status,
      warehouse_id: tool.warehouse_id,
      requires_calibration: tool.requires_calibration,
      calibration_frequency_days: tool.calibration_frequency_days,
    });
    setShowDetailPopup(false);
    setShowFormPopup(true);
  };

  const handleDelete = async (tool: Tool) => {
    const confirmed = await Dialog.confirm({
      content: `Are you sure you want to delete tool ${tool.tool_number}?`,
    });
    if (confirmed) {
      try {
        await deleteTool(tool.id).unwrap();
        Toast.show({ content: 'Tool deleted', icon: 'success' });
        refetch();
      } catch {
        Toast.show({ content: 'Failed to delete tool', icon: 'fail' });
      }
    }
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      const formData: ToolFormData = {
        tool_number: values.tool_number,
        serial_number: values.serial_number,
        lot_number: values.lot_number || undefined,
        description: values.description,
        condition: values.condition,
        location: values.location,
        category: values.category || undefined,
        status: values.status || 'available',
        warehouse_id: values.warehouse_id || undefined,
        requires_calibration: values.requires_calibration || false,
        calibration_frequency_days: values.calibration_frequency_days || undefined,
      };

      if (formMode === 'create') {
        await createTool(formData).unwrap();
        Toast.show({ content: 'Tool created', icon: 'success' });
      } else if (selectedTool) {
        await updateTool({ id: selectedTool.id, data: formData }).unwrap();
        Toast.show({ content: 'Tool updated', icon: 'success' });
      }
      setShowFormPopup(false);
      refetch();
    } catch {
      Toast.show({ content: 'Failed to save tool', icon: 'fail' });
    }
  };

  const renderToolItem = (tool: Tool) => (
    <SwipeAction
      key={tool.id}
      rightActions={[
        {
          key: 'edit',
          text: 'Edit',
          color: 'primary',
          onClick: () => handleEdit(tool),
        },
        {
          key: 'delete',
          text: 'Delete',
          color: 'danger',
          onClick: () => handleDelete(tool),
        },
      ]}
    >
      <List.Item
        onClick={() => handleToolClick(tool)}
        prefix={
          <div className="tool-icon" style={{ background: `${statusColors[tool.status]}15`, color: statusColors[tool.status] }}>
            <ToolOutlined />
          </div>
        }
        description={
          <div className="tool-item-desc">
            <span>{tool.description}</span>
            <div className="tool-item-tags">
              <Tag color={statusColors[tool.status]} fill="outline" style={{ '--border-radius': '4px' }}>
                {tool.status.replace('_', ' ')}
              </Tag>
              {tool.requires_calibration && tool.calibration_status !== 'not_applicable' && (
                <Tag
                  color={calibrationColors[tool.calibration_status]}
                  fill="outline"
                  style={{ '--border-radius': '4px' }}
                >
                  {tool.calibration_status === 'current' && <CheckCircleOutlined />}
                  {tool.calibration_status === 'due_soon' && <ClockCircleOutlined />}
                  {tool.calibration_status === 'overdue' && <ExclamationCircleOutlined />}
                  {' Cal: '}{tool.calibration_status.replace('_', ' ')}
                </Tag>
              )}
            </div>
          </div>
        }
        arrow
      >
        <div className="tool-item-title">{tool.tool_number}</div>
        <div className="tool-item-subtitle">S/N: {tool.serial_number}</div>
      </List.Item>
    </SwipeAction>
  );

  return (
    <div className="mobile-tools-list">
      {/* Search Bar */}
      <div className="search-bar-container">
        <SearchBar
          placeholder="Search tools..."
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

      {/* Tool List */}
      <PullToRefresh onRefresh={handleRefresh}>
        {isLoading ? (
          <div style={{ padding: 16 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} animated className="tool-skeleton" />
            ))}
          </div>
        ) : tools.length === 0 ? (
          <Empty description="No tools found" style={{ padding: '48px 0' }} />
        ) : (
          <List>
            {tools.map(renderToolItem)}
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
            <span>Filter Tools</span>
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
                  setStatusFilter(option.value as ToolStatus);
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

      {/* Tool Detail Popup */}
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
        {selectedTool && (
          <div className="detail-popup">
            <div className="detail-header">
              <div className="detail-title">{selectedTool.tool_number}</div>
              <Tag color={statusColors[selectedTool.status]}>
                {selectedTool.status.replace('_', ' ')}
              </Tag>
            </div>
            <List>
              <List.Item extra={selectedTool.serial_number}>Serial Number</List.Item>
              {selectedTool.lot_number && (
                <List.Item extra={selectedTool.lot_number}>Lot Number</List.Item>
              )}
              <List.Item extra={selectedTool.description}>Description</List.Item>
              <List.Item extra={selectedTool.condition}>Condition</List.Item>
              <List.Item extra={selectedTool.location}>Location</List.Item>
              <List.Item extra={selectedTool.category || 'N/A'}>Category</List.Item>
              {selectedTool.warehouse_name && (
                <List.Item extra={selectedTool.warehouse_name}>Warehouse</List.Item>
              )}
              {selectedTool.requires_calibration && (
                <>
                  <List.Item extra={
                    <Tag color={calibrationColors[selectedTool.calibration_status]}>
                      {selectedTool.calibration_status.replace('_', ' ')}
                    </Tag>
                  }>
                    Calibration Status
                  </List.Item>
                  {selectedTool.last_calibration_date && (
                    <List.Item extra={dayjs(selectedTool.last_calibration_date).format('MMM D, YYYY')}>
                      Last Calibration
                    </List.Item>
                  )}
                  {selectedTool.next_calibration_date && (
                    <List.Item extra={dayjs(selectedTool.next_calibration_date).format('MMM D, YYYY')}>
                      Next Calibration
                    </List.Item>
                  )}
                </>
              )}
            </List>
            <div className="detail-actions">
              <Button block color="primary" onClick={() => handleEdit(selectedTool)}>
                Edit Tool
              </Button>
              <Button
                block
                color="primary"
                fill="outline"
                onClick={() => {
                  setShowDetailPopup(false);
                  navigate(`/tool-checkout?tool=${selectedTool.tool_number}`);
                }}
              >
                Go to Checkout
              </Button>
            </div>
          </div>
        )}
      </Popup>

      {/* Tool Form Popup */}
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
            <span>{formMode === 'create' ? 'Add New Tool' : 'Edit Tool'}</span>
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
                {formMode === 'create' ? 'Create Tool' : 'Save Changes'}
              </Button>
            }
          >
            <Form.Item
              name="tool_number"
              label="Tool Number"
              rules={[{ required: true, message: 'Tool number is required' }]}
            >
              <Input placeholder="Enter tool number" />
            </Form.Item>
            <Form.Item
              name="serial_number"
              label="Serial Number"
              rules={[{ required: true, message: 'Serial number is required' }]}
            >
              <Input placeholder="Enter serial number" />
            </Form.Item>
            <Form.Item name="lot_number" label="Lot Number">
              <Input placeholder="Enter lot number (optional)" />
            </Form.Item>
            <Form.Item
              name="description"
              label="Description"
              rules={[{ required: true, message: 'Description is required' }]}
            >
              <TextArea placeholder="Enter description" rows={2} />
            </Form.Item>
            <Form.Item
              name="condition"
              label="Condition"
              rules={[{ required: true, message: 'Condition is required' }]}
            >
              <Input placeholder="e.g., New, Good, Fair" />
            </Form.Item>
            <Form.Item
              name="location"
              label="Location"
              rules={[{ required: true, message: 'Location is required' }]}
            >
              <Input placeholder="Enter location" />
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
              trigger="onConfirm"
              onClick={(_e, pickerRef) => pickerRef.current?.open()}
            >
              <Picker columns={warehouseOptions}>
                {(items) => items[0]?.label || 'Select warehouse'}
              </Picker>
            </Form.Item>
            <Form.Item
              name="requires_calibration"
              label="Requires Calibration"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item name="calibration_frequency_days" label="Calibration Frequency (days)">
              <Input type="number" placeholder="e.g., 365" />
            </Form.Item>
          </Form>
        </div>
      </Popup>
    </div>
  );
};
