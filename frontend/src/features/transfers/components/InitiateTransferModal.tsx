import { useEffect, useMemo } from 'react';
import {
  Alert,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import { useActiveWarehouse } from '@features/warehouses/hooks/useActiveWarehouse';
import { useGetWarehousesQuery } from '@features/warehouses/services/warehousesApi';
import { useInitiateTransferMutation } from '../services/transfersApi';
import type { InitiateTransferPayload, TransferItemType } from '../types';

const { Text } = Typography;

export interface InitiateTransferModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional preset: locks the item type and item id. Used when opening
      from a tool/chemical row or from the checkout warehouse-mismatch guard. */
  preset?: {
    itemType: TransferItemType;
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
  const { activeWarehouseId, activeWarehouseName } = useActiveWarehouse();
  const { data: warehousesData } = useGetWarehousesQuery({
    include_inactive: false,
    per_page: 200,
  });
  const [initiate, { isLoading }] = useInitiateTransferMutation();

  const destinationOptions = useMemo(() => {
    return (warehousesData?.warehouses || [])
      .filter((w) => w.is_active && w.id !== activeWarehouseId)
      .map((w) => ({ label: w.name, value: w.id }));
  }, [warehousesData, activeWarehouseId]);

  const itemType: TransferItemType = Form.useWatch('item_type', form) || 'tool';

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        item_type: preset?.itemType || 'tool',
        item_id: preset?.itemId,
        quantity: 1,
      });
    }
  }, [open, preset, form]);

  const submit = async (values: Record<string, unknown>) => {
    const payload: InitiateTransferPayload = {
      to_warehouse_id: values.to_warehouse_id as number,
      item_type: values.item_type as TransferItemType,
      item_id: Number(values.item_id),
      quantity: Number(values.quantity) || 1,
      notes: (values.notes as string) || undefined,
    };
    try {
      const result = await initiate(payload).unwrap();
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
      okButtonProps={{ loading: isLoading }}
      destroyOnClose
    >
      {!activeWarehouseId && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No active warehouse"
          description="Pick an active warehouse in the header before initiating transfers."
        />
      )}

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={
          <Space>
            <Text>Source:</Text>
            <Text strong>{activeWarehouseName || 'Your active warehouse'}</Text>
          </Space>
        }
        description="The destination user will assign the physical location on receipt."
      />

      <Form form={form} layout="vertical" onFinish={submit} disabled={!activeWarehouseId}>
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
          />
        </Form.Item>

        <Form.Item
          label={preset?.itemLabel ? `Item (${preset.itemLabel})` : 'Item ID'}
          name="item_id"
          rules={[{ required: true, message: 'Required' }]}
          help="Use the tool / chemical row's ID. The initiate-from-row flow pre-fills this."
        >
          <InputNumber style={{ width: '100%' }} min={1} disabled={Boolean(preset?.itemId)} />
        </Form.Item>

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
            label="Quantity"
            name="quantity"
            rules={[{ required: true, message: 'Required' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        )}

        <Form.Item label="Notes (optional)" name="notes">
          <Input.TextArea rows={2} placeholder="Shipping method, tracking number, etc." />
        </Form.Item>
      </Form>
    </Modal>
  );
};
