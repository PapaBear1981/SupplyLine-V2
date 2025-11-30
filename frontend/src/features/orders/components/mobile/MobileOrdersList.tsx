import { useState } from 'react';
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
  Button,
  Empty,
  SwipeAction,
} from 'antd-mobile';
import { AddOutline, FilterOutline, CloseOutline } from 'antd-mobile-icons';
import {
  ShoppingCartOutlined,
  ToolOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  InboxOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useGetOrdersQuery } from '../../services/ordersApi';
import type { ProcurementOrder, OrderStatus, OrderPriority, OrderType } from '../../types';
import './MobileOrdersList.css';

dayjs.extend(relativeTime);

// Status color mapping
const statusColors: Record<OrderStatus, string> = {
  new: '#1890ff',
  awaiting_info: '#faad14',
  in_progress: '#13c2c2',
  ordered: '#722ed1',
  shipped: '#2f54eb',
  received: '#52c41a',
  cancelled: '#ff4d4f',
};

// Priority color mapping
const priorityColors: Record<OrderPriority, string> = {
  low: '#8c8c8c',
  normal: '#1890ff',
  high: '#faad14',
  critical: '#ff4d4f',
};

// Type icons
const typeIcons: Record<OrderType, React.ReactNode> = {
  tool: <ToolOutlined />,
  chemical: <ExperimentOutlined />,
  expendable: <AppstoreOutlined />,
  kit: <InboxOutlined />,
};

const statusOptions = [
  { label: 'New', value: 'new' },
  { label: 'Awaiting Info', value: 'awaiting_info' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Ordered', value: 'ordered' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Received', value: 'received' },
  { label: 'Cancelled', value: 'cancelled' },
];

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
];

