import { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Upload,
  Button,
  Space,
  message,
  Typography,
  Alert,
} from 'antd';
import {
  InboxOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCreateReorderMutation } from '../services/kitsApi';
import type { ItemType } from '../types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface CreateReorderModalProps {
  visible: boolean;
  kitId: number;
  onClose: () => void;
  prefilledData?: {
    item_type?: ItemType;
    item_id?: number;
    part_number?: string;
    description?: string;
    quantity_requested?: number;
  };
}

const CreateReorderModal = ({
  visible,
  kitId,
  onClose,
  prefilledData,
}: CreateReorderModalProps) => {
  const [form] = Form.useForm();
  const [createReorder, { isLoading }] = useCreateReorderMutation();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const reorderData = {
        item_type: values.item_type,
        item_id: values.item_id,
        part_number: values.part_number,
        description: values.description,
        quantity_requested: values.quantity_requested,
        priority: values.priority || 'medium',
        notes: values.notes,
        image: imageFile || undefined,
      };

      await createReorder({ kitId, data: reorderData }).unwrap();

      message.success('Reorder request created successfully!');
      form.resetFields();
      setImageFile(null);
      setFileList([]);
      onClose();
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      message.error(err?.data?.message || 'Failed to create reorder request');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setImageFile(null);
    setFileList([]);
    onClose();
  };

  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('You can only upload image files!');
      return false;
    }

    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('Image must be smaller than 5MB!');
      return false;
    }

    setImageFile(file);
    setFileList([
      {
        uid: '-1',
        name: file.name,
        status: 'done',
        url: URL.createObjectURL(file),
      },
    ]);
    return false; // Prevent auto upload
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setFileList([]);
  };

  // Set initial values when modal opens with prefilled data
  if (visible && prefilledData && form.getFieldValue('part_number') !== prefilledData.part_number) {
    form.setFieldsValue(prefilledData);
  }

  return (
    <Modal
      title="Create Reorder Request"
      open={visible}
      onCancel={handleCancel}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={isLoading}
          onClick={handleSubmit}
        >
          Create Reorder
        </Button>,
      ]}
    >
      <Alert
        message="Note: Tools are handled differently and cannot be reordered through this system."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item
          name="item_type"
          label="Item Type"
          rules={[{ required: true, message: 'Please select an item type' }]}
          initialValue="expendable"
        >
          <Select placeholder="Select item type">
            <Option value="chemical">
              <Space>
                <span>⚗️</span>
                <Text>Chemical</Text>
              </Space>
            </Option>
            <Option value="expendable">
              <Space>
                <span>📦</span>
                <Text>Expendable</Text>
              </Space>
            </Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="part_number"
          label="Part Number"
          rules={[
            { required: true, message: 'Please enter a part number' },
            { min: 2, message: 'Part number must be at least 2 characters' },
          ]}
        >
          <Input placeholder="Enter part number" />
        </Form.Item>

        <Form.Item
          name="description"
          label="Description"
          rules={[
            { required: true, message: 'Please enter a description' },
            { min: 5, message: 'Description must be at least 5 characters' },
          ]}
        >
          <Input placeholder="Enter item description" />
        </Form.Item>

        <Form.Item
          name="quantity_requested"
          label="Quantity Requested"
          rules={[
            { required: true, message: 'Please enter a quantity' },
            {
              type: 'number',
              min: 1,
              message: 'Quantity must be at least 1',
            },
          ]}
        >
          <InputNumber
            placeholder="Enter quantity"
            min={1}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          name="priority"
          label="Priority"
          initialValue="medium"
        >
          <Select placeholder="Select priority">
            <Option value="low">
              <Space>
                <span style={{ color: '#8c8c8c' }}>●</span>
                <Text>Low</Text>
              </Space>
            </Option>
            <Option value="medium">
              <Space>
                <span style={{ color: '#1890ff' }}>●</span>
                <Text>Medium</Text>
              </Space>
            </Option>
            <Option value="high">
              <Space>
                <span style={{ color: '#fa8c16' }}>●</span>
                <Text>High</Text>
              </Space>
            </Option>
            <Option value="urgent">
              <Space>
                <span style={{ color: '#f5222d' }}>●</span>
                <Text>Urgent</Text>
              </Space>
            </Option>
          </Select>
        </Form.Item>

        <Form.Item name="notes" label="Notes">
          <TextArea
            placeholder="Enter any additional notes or requirements"
            rows={4}
          />
        </Form.Item>

        <Form.Item label="Image (Optional)">
          {fileList.length === 0 ? (
            <Upload.Dragger
              beforeUpload={beforeUpload}
              fileList={fileList}
              maxCount={1}
              accept="image/*"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                Click or drag image to this area to upload
              </p>
              <p className="ant-upload-hint">
                Support for a single image upload. Maximum file size: 5MB
              </p>
            </Upload.Dragger>
          ) : (
            <div style={{ position: 'relative' }}>
              <img
                src={fileList[0].url}
                alt="Preview"
                style={{
                  width: '100%',
                  maxHeight: 300,
                  objectFit: 'contain',
                  borderRadius: 4,
                  border: '1px solid #d9d9d9',
                }}
              />
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleRemoveImage}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                }}
              >
                Remove
              </Button>
            </div>
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateReorderModal;
