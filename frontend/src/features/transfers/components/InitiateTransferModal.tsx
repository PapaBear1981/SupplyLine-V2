import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  message,
  theme,
} from 'antd';
import { useAppSelector } from '@app/hooks';
import { useActiveWarehouse } from '@features/warehouses/hooks/useActiveWarehouse';
import { useGetWarehousesQuery } from '@features/warehouses/services/warehousesApi';
import { useGetToolsQuery } from '@features/tools/services/toolsApi';
import { useGetChemicalsQuery } from '@features/chemicals/services/chemicalsApi';
import type { Tool } from '@features/tools/types';
import type { Chemical } from '@features/chemicals/types';
import { useInitiateTransferMutation } from '../services/transfersApi';
import type { InitiateTransferItemType, InitiateTransferPayload } from '../types';

const { Text } = Typography;

export interface InitiateTransferModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional preset: locks the item type and item id. Used when opening
      from a tool/chemical row or from the checkout warehouse-mismatch guard. */
  preset?: {
    itemType: InitiateTransferItemType;
    itemId: number;
    itemLabel?: string;
    sourceWarehouseId?: number | null;
  };
}

export const InitiateTransferModal = ({
  open,
  onClose,
  preset,
}: InitiateTransferModalProps) => {
  const [form] = Form.useForm();
  const { token } = theme.useToken();
  const isAdmin = useAppSelector((s) => s.auth.user?.is_admin);
  const { activeWarehouseId, activeWarehouseName } = useActiveWarehouse();
  const { data: warehousesData } = useGetWarehousesQuery({
    include_inactive: false,
    per_page: 200,
  });
  const [initiate, { isLoading }] = useInitiateTransferMutation();

  const itemType: InitiateTransferItemType = Form.useWatch('item_type', form) ?? 'tool';

  // Admins can pick any source warehouse without changing the header selector.
  // Non-admins are always locked to their active warehouse.
  const [adminSourceId, setAdminSourceId] = useState<number | null>(null);
  const sourceWarehouseId = isAdmin ? (adminSourceId ?? activeWarehouseId) : activeWarehouseId;
  const sourceWarehouseName = useMemo(() => {
    if (!isAdmin || adminSourceId == null) return activeWarehouseName;
    return warehousesData?.warehouses.find((w) => w.id === adminSourceId)?.name ?? activeWarehouseName;
  }, [isAdmin, adminSourceId, activeWarehouseName, warehousesData]);

  // Search text drives the autocomplete queries
  const [itemSearch, setItemSearch] = useState('');

  // Resolved item — stored in state so the button enables reactively
  const [resolvedTool, setResolvedTool] = useState<Tool | null>(null);
  const [resolvedChemical, setResolvedChemical] = useState<Chemical | null>(null);

  const resolvedId =
    preset?.itemId ?? (itemType === 'tool' ? resolvedTool?.id : resolvedChemical?.id);
  const resolvedItem = itemType === 'tool' ? resolvedTool : resolvedChemical;

  // Autocomplete data — scoped to the source warehouse
  const { data: toolsData, isFetching: toolsFetching } = useGetToolsQuery(
    { page: 1, per_page: 30, q: itemSearch || undefined, warehouse_id: sourceWarehouseId ?? undefined, status: 'available' },
    { skip: !sourceWarehouseId || !!preset?.itemId || itemType !== 'tool' }
  );

  const { data: chemicalsData, isFetching: chemsFetching } = useGetChemicalsQuery(
    { page: 1, per_page: 30, q: itemSearch || undefined, warehouse_id: sourceWarehouseId ?? undefined },
    { skip: !sourceWarehouseId || !!preset?.itemId || itemType !== 'chemical' }
  );

  type ItemOption = { value: number; label: string; item: Tool | Chemical };

  const toolOptions: ItemOption[] = useMemo(
    () =>
      (toolsData?.tools ?? []).map((t) => ({
        value: t.id,
        label: `${t.tool_number} · S/N ${t.serial_number}${t.description ? ` — ${t.description}` : ''}`,
        item: t as Tool | Chemical,
      })),
    [toolsData]
  );

  const chemicalOptions: ItemOption[] = useMemo(
    () =>
      (chemicalsData?.chemicals ?? []).map((c) => ({
        value: c.id,
        label: `${c.part_number} / ${c.lot_number}${c.description ? ` — ${c.description}` : ''} (${c.quantity} ${c.unit})`,
        item: c as Tool | Chemical,
      })),
    [chemicalsData]
  );

  const destinationOptions = useMemo(
    () =>
      (warehousesData?.warehouses || [])
        .filter((w) => w.is_active && w.id !== sourceWarehouseId)
        .map((w) => ({ label: w.name, value: w.id })),
    [warehousesData, sourceWarehouseId]
  );

  const allWarehouseOptions = useMemo(
    () =>
      (warehousesData?.warehouses || [])
        .filter((w) => w.is_active)
        .map((w) => ({ label: w.name, value: w.id })),
    [warehousesData]
  );

  // Reset all state when the modal opens — use a ref to track previous open
  // state so we can call setState in a timeout (avoids cascading-render lint rule)
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const t = setTimeout(() => {
        form.resetFields();
        form.setFieldsValue({ item_type: preset?.itemType ?? 'tool', quantity: 1 });
        setItemSearch('');
        setResolvedTool(null);
        setResolvedChemical(null);
        setAdminSourceId(null);
      }, 0);
      return () => clearTimeout(t);
    }
    prevOpenRef.current = open;
  }, [open, preset, form]);

  // Keep quantity within available stock when a chemical is selected
  useEffect(() => {
    if (resolvedChemical) {
      const current = form.getFieldValue('quantity') as number | undefined;
      const maxQty = resolvedChemical.quantity;
      if (maxQty < 1) {
        form.setFieldsValue({ quantity: 0 });
      } else if (!current || current > maxQty) {
        form.setFieldsValue({ quantity: Math.min(current ?? 1, maxQty) });
      }
    }
  }, [resolvedChemical, form]);

  const handleItemSelect = (
    _value: number,
    option: unknown
  ) => {
    const opt = option as { item: Tool | Chemical };
    if (itemType === 'tool') {
      setResolvedTool(opt.item as Tool);
      setResolvedChemical(null);
    } else {
      setResolvedChemical(opt.item as Chemical);
      setResolvedTool(null);
    }
    setItemSearch('');
  };

  const clearResolved = () => {
    setResolvedTool(null);
    setResolvedChemical(null);
    setItemSearch('');
  };

  const submit = async (values: Record<string, unknown>) => {
    if (!resolvedId) {
      message.error('Select an item before initiating a transfer.');
      return;
    }
    const transferPayload: InitiateTransferPayload = {
      to_warehouse_id: values.to_warehouse_id as number,
      item_type: values.item_type as InitiateTransferItemType,
      item_id: resolvedId,
      quantity: Number(values.quantity) || 1,
      notes: (values.notes as string) || undefined,
      // If admin chose a different source warehouse, include it so the backend uses it.
      ...(isAdmin && adminSourceId != null && adminSourceId !== activeWarehouseId
        ? { from_warehouse_id: adminSourceId }
        : {}),
    };
    try {
      const result = await initiate(transferPayload).unwrap();
      message.success(
        `Transfer initiated — awaiting receipt at destination (#${result.transfer.id}).`
      );
      onClose();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to initiate transfer');
    }
  };

  return (
    <Modal
      open={open}
      title="Initiate transfer"
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Initiate"
      okButtonProps={{ loading: isLoading, disabled: !resolvedId }}
      destroyOnHidden
    >
      {!sourceWarehouseId && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No source warehouse"
          description={
            isAdmin
              ? 'Select a source warehouse below.'
              : 'Pick an active warehouse in the header before initiating transfers.'
          }
        />
      )}

      {isAdmin ? (
        <Form.Item label="Source warehouse" style={{ marginBottom: 16 }}>
          <Select
            options={allWarehouseOptions}
            value={adminSourceId ?? activeWarehouseId ?? undefined}
            onChange={(val: number) => {
              setAdminSourceId(val);
              clearResolved();
            }}
            placeholder="Select source warehouse"
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <Space>
              <Text>Source:</Text>
              <Text strong>{sourceWarehouseName || 'Your active warehouse'}</Text>
            </Space>
          }
          description="The destination user will assign the physical location on receipt."
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={submit}
        disabled={!sourceWarehouseId}
        preserve={false}
      >
        <Form.Item
          label="Item type"
          name="item_type"
          rules={[{ required: true, message: 'Required' }]}
        >
          <Segmented
            options={[
              { label: 'Tool', value: 'tool' },
              { label: 'Chemical', value: 'chemical' },
            ]}
            disabled={Boolean(preset?.itemType)}
            onChange={clearResolved}
          />
        </Form.Item>

        {/* ---- Item selection ---- */}
        {preset?.itemId ? (
          <Form.Item label="Item">
            <Input
              value={preset.itemLabel ?? `${preset.itemType} #${preset.itemId}`}
              disabled
            />
          </Form.Item>
        ) : (
          <Form.Item
            label={itemType === 'tool' ? 'Tool' : 'Chemical'}
            required
            help={
              itemType === 'tool'
                ? 'Search by tool number, serial number, or description'
                : 'Search by part number, lot number, or description'
            }
          >
            <Select
              showSearch
              filterOption={false}
              onSearch={setItemSearch}
              onChange={handleItemSelect}
              onClear={clearResolved}
              allowClear
              loading={toolsFetching || chemsFetching}
              placeholder={
                itemType === 'tool'
                  ? 'Type to search tools in this warehouse…'
                  : 'Type to search chemicals in this warehouse…'
              }
              options={itemType === 'tool' ? toolOptions : chemicalOptions}
              notFoundContent={
                itemSearch.length > 0
                  ? `No ${itemType}s found matching "${itemSearch}"`
                  : `Type to search ${itemType}s in ${activeWarehouseName ?? 'your warehouse'}`
              }
              style={{ width: '100%' }}
            />
          </Form.Item>
        )}

        {/* ---- Found item confirmation card ---- */}
        {resolvedItem && (
          <Card
            size="small"
            style={{
              marginBottom: 12,
              background: token.colorSuccessBg,
              borderColor: token.colorSuccessBorder,
            }}
          >
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Space>
                <Tag color="success">Found</Tag>
                <Text strong>{resolvedItem.description}</Text>
              </Space>
              {itemType === 'tool' ? (
                <>
                  <Text type="secondary">
                    Tool #: {(resolvedItem as Tool).tool_number}
                    {' · '}S/N: {(resolvedItem as Tool).serial_number}
                  </Text>
                  {resolvedItem.location && (
                    <Text type="secondary">Location: {resolvedItem.location}</Text>
                  )}
                  {(resolvedItem as Tool).status && (
                    <Text type="secondary">Status: {(resolvedItem as Tool).status}</Text>
                  )}
                </>
              ) : (
                <>
                  <Text type="secondary">
                    P/N: {(resolvedItem as Chemical).part_number}
                    {' · '}Lot: {(resolvedItem as Chemical).lot_number}
                  </Text>
                  <Text type="secondary">
                    Available: {(resolvedItem as Chemical).quantity}{' '}
                    {(resolvedItem as Chemical).unit}
                  </Text>
                  {resolvedItem.location && (
                    <Text type="secondary">Location: {resolvedItem.location}</Text>
                  )}
                </>
              )}
            </Space>
          </Card>
        )}

        <Form.Item
          label="Destination warehouse"
          name="to_warehouse_id"
          rules={[{ required: true, message: 'Required' }]}
        >
          <Select
            options={destinationOptions}
            placeholder="Select destination warehouse"
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        {itemType === 'chemical' && (
          <Form.Item
            label={
              resolvedChemical
                ? `Quantity (max ${resolvedChemical.quantity} ${resolvedChemical.unit})`
                : 'Quantity'
            }
            name="quantity"
            rules={[
              { required: true, message: 'Quantity is required' },
              { type: 'number', min: 1, message: 'Must be at least 1' },
              {
                validator: (_, value) => {
                  if (resolvedChemical && resolvedChemical.quantity < 1) {
                    return Promise.reject('This chemical is out of stock');
                  }
                  if (resolvedChemical && value > resolvedChemical.quantity) {
                    return Promise.reject(`Only ${resolvedChemical.quantity} available`);
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <InputNumber
              min={1}
              max={resolvedChemical?.quantity}
              style={{ width: '100%' }}
            />
          </Form.Item>
        )}

        <Form.Item label="Notes (optional)" name="notes">
          <Input.TextArea
            rows={2}
            placeholder="Shipping method, tracking number, etc."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