export const MobileOrdersList = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<OrderPriority | ''>('');
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ProcurementOrder | null>(null);

  // Build query params
  const queryParams = {
    search: searchQuery || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    limit: 100,
  };

  // API query
  const { data: orders = [], isLoading, refetch } = useGetOrdersQuery(queryParams);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const handleOrderClick = (order: ProcurementOrder) => {
    setSelectedOrder(order);
    setShowDetailPopup(true);
  };

  const handleCreate = () => {
    navigate('/orders/new');
  };

  const handleViewDetails = () => {
    if (selectedOrder) {
      navigate(`/orders/${selectedOrder.id}`);
    }
  };

  const clearFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
  };

  const hasFilters = statusFilter || priorityFilter;

  const renderOrderItem = (order: ProcurementOrder) => (
    <SwipeAction
      key={order.id}
      rightActions={[
        {
          key: 'view',
          text: 'View',
          color: 'primary',
          onClick: () => navigate(`/orders/${order.id}`),
        },
      ]}
    >
      <List.Item
        onClick={() => handleOrderClick(order)}
        prefix={
          <div
            className="order-icon"
            style={{
              background: `${statusColors[order.status]}15`,
              color: statusColors[order.status],
            }}
          >
            <ShoppingCartOutlined />
          </div>
        }
        description={
          <div className="order-item-desc">
            <span>{order.title}</span>
            {order.part_number && (
              <span style={{ fontSize: 12, color: 'var(--adm-color-text-secondary)' }}>
                PN: {order.part_number}
              </span>
            )}
            <div className="order-item-tags">
              <Tag
                color={statusColors[order.status]}
                fill="outline"
                style={{ '--border-radius': '4px' }}
              >
                {statusOptions.find((s) => s.value === order.status)?.label || order.status}
              </Tag>
              <Tag
                color={priorityColors[order.priority]}
                fill="outline"
                style={{ '--border-radius': '4px' }}
              >
                {order.priority}
              </Tag>
              {order.order_type && (
                <Tag fill="outline" style={{ '--border-radius': '4px' }}>
                  {typeIcons[order.order_type]} {order.order_type}
                </Tag>
              )}
              {order.is_late && (
                <Tag color="danger" fill="outline" style={{ '--border-radius': '4px' }}>
                  <ExclamationCircleOutlined /> Overdue
                </Tag>
              )}
              {order.due_soon && !order.is_late && (
                <Tag color="warning" fill="outline" style={{ '--border-radius': '4px' }}>
                  <ClockCircleOutlined /> Due Soon
                </Tag>
              )}
            </div>
          </div>
        }
        arrow
      >
        <div className="order-item-title">{order.order_number}</div>
        {order.requester && (
          <div className="order-item-subtitle">
            {order.requester.first_name} {order.requester.last_name}
          </div>
        )}
      </List.Item>
    </SwipeAction>
  );

  return (
    <div className="mobile-orders-list">
      {/* Search Bar */}
      <div className="search-bar-container">
        <SearchBar
          placeholder="Search orders..."
          value={searchQuery}
          onChange={handleSearch}
          className="search-bar"
        />
        <div
          className={`filter-button ${hasFilters ? 'active' : ''}`}
          onClick={() => setShowFilterPopup(true)}
        >
          <FilterOutline />
        </div>
      </div>

      {/* Active Filters */}
      {hasFilters && (
        <div className="active-filters">
          {statusFilter && (
            <Tag color="primary" fill="outline" style={{ '--border-radius': '12px' }}>
              {statusOptions.find((s) => s.value === statusFilter)?.label}
              <CloseOutline
                onClick={() => setStatusFilter('')}
                style={{ marginLeft: 4 }}
              />
            </Tag>
          )}
          {priorityFilter && (
            <Tag color="primary" fill="outline" style={{ '--border-radius': '12px' }}>
              {priorityFilter}
              <CloseOutline
                onClick={() => setPriorityFilter('')}
                style={{ marginLeft: 4 }}
              />
            </Tag>
          )}
        </div>
      )}

      {/* Order List */}
      <PullToRefresh onRefresh={handleRefresh}>
        {isLoading ? (
          <div style={{ padding: 16 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} animated className="order-skeleton" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Empty description="No orders found" style={{ padding: '48px 0' }} />
        ) : (
          <List>{orders.map(renderOrderItem)}</List>
        )}
      </PullToRefresh>

      <InfiniteScroll loadMore={async () => {}} hasMore={false} />

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
            <span>Filter Orders</span>
            <Button
              size="small"
              onClick={() => {
                clearFilters();
                setShowFilterPopup(false);
              }}
            >
              Clear
            </Button>
          </div>
          <List>
            <List.Item extra={statusFilter || 'All'}>Status</List.Item>
          </List>
          <div className="filter-options">
            {statusOptions.map((option) => (
              <Tag
                key={option.value}
                color={statusFilter === option.value ? 'primary' : 'default'}
                onClick={() => {
                  setStatusFilter(option.value as OrderStatus);
                  setShowFilterPopup(false);
                }}
                style={{ margin: 4, padding: '6px 12px' }}
              >
                {option.label}
              </Tag>
            ))}
          </div>
          <List style={{ marginTop: 16 }}>
            <List.Item extra={priorityFilter || 'All'}>Priority</List.Item>
          </List>
          <div className="filter-options">
            {priorityOptions.map((option) => (
              <Tag
                key={option.value}
                color={priorityFilter === option.value ? 'primary' : 'default'}
                onClick={() => {
                  setPriorityFilter(option.value as OrderPriority);
                  setShowFilterPopup(false);
                }}
                style={{ margin: 4, padding: '6px 12px' }}
              >
                {option.label}
              </Tag>
            ))}
          </div>
        </div>
      </Popup>

      {/* Order Detail Popup */}
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
        {selectedOrder && (
          <div className="detail-popup">
            <div className="detail-header">
              <div className="detail-title">{selectedOrder.order_number}</div>
              <Tag color={statusColors[selectedOrder.status]}>
                {statusOptions.find((s) => s.value === selectedOrder.status)?.label ||
                  selectedOrder.status}
              </Tag>
            </div>
            <List>
              <List.Item extra={selectedOrder.title}>Title</List.Item>
              {selectedOrder.part_number && (
                <List.Item extra={selectedOrder.part_number}>Part Number</List.Item>
              )}
              {selectedOrder.order_type && (
                <List.Item extra={selectedOrder.order_type}>Type</List.Item>
              )}
              <List.Item
                extra={
                  <Tag color={priorityColors[selectedOrder.priority]}>
                    {selectedOrder.priority}
                  </Tag>
                }
              >
                Priority
              </List.Item>
              {selectedOrder.requester && (
                <List.Item
                  extra={`${selectedOrder.requester.first_name} ${selectedOrder.requester.last_name}`}
                >
                  Requester
                </List.Item>
              )}
              {selectedOrder.buyer && (
                <List.Item
                  extra={`${selectedOrder.buyer.first_name} ${selectedOrder.buyer.last_name}`}
                >
                  Buyer
                </List.Item>
              )}
              {selectedOrder.vendor && (
                <List.Item extra={selectedOrder.vendor}>Vendor</List.Item>
              )}
              {selectedOrder.tracking_number && (
                <List.Item extra={selectedOrder.tracking_number}>Tracking #</List.Item>
              )}
              {selectedOrder.quantity && (
                <List.Item extra={`${selectedOrder.quantity} ${selectedOrder.unit || ''}`}>
                  Quantity
                </List.Item>
              )}
              {selectedOrder.expected_due_date && (
                <List.Item
                  extra={
                    <span style={{ color: selectedOrder.is_late ? '#ff4d4f' : undefined }}>
                      {dayjs(selectedOrder.expected_due_date).format('MMM D, YYYY')}
                      {selectedOrder.is_late && ' (Overdue)'}
                    </span>
                  }
                >
                  Due Date
                </List.Item>
              )}
              {selectedOrder.ordered_date && (
                <List.Item extra={dayjs(selectedOrder.ordered_date).format('MMM D, YYYY')}>
                  Ordered Date
                </List.Item>
              )}
              <List.Item extra={dayjs(selectedOrder.created_at).format('MMM D, YYYY')}>
                Created
              </List.Item>
            </List>
            <div className="detail-actions">
              <Button block color="primary" onClick={handleViewDetails}>
                View Full Details
              </Button>
            </div>
          </div>
        )}
      </Popup>
    </div>
  );
};
