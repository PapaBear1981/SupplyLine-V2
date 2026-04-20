import { useEffect } from 'react';
import {
  Descriptions,
  Form,
  Input,
  Modal,
  Tag,
  Typography,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { useReceiveTransferMutation } from '../services/transfersApi';
import type { Transfer } from '../types';

const { Text } = Typography;

export interface ReceiveTransferModalProps {
  open: boolean;
  transfer: Transfer | null;
  onClose: () => void;
}

export const ReceiveTransferModal = ({
  open,
  transfer,
  onClose,
}: ReceiveTransferModalProps) => {
  const [form] = Form.useForm();
  const [receive, { isLoading }] = useReceiveTransferMutation();

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  if (!transfer) return null;

  const submit = async (values: Record<string, unknown>) => {
    try {
      await receive({
        id: transfer.id,
        data: {
          destination_location: (values.destination_location as string).trim(),
          received_notes: (values.received_notes as string) || undefined,
        },
      }).unwrap();
      message.success(`Transfer #${transfer.id} received.`);
      onClose();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to receive transfer');
    }
  };

  return (
    <Modal
      open={open}
      title={`Receive transfer #${transfer.id}`}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Receive"
      okButtonProps={{ loading: isLoading }}
      destroyOnHidden
    >
      <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Item">
          <Tag>{transfer.item_type}</Tag>
          <Text>
            {transfer.item_snapshot?.description ||
              transfer.item_snapshot?.identifier ||
              `ID ${transfer.item_id}`}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Quantity">{transfer.quantity}</Descriptions.Item>
        <Descriptions.Item label="From">{transfer.from_warehouse}</Descriptions.Item>
        <Descriptions.Item label="To">{transfer.to_warehouse}</Descriptions.Item>
        <Descriptions.Item label="Initiated by">
          {transfer.transferred_by} —{' '}
          {transfer.transfer_date
            ? dayjs(transfer.transfer_date).format('MMM D, YYYY h:mm A')
            : '—'}
        </Descriptions.Item>
        {transfer.source_location && (
          <Descriptions.Item label="Source location">
            {transfer.source_location}
          </Descriptions.Item>
        )}
        {transfer.notes && (
          <Descriptions.Item label="Notes">{transfer.notes}</Descriptions.Item>
        )}
      </Descriptions>

      <Form form={form} layout="vertical" onFinish={submit} preserve={false}>
        <Form.Item
          label="Destination location"
          name="destination_location"
          rules={[
            { required: true, message: 'Where is it being stored?' },
            {
              validator: (_, value: string) =>
                value && value.trim().length > 0
                  ? Promise.resolve()
                  : Promise.reject('Location cannot be blank'),
            },
          ]}
        >
          <Input placeholder="e.g. Shelf 2A, Bin B3, Cabinet 7" autoFocus />
        </Form.Item>
        <Form.Item label="Receipt notes (optional)" name="received_notes">
          <Input.TextArea
            rows={2}
            placeholder="Quantity matches, condition notes, etc."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
