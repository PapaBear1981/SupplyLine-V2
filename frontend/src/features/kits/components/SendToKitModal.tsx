import { useState } from 'react';
import {
  Modal,
  Form,
  Select,
  DatePicker,
  Input,
  Alert,
  Space,
  Typography,
  Tag,
  Spin,
  message,
} from 'antd';
import { ToolOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSendToolToKitMutation } from '../services/kitsApi';
import { useGetToolsQuery } from '@features/tools/services/toolsApi';

const { TextArea } = Input;
const { Text } = Typography;

interface SendToKitModalProps {
  visible: boolean;
  kitId: number;
  kitName: string;
  onClose: () => void;
}

const SendToKitModal = ({ visible, kitId, kitName, onClose }: SendToKitModalProps) => {
  const [form] = Form.useForm();
  const [selectedToolId, setSelectedToolId] = useState<number | null>(null);
  const [toolSearch, setToolSearch] = useState('');

  const [sendToolToKit, { isLoading: isSending }] = useSendToolToKitMutation();

  // Fetch available tools only
  const { data: toolsData, isLoading: toolsLoading } = useGetToolsQuery(
    { status: 'available', q: toolSearch || undefined, per_page: 50 },
    { skip: !visible }
  );

  const availableTools = toolsData?.tools || [];

  const selectedTool = availableTools.find((t) => t.id === selectedToolId);

  const handleClose = () => {
    form.resetFields();
    setSelectedToolId(null);
    setToolSearch('');
    onClose();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const payload: { tool_id: number; notes?: string; expected_return_date?: string } = {
        tool_id: values.tool_id,
      };
      if (values.notes) payload.notes = values.notes;
      if (values.expected_return_date) {
        payload.expected_return_date = (values.expected_return_date as dayjs.Dayjs).toISOString();
      }

      await sendToolToKit({ kitId, data: payload }).unwrap();

      message.success(`Tool sent to kit ${kitName} successfully`);
      handleClose();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string; blocking_reasons?: string[] } };
      if (err?.data?.blocking_reasons?.length) {
        message.error(err.data.blocking_reasons.join('; '));
      } else {
        message.error(err?.data?.error || 'Failed to send tool to kit');
      }
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ToolOutlined />
          Send Tool to Field — {kitName}
        </Space>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={handleClose}
      okText="Send to Kit"
      confirmLoading={isSending}
      width={520}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="The tool will be tracked as deployed to this kit. You can return it from the kit's Field Tools tab."
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="tool_id"
          label="Tool"
          rules={[{ required: true, message: 'Please select a tool' }]}
        >
          <Select
            showSearch
            placeholder="Search by tool number, serial number, or description"
            filterOption={false}
            onSearch={(value) => setToolSearch(value)}
            onChange={(val: number) => setSelectedToolId(val)}
            loading={toolsLoading}
            notFoundContent={
              toolsLoading ? <Spin size="small" /> : 'No available tools found'
            }
            optionLabelProp="label"
          >
            {availableTools.map((tool) => (
              <Select.Option key={tool.id} value={tool.id} label={`${tool.tool_number} — ${tool.description}`}>
                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                  <Text strong>{tool.tool_number}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {tool.description} · S/N: {tool.serial_number}
                    {tool.location ? ` · ${tool.location}` : ''}
                  </Text>
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {selectedTool && (
          <div
            style={{
              background: 'var(--ant-color-bg-container-disabled, #f5f5f5)',
              border: '1px solid var(--ant-color-border, #d9d9d9)',
              borderRadius: 6,
              padding: '10px 14px',
              marginBottom: 16,
            }}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text strong>{selectedTool.description}</Text>
              <Space size="small" wrap>
                <Tag color="blue">Tool #: {selectedTool.tool_number}</Tag>
                <Tag color="default">S/N: {selectedTool.serial_number}</Tag>
                {selectedTool.condition && <Tag>{selectedTool.condition}</Tag>}
                {selectedTool.calibration_status === 'due_soon' && (
                  <Tag icon={<WarningOutlined />} color="warning">
                    Calibration due soon
                  </Tag>
                )}
              </Space>
              {selectedTool.location && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Current location: {selectedTool.location}
                </Text>
              )}
            </Space>
          </div>
        )}

        <Form.Item name="expected_return_date" label="Expected Return Date (optional)">
          <DatePicker
            style={{ width: '100%' }}
            disabledDate={(d) => d && d.isBefore(dayjs(), 'day')}
            placeholder="Select expected return date"
          />
        </Form.Item>

        <Form.Item name="notes" label="Notes (optional)">
          <TextArea
            rows={3}
            placeholder="Reason for deployment, job number, etc."
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SendToKitModal;
