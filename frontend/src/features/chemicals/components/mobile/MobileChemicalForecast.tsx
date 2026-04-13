import { useMemo, useState } from 'react';
import {
  Tag,
  Button,
  SpinLoading,
  Toast,
  List,
  Form,
  Input,
  Selector,
  Stepper,
  TextArea,
  Tabs,
} from 'antd-mobile';
import {
  AlertOutlined,
  ExperimentOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetChemicalForecastQuery } from '../../services/chemicalsApi';
import { useCreateRequestMutation } from '@features/orders/services/requestsApi';
import type { ChemicalForecastRow } from '../../types';
import {
  MobilePageScaffold,
  MobileSectionCard,
  MobileEmptyState,
  MobileFormSheet,
} from '@shared/components/mobile';
import { useHaptics } from '@shared/hooks/useHaptics';
import './MobileChemicalForecast.css';

const URGENCY_COLOR: Record<string, string> = {
  critical: '#ff4d4f',
  soon: '#faad14',
  expiry_risk: '#d4b106',
  ok: '#52c41a',
  no_data: '#8c8c8c',
};

const URGENCY_LABEL: Record<string, string> = {
  critical: 'Critical',
  soon: 'Reorder Soon',
  expiry_risk: 'Expiry Risk',
  ok: 'OK',
  no_data: 'No Data',
};

interface ReorderFormValues {
  quantity: number;
  priority: ('routine' | 'urgent' | 'aog')[];
  notes?: string;
}

