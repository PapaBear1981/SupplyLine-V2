import { useEffect } from 'react';
import { Form, Input, Modal, message } from 'antd';
import { useCancelTransferMutation } from '../services/transfersApi';
import type { Transfer } from '../types';

export interface CancelTransferModalProps {
  open: boolean;
  transfer: Transfer | null;
  onClose: () => void;
}

export const CancelTransferModal = ({
  open,
  transfer,
  onClose,
}: CancelTransferModalProps) => {
  const [form] = Form.useForm();
  const [cancel, { isLoading }] = useCancelTransferMutation();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  if (!transfer) return null;

  const submit = async (values: Record<string, unknown>) => {
    try {
      await cancel({
        id: transfer.id,
        data: { cancel_reason: (values.cancel_reason as string).trim() },
      }).unwrap();
      message.success(`Transfer #${transfer.id} cancelled.`);
      onClose();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to cancel transfer');
    }
  };

  return (
    <Modal
      open={open}
      title={`Cancel transfer #${transfer.id}`}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Cancel transfer"
      okButtonProps={{ loading: isLoading, danger: true }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          label="Reason"
          name="cancel_reason"
          rules={[{ required: true, message: 'Please provide a reason' }]}
        >
          <Input.TextArea rows={3} autoFocus placeholder="e.g. Wrong destination, duplicate request" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
