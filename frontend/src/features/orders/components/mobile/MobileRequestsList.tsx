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
  Badge,
} from 'antd-mobile';
import { AddOutline, FilterOutline, CloseOutline } from 'antd-mobile-icons';
import {
  FileTextOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useGetRequestsQuery } from '../../services/requestsApi';
import type { UserRequest, RequestStatus, RequestPriority } from '../../types';
import './MobileRequestsList.css';

dayjs.extend(relativeTime);

// Status color mapping
const statusColors: Record<RequestStatus, string> = {
  new: '#1890ff',
  awaiting_info: '#faad14',
  in_progress: '#13c2c2',
  partially_ordered: '#722ed1',
  ordered: '#722ed1',
  partially_received: '#95de64',
  received: '#52c41a',
  cancelled: '#ff4d4f',
};

// Priority color mapping
const priorityColors: Record<RequestPriority, string> = {
  low: '#8c8c8c',
  normal: '#1890ff',
  high: '#faad14',
  critical: '#ff4d4f',
};

const statusOptions = [
  { label: 'New', value: 'new' },
  { label: 'Awaiting Info', value: 'awaiting_info' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Partially Ordered', value: 'partially_ordered' },
  { label: 'Ordered', value: 'ordered' },
  { label: 'Partially Received', value: 'partially_received' },
  { label: 'Received', value: 'received' },
  { label: 'Cancelled', value: 'cancelled' },
];

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
];

export const MobileRequestsList = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | ''>('');
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showDetailPopup, setShowDetailPopup] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<UserRequest | null>(null);

  // Build query params
  const queryParams = {
    search: searchQuery || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    limit: 100,
  };

  // API query
  const { data: requests = [], isLoading, refetch } = useGetRequestsQuery(queryParams);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const handleRequestClick = (request: UserRequest) => {
    setSelectedRequest(request);
    setShowDetailPopup(true);
  };

  const handleCreate = () => {
    navigate('/requests/new');
  };

  const handleViewDetails = () => {
    if (selectedRequest) {
      navigate(`/requests/${selectedRequest.id}`);
    }
  };

  const clearFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
  };

  const hasFilters = statusFilter || priorityFilter;

  const renderRequestItem = (request: UserRequest) => (
    <SwipeAction
      key={request.id}
      rightActions={[
        {
          key: 'view',
          text: 'View',
          color: 'primary',
          onClick: () => navigate(`/requests/${request.id}`),
        },
      ]}
    >
      <List.Item
        onClick={() => handleRequestClick(request)}
        prefix={
          <div
            className="request-icon"
            style={{
              background: `${statusColors[request.status]}15`,
              color: statusColors[request.status],
            }}
          >
            <FileTextOutlined />
          </div>
        }
        description={
          <div className="request-item-desc">
            <span>{request.title}</span>
            {request.description && (
              <span style={{ fontSize: 12, color: 'var(--adm-color-text-secondary)' }}>
                {request.description}
              </span>
            )}
            <div className="request-item-tags">
              <Tag
                color={statusColors[request.status]}
                fill="outline"
                style={{ '--border-radius': '4px' }}
              >
                {statusOptions.find((s) => s.value === request.status)?.label || request.status}
              </Tag>
              <Tag
                color={priorityColors[request.priority]}
                fill="outline"
                style={{ '--border-radius': '4px' }}
              >
                {request.priority}
              </Tag>
              {request.item_count && request.item_count > 0 && (
                <Badge content={request.item_count} style={{ '--right': '-4px', '--top': '-4px' }}>
                  <Tag fill="outline" style={{ '--border-radius': '4px' }}>
                    Items
                  </Tag>
                </Badge>
              )}
              {request.is_late && (
                <Tag color="danger" fill="outline" style={{ '--border-radius': '4px' }}>
                  <ExclamationCircleOutlined /> Overdue
                </Tag>
              )}
              {request.due_soon && !request.is_late && (
                <Tag color="warning" fill="outline" style={{ '--border-radius': '4px' }}>
                  <ClockCircleOutlined /> Due Soon
                </Tag>
              )}
            </div>
          </div>
        }
        arrow
      >
        <div className="request-item-title">{request.request_number}</div>
        {request.requester && (
          <div className="request-item-subtitle">
            {request.requester.first_name} {request.requester.last_name}
          </div>
        )}
      </List.Item>
    </SwipeAction>
  );

  return (
    <div className="mobile-requests-list">
      {/* Search Bar */}
      <div className="search-bar-container">
        <SearchBar
          placeholder="Search requests..."
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

      {/* Request List */}
      <PullToRefresh onRefresh={handleRefresh}>
        {isLoading ? (
          <div style={{ padding: 16 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} animated className="request-skeleton" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <Empty description="No requests found" style={{ padding: '48px 0' }} />
        ) : (
          <List>{requests.map(renderRequestItem)}</List>
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
            <span>Filter Requests</span>
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
                  setStatusFilter(option.value as RequestStatus);
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
                  setPriorityFilter(option.value as RequestPriority);
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

      {/* Request Detail Popup */}
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
        {selectedRequest && (
          <div className="detail-popup">
            <div className="detail-header">
              <div className="detail-title">{selectedRequest.request_number}</div>
              <Tag color={statusColors[selectedRequest.status]}>
                {statusOptions.find((s) => s.value === selectedRequest.status)?.label ||
                  selectedRequest.status}
              </Tag>
            </div>
            <List>
              <List.Item extra={selectedRequest.title}>Title</List.Item>
              {selectedRequest.description && (
                <List.Item extra={selectedRequest.description}>Description</List.Item>
              )}
              <List.Item
                extra={
                  <Tag color={priorityColors[selectedRequest.priority]}>
                    {selectedRequest.priority}
                  </Tag>
                }
              >
                Priority
              </List.Item>
              {selectedRequest.requester && (
                <List.Item
                  extra={`${selectedRequest.requester.first_name} ${selectedRequest.requester.last_name}`}
                >
                  Requester
                </List.Item>
              )}
              {selectedRequest.buyer && (
                <List.Item
                  extra={`${selectedRequest.buyer.first_name} ${selectedRequest.buyer.last_name}`}
                >
                  Buyer
                </List.Item>
              )}
              {selectedRequest.item_count !== undefined && (
                <List.Item extra={selectedRequest.item_count}>Items</List.Item>
              )}
              {selectedRequest.expected_due_date && (
                <List.Item
                  extra={
                    <span style={{ color: selectedRequest.is_late ? '#ff4d4f' : undefined }}>
                      {dayjs(selectedRequest.expected_due_date).format('MMM D, YYYY')}
                      {selectedRequest.is_late && ' (Overdue)'}
                    </span>
                  }
                >
                  Due Date
                </List.Item>
              )}
              <List.Item extra={dayjs(selectedRequest.created_at).format('MMM D, YYYY')}>
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
