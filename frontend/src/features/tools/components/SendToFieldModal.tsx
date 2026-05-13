import { useMemo } from 'react';
import { Form, Modal, Select, Input, DatePicker, message, Alert } from 'antd';
import dayjs from 'dayjs';
import {
  useSendToolToFieldMutation,
} from '../services/toolsApi';
import { useGetKitsQuery } from '@features/kits/services/kitsApi';
import type { Tool } from '../types';
import type { Kit } from '@features/kits/types';

interface SendToFieldModalProps {
  open: boolean;
  tool: Tool | null;
  onClose: () => void;
}

interface FormValues {
  kit_id: number;
  notes?: string;
  expected_return_date?: dayjs.Dayjs;
}

/**
 * Strict picker for sending a tool to a registered field location.
 * The dropdown is populated from active kits — Materials users can only
 * pick existing tail/tanker/trailer entries; only admins can register new
 * ones in the slimmed Kit admin surface.
 */
export const SendToFieldModal = ({ open, tool, onClose }: SendToFieldModalProps) => {
  const [form] = Form.useForm<FormValues>();
  const { data: kits, isFetching } = useGetKitsQuery(
    { status: 'active' },
    { skip: !open },
  );
  const [sendToField, { isLoading }] = useSendToolToFieldMutation();

  const options = useMemo(() => {
    return (kits ?? [])
      .filter((k: Kit) =>
        k.aircraft_tail_number || k.tanker_scooper_number || k.trailer_number,
      )
      .map((k: Kit) => {
        const parts = [
          k.aircraft_tail_number && `Tail ${k.aircraft_tail_number}`,
          k.tanker_scooper_number && `Tanker ${k.tanker_scooper_number}`,
          k.trailer_number && `Trailer ${k.trailer_number}`,
        ].filter(Boolean);
        return {
          value: k.id,
          label: parts.join(' / ') || k.name,
        };
      });
  }, [kits]);

  const handleSubmit = async () => {
    if (!tool) return;
    const values = await form.validateFields();
    try {
      await sendToField({
        toolId: tool.id,
        kitId: values.kit_id,
        notes: values.notes,
        expected_return_date: values.expected_return_date
          ? values.expected_return_date.toISOString()
          : undefined,
      }).unwrap();
      message.success(`Tool ${tool.tool_number} sent to field`);
      form.resetFields();
      onClose();
    } catch (err) {
      const e = err as { data?: { error?: string; blocking_reasons?: string[] } };
      const reasons = e?.data?.blocking_reasons?.join('; ');
      message.error(reasons || e?.data?.error || 'Failed to send tool to field');
    }
  };

  return (
    <Modal
      title={tool ? `Send ${tool.tool_number} to Field` : 'Send to Field'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText="Send"
      okButtonProps={{ loading: isLoading, disabled: !tool || options.length === 0 }}
      destroyOnHidden
    >
      {!isFetching && options.length === 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="No registered field locations"
          description="An administrator must register at least one field location (tail / tanker / trailer) before tools can be sent."
        />
      )}
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="kit_id"
          label="Field Location"
          rules={[{ required: true, message: 'Pick a registered field location' }]}
        >
          <Select
            placeholder="Select tail / tanker / trailer"
            options={options}
            loading={isFetching}
            showSearch
            optionFilterProp="label"
            data-testid="send-to-field-location-select"
          />
        </Form.Item>
        <Form.Item name="expected_return_date" label="Expected Return Date">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={3} maxLength={1000} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