export const MobileChemicalForecast = () => {
  const haptics = useHaptics();
  const { data, isLoading, isFetching, refetch } = useGetChemicalForecastQuery({
    analysis_days: 30,
    lead_time_days: 14,
    safety_stock_days: 7,
  });
  const [createRequest, { isLoading: creating }] = useCreateRequestMutation();

  const [activeTab, setActiveTab] = useState('critical');
  const [selectedRow, setSelectedRow] = useState<ChemicalForecastRow | null>(null);
  const [form] = Form.useForm<ReorderFormValues>();

  const rows: ChemicalForecastRow[] = data?.forecasts ?? [];

  const grouped = useMemo(() => {
    const buckets: Record<string, ChemicalForecastRow[]> = {
      critical: [],
      soon: [],
      expiry_risk: [],
      ok: [],
      no_data: [],
    };
    for (const row of rows) {
      const bucket = buckets[row.urgency] ?? buckets.no_data;
      bucket.push(row);
    }
    return buckets;
  }, [rows]);

  const openReorder = (row: ChemicalForecastRow) => {
    haptics.trigger('selection');
    setSelectedRow(row);
    form.setFieldsValue({
      quantity: row.recommended_order_quantity ?? row.current_quantity ?? 1,
      priority: [row.urgency === 'critical' ? 'urgent' : 'routine'],
      notes: '',
    });
  };

  const closeReorder = () => setSelectedRow(null);

  const handleSubmit = async () => {
    if (!selectedRow) return;
    try {
      const values = await form.validateFields();
      await createRequest({
        title: `Reorder: ${selectedRow.description} (${selectedRow.part_number})`,
        description: `Forecast-driven reorder. Current stock: ${selectedRow.current_quantity} ${selectedRow.unit}. Days remaining: ${selectedRow.days_of_stock_remaining ?? 'N/A'}.`,
        priority: values.priority[0],
        notes: values.notes || undefined,
        request_type: 'manual',
        items: [
          {
            item_type: 'chemical',
            part_number: selectedRow.part_number,
            description: selectedRow.description,
            quantity: values.quantity,
            unit: selectedRow.unit,
          },
        ],
      }).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Reorder request created' });
      closeReorder();
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to create request' });
    }
  };

  const renderRow = (row: ChemicalForecastRow) => (
    <List.Item
      key={row.part_number}
      prefix={
        <div
          className="mobile-forecast__icon"
          style={{
            background: `${URGENCY_COLOR[row.urgency]}22`,
            color: URGENCY_COLOR[row.urgency],
          }}
        >
          {row.urgency === 'critical' ? <AlertOutlined /> : <ExperimentOutlined />}
        </div>
      }
      description={
        <div className="mobile-forecast__meta">
          <div>
            {row.current_quantity} {row.unit} on hand
            {row.weekly_consumption_rate > 0 && (
              <> • {row.weekly_consumption_rate.toFixed(1)} {row.unit}/week</>
            )}
          </div>
          <div className="mobile-forecast__tags">
            <Tag
              color={URGENCY_COLOR[row.urgency]}
              fill="outline"
              style={{ '--border-radius': '6px' }}
            >
              {URGENCY_LABEL[row.urgency]}
            </Tag>
            {row.days_of_stock_remaining !== null && row.days_of_stock_remaining !== undefined && (
              <Tag fill="outline">
                {row.days_of_stock_remaining < 0
                  ? 'Depleted'
                  : `${row.days_of_stock_remaining}d left`}
              </Tag>
            )}
            {row.earliest_expiry_date && (
              <Tag fill="outline">
                Exp {dayjs(row.earliest_expiry_date).format('MMM YYYY')}
              </Tag>
            )}
          </div>
        </div>
      }
      extra={
        row.needs_reorder && (
          <Button
            size="small"
            color="primary"
            onClick={(e) => {
              e.stopPropagation();
              openReorder(row);
            }}
          >
            <ShoppingCartOutlined /> Order
          </Button>
        )
      }
      onClick={() => row.needs_reorder && openReorder(row)}
    >
      <div className="mobile-forecast__title">{row.description}</div>
      <div className="mobile-forecast__subtitle">PN {row.part_number}</div>
    </List.Item>
  );

  return (
    <MobilePageScaffold>
      <MobileSectionCard title="Forecast Summary">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <SpinLoading />
          </div>
        ) : !data ? (
          <div style={{ fontSize: 13, color: 'var(--adm-color-weak)' }}>
            Failed to load forecast.
          </div>
        ) : (
          <div className="mobile-forecast__summary">
            <div className="mobile-forecast__summary-cell">
              <div className="mobile-forecast__summary-value" style={{ color: '#ff4d4f' }}>
                {data.summary.critical}
              </div>
              <div className="mobile-forecast__summary-label">Critical</div>
            </div>
            <div className="mobile-forecast__summary-cell">
              <div className="mobile-forecast__summary-value" style={{ color: '#faad14' }}>
                {data.summary.reorder_soon}
              </div>
              <div className="mobile-forecast__summary-label">Soon</div>
            </div>
            <div className="mobile-forecast__summary-cell">
              <div className="mobile-forecast__summary-value">
                {data.summary.total_part_numbers}
              </div>
              <div className="mobile-forecast__summary-label">Tracked</div>
            </div>
            <div className="mobile-forecast__summary-cell">
              <Button
                size="mini"
                fill="outline"
                onClick={() => {
                  void refetch();
                }}
                loading={isFetching}
              >
                Refresh
              </Button>
            </div>
          </div>
        )}
      </MobileSectionCard>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {(['critical', 'soon', 'expiry_risk', 'ok'] as const).map((urgency) => {
          const bucket = grouped[urgency];
          return (
            <Tabs.Tab
              key={urgency}
              title={`${URGENCY_LABEL[urgency]} (${bucket.length})`}
            >
              {bucket.length === 0 ? (
                <MobileEmptyState
                  title={`No ${URGENCY_LABEL[urgency].toLowerCase()} chemicals`}
                  description={
                    urgency === 'critical'
                      ? 'Good news — nothing is critical right now.'
                      : undefined
                  }
                />
              ) : (
                <List>{bucket.map(renderRow)}</List>
              )}
            </Tabs.Tab>
          );
        })}
      </Tabs>

      <MobileFormSheet
        visible={!!selectedRow}
        title={selectedRow ? `Request Reorder — ${selectedRow.part_number}` : ''}
        subtitle={selectedRow?.description}
        onClose={closeReorder}
        onSubmit={handleSubmit}
        submitting={creating}
        submitLabel="Submit Request"
      >
        {selectedRow && (
          <Form form={form} layout="vertical">
            <Form.Item
              name="quantity"
              label={`Quantity (${selectedRow.unit})`}
              rules={[{ required: true, message: 'Quantity is required' }]}
            >
              <Stepper min={1} />
            </Form.Item>
            <Form.Item
              name="priority"
              label="Priority"
              rules={[{ required: true, message: 'Priority is required' }]}
            >
              <Selector
                options={[
                  { label: 'Routine', value: 'routine' },
                  { label: 'Urgent', value: 'urgent' },
                  { label: 'AOG', value: 'aog' },
                ]}
                multiple={false}
              />
            </Form.Item>
            <Form.Item name="notes" label="Notes">
              <TextArea rows={3} placeholder="Optional context for the fulfillment team" />
            </Form.Item>
            {/* Make React happy with an Input import */}
            <Input style={{ display: 'none' }} />
          </Form>
        )}
      </MobileFormSheet>
    </MobilePageScaffold>
  );
};
