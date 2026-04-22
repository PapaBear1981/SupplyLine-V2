import { useState, useCallback } from 'react';
import {
  List,
  SearchBar,
  Tag,
  Skeleton,
  InfiniteScroll,
  PullToRefresh,
  Picker,
  Button,
  Empty,
} from 'antd-mobile';
import { FilterOutline } from 'antd-mobile-icons';
import dayjs from 'dayjs';
import { MobilePageScaffold } from '@shared/components/mobile/MobilePageScaffold';
import { useGetToolAuditHistoryQuery } from '../../services/checkoutApi';
import type { AuditHistoryQueryParams, ToolHistoryEvent, ToolHistoryEventType } from '../../types';

const EVENT_TYPE_OPTIONS = [
  [
    { label: 'All Event Types', value: '' },
    { label: 'Checkout', value: 'checkout' },
    { label: 'Return', value: 'return' },
    { label: 'Damage Reported', value: 'damage_reported' },
    { label: 'Damage Resolved', value: 'damage_resolved' },
    { label: 'Calibration', value: 'calibration' },
    { label: 'Maintenance Start', value: 'maintenance_start' },
    { label: 'Maintenance End', value: 'maintenance_end' },
    { label: 'Repair', value: 'repair' },
    { label: 'Status Change', value: 'status_change' },
    { label: 'Retired', value: 'retired' },
  ],
];

const EVENT_COLORS: Record<string, string> = {
  checkout: '#1890ff',
  return: '#52c41a',
  damage_reported: '#ff4d4f',
  damage_resolved: '#52c41a',
  calibration: '#722ed1',
  maintenance_start: '#fa8c16',
  maintenance_end: '#52c41a',
  repair: '#13c2c2',
  status_change: '#faad14',
  retired: '#8c8c8c',
};

const PAGE_SIZE = 30;

const getEventDetails = (event: ToolHistoryEvent): string => {
  const d = event.details || {};
  const parts: string[] = [];
  if (typeof d.work_order === 'string' && d.work_order) parts.push(`WO: ${d.work_order}`);
  if (typeof d.damage_severity === 'string' && d.damage_severity)
    parts.push(`Severity: ${d.damage_severity}`);
  if (typeof d.notes === 'string' && d.notes) parts.push(d.notes);
  return parts.join(' · ');
};

export const MobileToolAuditHistory = () => {
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<ToolHistoryEvent[]>([]);
  const [eventType, setEventType] = useState<ToolHistoryEventType | ''>('');
  const [toolSearch, setToolSearch] = useState('');
  const [showFilterPicker, setShowFilterPicker] = useState(false);

  const queryParams: AuditHistoryQueryParams = {
    page,
    per_page: PAGE_SIZE,
    ...(eventType && { event_type: eventType }),
  };

  const { data, isLoading, isFetching } = useGetToolAuditHistoryQuery(queryParams);

  const hasMore = data ? page < data.pages : false;

  const loadMore = useCallback(async () => {
    if (!isFetching && data) {
      const nextItems = data.history;
      setAllItems((prev) => (page === 1 ? nextItems : [...prev, ...nextItems]));
      if (hasMore) setPage((p) => p + 1);
    }
  }, [isFetching, data, page, hasMore]);

  const handleRefresh = async () => {
    setPage(1);
    setAllItems([]);
  };

  const handleEventTypeChange = (val: (string | null)[]) => {
    const selected = (val[0] ?? '') as ToolHistoryEventType | '';
    setEventType(selected);
    setPage(1);
    setAllItems([]);
    setShowFilterPicker(false);
  };

  const handleToolSearchChange = (v: string) => {
    setToolSearch(v);
  };

  // Use the freshest page of data for display; fall back to accumulated list
  const displayItems = (data?.history ?? allItems).filter((event) => {
    if (!toolSearch) return true;
    const q = toolSearch.toLowerCase();
    return (
      event.tool_number?.toLowerCase().includes(q) ||
      event.tool_description?.toLowerCase().includes(q)
    );
  });

  const selectedEventLabel =
    EVENT_TYPE_OPTIONS[0].find((o) => o.value === eventType)?.label ?? 'All Event Types';

  const renderItem = (event: ToolHistoryEvent) => {
    const extra = getEventDetails(event);
    return (
      <List.Item
        key={event.id}
        prefix={
          <Tag
            color={EVENT_COLORS[event.event_type] ?? '#8c8c8c'}
            style={{ fontSize: 11, padding: '1px 6px', whiteSpace: 'nowrap' }}
          >
            {event.event_type.replace(/_/g, ' ')}
          </Tag>
        }
        description={
          <span style={{ fontSize: 12, color: '#8c8c8c' }}>
            {event.tool_number && <strong>{event.tool_number}</strong>}
            {event.tool_number && ' · '}
            {event.user_name}
            {extra && ` · ${extra}`}
          </span>
        }
        style={{ '--border-inner': 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13 }}>{event.description}</span>
          <span style={{ fontSize: 11, color: '#8c8c8c', whiteSpace: 'nowrap', marginLeft: 8 }}>
            {dayjs(event.event_date).format('MMM D, YYYY')}
          </span>
        </div>
      </List.Item>
    );
  };

  return (
    <MobilePageScaffold
      testId="mobile-tool-audit-history-page"
      sticky={
        <div style={{ padding: '8px 12px', display: 'flex', gap: 8, background: 'var(--adm-color-background)' }}>
          <div style={{ flex: 1 }}>
            <SearchBar
              placeholder="Filter by tool number…"
              value={toolSearch}
              onChange={handleToolSearchChange}
              data-testid="mobile-audit-history-search"
            />
          </div>
          <Button
            size="small"
            onClick={() => setShowFilterPicker(true)}
            style={{ whiteSpace: 'nowrap' }}
            data-testid="mobile-audit-history-filter-button"
          >
            <FilterOutline />
            {eventType ? ` ${selectedEventLabel}` : ' Filter'}
          </Button>
        </div>
      }
    >
      {isLoading && page === 1 ? (
        <div style={{ padding: 16 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} animated style={{ marginBottom: 12 }} />
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <Empty description="No history events found" style={{ padding: '48px 0' }} />
      ) : (
        <PullToRefresh onRefresh={handleRefresh}>
          <List data-testid="mobile-audit-history-list">{displayItems.map(renderItem)}</List>
          <InfiniteScroll
            loadMore={loadMore}
            hasMore={hasMore && !isFetching}
          />
        </PullToRefresh>
      )}

      <Picker
        columns={EVENT_TYPE_OPTIONS}
        visible={showFilterPicker}
        onClose={() => setShowFilterPicker(false)}
        onConfirm={handleEventTypeChange}
        value={[eventType]}
      />
    </MobilePageScaffold>
  );
};
