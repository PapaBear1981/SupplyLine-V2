import { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Upload,
  Typography,
  Space,
  Alert,
  message,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { useCreateKitReorderMutation } from '../../orders/services/kitReordersApi';
import type { KitReorderPriority, KitItemType } from '../../orders/types';

const { TextArea } = Input;
const { Text } = Typography;
const { Dragger } = Upload;

interface CreateReorderModalProps {
  open: boolean;
  kitId: number;
  kitName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  item_type: KitItemType;
  part_number: string;
  description: string;
  quantity_requested: number;
  priority: KitReorderPriority;
  notes?: string;
}

const CreateReorderModal = ({
  open,
  kitId,
  kitName,
  onClose,
  onSuccess,
}: CreateReorderModalProps) => {
  const [form] = Form.useForm<FormValues>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [createReorder, { isLoading }] = useCreateKitReorderMutation();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Prepare the data
      const data: {
        item_type: KitItemType;
        part_number: string;
        description: string;
        quantity_requested: number;
        priority: KitReorderPriority;
        notes?: string;
        image?: File;
      } = {
        item_type: values.item_type,
        part_number: values.part_number,
        description: values.description,
        quantity_requested: values.quantity_requested,
        priority: values.priority,
        notes: values.notes,
      };

      // Add image if provided
      if (fileList.length > 0 && fileList[0].originFileObj) {
        data.image = fileList[0].originFileObj;
      }

      await createReorder({ kitId, data }).unwrap();
      message.success('Reorder request created successfully');
      form.resetFields();
      setFileList([]);
      onSuccess();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      if (err.data?.error) {
        message.error(err.data.error);
      } else {
        // Form validation error - no need to show message
      }
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setFileList([]);
    onClose();
  };

  const uploadProps: UploadProps = {
    beforeUpload: (file) => {
      // Validate file type
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('You can only upload image files!');
        return false;
      }

      // Validate file size (5MB max)
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.error('Image must be smaller than 5MB!');
        return false;
      }

      return false; // Prevent auto upload
    },
    onChange: ({ fileList: newFileList }) => {
      setFileList(newFileList.slice(-1)); // Only keep the last file
    },
    fileList,
    maxCount: 1,
    accept: 'image/*',
    listType: 'picture',
  };

  return (
    <Modal
      title={`Create Reorder Request - ${kitName}`}
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText="Create Reorder"
      confirmLoading={isLoading}
      width={600}
      destroyOnClose
    >
      <Alert
        message="Kit Replenishment"
        description="This will create a reorder request for this kit. The request will be visible in the Requests page and can be tracked through the procurement process."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          item_type: 'expendable',
          priority: 'medium',
          quantity_requested: 1,
        }}
      >
        <Form.Item
          name="item_type"
          label="Item Type"
          rules={[{ required: true, message: 'Please select item type' }]}
          extra={<Text type="secondary">Tooling is handled separately and is not available here.</Text>}
        >
          <Select
            options={[
              { label: 'Expendable', value: 'expendable' },
              { label: 'Chemical', value: 'chemical' },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="part_number"
          label="Part Number"
          rules={[{ required: true, message: 'Please enter part number' }]}
        >
          <Input placeholder="Enter part number" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
          rules={[{ required: true, message: 'Please enter description' }]}
        >
          <TextArea
            rows={2}
            placeholder="Enter item description"
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Space size="large" style={{ width: '100%' }}>
          <Form.Item
            name="quantity_requested"
            label="Quantity"
            rules={[
              { required: true, message: 'Please enter quantity' },
              { type: 'number', min: 0.01, message: 'Quantity must be greater than 0' },
            ]}
            style={{ width: 150 }}
          >
            <InputNumber
              min={0.01}
              step={1}
              style={{ width: '100%' }}
              placeholder="Qty"
            />
          </Form.Item>

          <Form.Item
            name="priority"
            label="Priority"
            rules={[{ required: true, message: 'Please select priority' }]}
            style={{ width: 150 }}
          >
            <Select
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
                { label: 'Urgent', value: 'urgent' },
              ]}
            />
          </Form.Item>
        </Space>

        <Form.Item
          name="notes"
          label="Notes (Optional)"
        >
          <TextArea
            rows={3}
            placeholder="Add any additional notes or special instructions..."
            maxLength={1000}
            showCount
          />
        </Form.Item>

        <Form.Item label="Image (Optional)">
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag an image to upload</p>
            <p className="ant-upload-hint">
              Upload an image of the item if needed (max 5MB)
            </p>
          </Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateReorderModal;
