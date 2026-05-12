import { useMemo, useState } from 'react';
import {
  Modal,
  Form,
  Select,
  InputNumber,
  Input,
  Radio,
  Space,
  Typography,
  Alert,
  message,
  Spin,
} from 'antd';
import {
  useAddKitItemMutation,
  useAddKitExpendableMutation,
  useGetKitBoxesQuery,
} from '../services/kitsApi';
import { useGetWarehousesQuery } from '@features/warehouses/services/warehousesApi';
import { useGetToolsQuery } from '@features/tools/services/toolsApi';
import { useGetChemicalsQuery } from '@features/chemicals/services/chemicalsApi';
import type { ItemType, TrackingType } from '../types';

const { TextArea } = Input;
const { Text } = Typography;

interface AddKitItemModalProps {
  visible: boolean;
  kitId: number;
  onClose: () => void;
}

type ApiError = { data?: { error?: string; message?: string } };

const getErrorMessage = (error: unknown, fallback: string): string => {
  const err = error as ApiError;
  return err?.data?.error || err?.data?.message || fallback;
};

const AddKitItemModal = ({ visible, kitId, onClose }: AddKitItemModalProps) => {
  const [form] = Form.useForm();
  const [itemType, setItemType] = useState<ItemType>('expendable');
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [trackingType, setTrackingType] = useState<TrackingType>('lot');

  const { data: boxes = [], isLoading: boxesLoading } = useGetKitBoxesQuery(kitId, {
    skip: !visible,
  });

  const { data: warehousesData, isLoading: warehousesLoading } = useGetWarehousesQuery(
    { per_page: 100 },
    { skip: !visible || itemType === 'expendable' }
  );
  const warehouses = useMemo(
    () => (warehousesData?.warehouses || []).filter((w) => w.is_active),
    [warehousesData]
  );

  const { data: toolsData, isLoading: toolsLoading } = useGetToolsQuery(
    { warehouse_id: warehouseId, status: 'available', per_page: 200 },
    { skip: !visible || itemType !== 'tool' || !warehouseId }
  );
  const tools = toolsData?.tools || [];

  const { data: chemicalsData, isLoading: chemicalsLoading } = useGetChemicalsQuery(
    { warehouse_id: warehouseId, per_page: 200 },
    { skip: !visible || itemType !== 'chemical' || !warehouseId }
  );
  const chemicals = chemicalsData?.chemicals || [];

  const [addKitItem, { isLoading: isAddingItem }] = useAddKitItemMutation();
  const [addKitExpendable, { isLoading: isAddingExpendable }] = useAddKitExpendableMutation();
  const isSubmitting = isAddingItem || isAddingExpendable;

  const handleClose = () => {
    form.resetFields();
    setItemType('expendable');
    setWarehouseId(undefined);
    setTrackingType('lot');
    onClose();
  };

  const handleTypeChange = (newType: ItemType) => {
    setItemType(newType);
    setWarehouseId(undefined);
    form.setFieldsValue({ warehouse_id: undefined, item_id: undefined });
  };

  const handleWarehouseChange = (id: number) => {
    setWarehouseId(id);
    form.setFieldsValue({ item_id: undefined });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (itemType === 'expendable') {
        const payload: Parameters<typeof addKitExpendable>[0]['data'] = {
          box_id: values.box_id,
          part_number: values.part_number.trim(),
          description: values.description.trim(),
          quantity: values.quantity,
          unit: values.unit || 'each',
          tracking_type: trackingType,
          location: values.location || undefined,
          minimum_stock_level: values.minimum_stock_level || undefined,
        };
        if (trackingType === 'serial' && values.serial_number) {
          payload.serial_number = values.serial_number.trim();
        }
        if (trackingType === 'lot' && values.lot_number) {
          payload.lot_number = values.lot_number.trim();
        }
        await addKitExpendable({ kitId, data: payload }).unwrap();
        message.success('Expendable added to kit');
      } else {
        await addKitItem({
          kitId,
          data: {
            box_id: values.box_id,
            item_type: itemType,
            item_id: values.item_id,
            warehouse_id: values.warehouse_id,
            quantity: values.quantity || 1,
            location: values.location || undefined,
            notes: values.notes || undefined,
          },
        }).unwrap();
        message.success(`${itemType === 'tool' ? 'Tool' : 'Chemical'} added to kit`);
      }

      handleClose();
    } catch (error: unknown) {
      // Skip antd form validation rejections (they have errorFields)
      if ((error as { errorFields?: unknown })?.errorFields) return;
      message.error(getErrorMessage(error, 'Failed to add item to kit'));
    }
  };

  return (
    <Modal
      title="Add Item to Kit"
      open={visible}
      onOk={handleSubmit}
      onCancel={handleClose}
      okText="Add Item"
      confirmLoading={isSubmitting}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ quantity: 1, unit: 'each' }}
      >
        <Form.Item label="Item Type" required>
          <Radio.Group
            value={itemType}
            onChange={(e) => handleTypeChange(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="expendable">Expendable</Radio.Button>
            <Radio.Button value="tool">Tool</Radio.Button>
            <Radio.Button value="chemical">Chemical</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="box_id"
          label="Box"
          rules={[{ required: true, message: 'Please select a box' }]}
        >
          <Select
            placeholder="Select a box"
            loading={boxesLoading}
            notFoundContent={
              boxesLoading ? <Spin size="small" /> : 'No boxes — create a box first'
            }
          >
            {boxes.map((box) => (
              <Select.Option key={box.id} value={box.id}>
                {box.box_number}
                {box.description ? ` — ${box.description}` : ''}
                <Text type="secondary"> ({box.box_type})</Text>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {itemType !== 'expendable' && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`${itemType === 'tool' ? 'Tools' : 'Chemicals'} are transferred from a warehouse into the kit.`}
            />

            <Form.Item
              name="warehouse_id"
              label="Source Warehouse"
              rules={[{ required: true, message: 'Please select a warehouse' }]}
            >
              <Select
                placeholder="Select warehouse"
                loading={warehousesLoading}
                onChange={handleWarehouseChange}
              >
                {warehouses.map((w) => (
                  <Select.Option key={w.id} value={w.id}>
                    {w.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="item_id"
              label={itemType === 'tool' ? 'Tool' : 'Chemical'}
              rules={[{ required: true, message: `Please select a ${itemType}` }]}
            >
              <Select
                showSearch
                placeholder={
                  warehouseId
                    ? `Search ${itemType === 'tool' ? 'tools' : 'chemicals'} in this warehouse`
                    : 'Select a warehouse first'
                }
                disabled={!warehouseId}
                loading={itemType === 'tool' ? toolsLoading : chemicalsLoading}
                optionFilterProp="label"
                notFoundContent={
                  (itemType === 'tool' ? toolsLoading : chemicalsLoading) ? (
                    <Spin size="small" />
                  ) : (
                    `No available ${itemType === 'tool' ? 'tools' : 'chemicals'} in this warehouse`
                  )
                }
              >
                {itemType === 'tool'
                  ? tools.map((t) => (
                      <Select.Option
                        key={t.id}
                        value={t.id}
                        label={`${t.tool_number} ${t.serial_number} ${t.description}`}
                      >
                        <Space direction="vertical" size={0}>
                          <Text strong>{t.tool_number}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            S/N: {t.serial_number} — {t.description}
                          </Text>
                        </Space>
                      </Select.Option>
                    ))
                  : chemicals.map((c) => (
                      <Select.Option
                        key={c.id}
                        value={c.id}
                        label={`${c.part_number} ${c.lot_number} ${c.description ?? ''}`}
                      >
                        <Space direction="vertical" size={0}>
                          <Text strong>{c.part_number}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Lot: {c.lot_number}
                            {c.description ? ` — ${c.description}` : ''} · Qty: {c.quantity}
                          </Text>
                        </Space>
                      </Select.Option>
                    ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="quantity"
              label="Quantity"
              rules={[{ required: true, message: 'Quantity is required' }]}
            >
              <InputNumber min={0.01} step={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="location" label="Location in Kit (optional)">
              <Input placeholder="e.g. Drawer 2, Slot A" maxLength={100} />
            </Form.Item>

            <Form.Item name="notes" label="Transfer Notes (optional)">
              <TextArea rows={2} maxLength={500} showCount />
            </Form.Item>
          </>
        )}

        {itemType === 'expendable' && (
          <>
            <Form.Item
              name="part_number"
              label="Part Number"
              rules={[{ required: true, message: 'Part number is required' }]}
            >
              <Input maxLength={100} />
            </Form.Item>

            <Form.Item
              name="description"
              label="Description"
              rules={[{ required: true, message: 'Description is required' }]}
            >
              <Input maxLength={255} />
            </Form.Item>

            <Space size="middle" style={{ display: 'flex' }}>
              <Form.Item
                name="quantity"
                label="Quantity"
                rules={[{ required: true, message: 'Quantity is required' }]}
                style={{ flex: 1 }}
              >
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="unit" label="Unit" style={{ flex: 1 }}>
                <Input placeholder="each" maxLength={20} />
              </Form.Item>

              <Form.Item name="minimum_stock_level" label="Min Stock" style={{ flex: 1 }}>
                <InputNumber min={0} step={1} style={{ width: '100%' }} />
              </Form.Item>
            </Space>

            <Form.Item label="Tracking Type">
              <Radio.Group
                value={trackingType}
                onChange={(e) => setTrackingType(e.target.value)}
              >
                <Radio value="lot">Lot (auto-generated if blank)</Radio>
                <Radio value="serial">Serial</Radio>
              </Radio.Group>
            </Form.Item>

            {trackingType === 'serial' && (
              <Form.Item
                name="serial_number"
                label="Serial Number"
                rules={[{ required: true, message: 'Serial number is required' }]}
              >
                <Input maxLength={100} />
              </Form.Item>
            )}

            {trackingType === 'lot' && (
              <Form.Item
                name="lot_number"
                label="Lot Number (optional — auto-generated if blank)"
              >
                <Input maxLength={100} />
              </Form.Item>
            )}

            <Form.Item name="location" label="Location in Kit (optional)">
              <Input placeholder="e.g. Drawer 2, Slot A" maxLength={100} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default AddKitItemModal;
