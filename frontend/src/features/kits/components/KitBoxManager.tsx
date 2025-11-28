import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Popconfirm,
  Typography,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  useGetKitBoxesQuery,
  useAddKitBoxMutation,
  useUpdateKitBoxMutation,
  useDeleteKitBoxMutation,
} from '../services/kitsApi';
import type { KitBox, BoxType } from '../types';

const { Option } = Select;
const { Title } = Typography;

interface KitBoxManagerProps {
  kitId: number;
}

const KitBoxManager = ({ kitId }: KitBoxManagerProps) => {
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBox, setEditingBox] = useState<KitBox | null>(null);

  const { data: boxes = [], isLoading } = useGetKitBoxesQuery(kitId);
  const [addBox, { isLoading: isAdding }] = useAddKitBoxMutation();
  const [updateBox, { isLoading: isUpdating }] = useUpdateKitBoxMutation();
  const [deleteBox] = useDeleteKitBoxMutation();

  const showModal = (box?: KitBox) => {
    if (box) {
      setEditingBox(box);
      form.setFieldsValue(box);
    } else {
      setEditingBox(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setEditingBox(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingBox) {
        await updateBox({
          kitId,
          boxId: editingBox.id,
          data: values,
        }).unwrap();
        message.success('Box updated successfully');
      } else {
        await addBox({
          kitId,
          data: values,
        }).unwrap();
        message.success('Box added successfully');
      }

      handleCancel();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (boxId: number) => {
    try {
      await deleteBox({ kitId, boxId }).unwrap();
      message.success('Box deleted successfully');
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to delete box');
    }
  };

  const columns: ColumnsType<KitBox> = [
    {
      title: 'Box Number',
      dataIndex: 'box_number',
      key: 'box_number',
      sorter: (a, b) => a.box_number.localeCompare(b.box_number),
    },
    {
      title: 'Type',
      dataIndex: 'box_type',
      key: 'box_type',
      render: (type: BoxType) => type.toUpperCase(),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Items',
      dataIndex: 'item_count',
      key: 'item_count',
      sorter: (a, b) => (a.item_count || 0) - (b.item_count || 0),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: KitBox) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete box?"
            description="Are you sure you want to delete this box? All items must be removed first."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<Title level={4}>Box Configuration</Title>}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
          Add Box
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={boxes}
        rowKey="id"
        loading={isLoading}
        pagination={false}
      />

      <Modal
        title={editingBox ? 'Edit Box' : 'Add Box'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        confirmLoading={isAdding || isUpdating}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="box_number"
            label="Box Number"
            rules={[{ required: true, message: 'Please enter box number' }]}
          >
            <Input placeholder="e.g., Box1, Loose, Floor" />
          </Form.Item>
          <Form.Item
            name="box_type"
            label="Box Type"
            rules={[{ required: true, message: 'Please select box type' }]}
          >
            <Select placeholder="Select box type">
              <Option value="expendable">Expendable</Option>
              <Option value="tooling">Tooling</Option>
              <Option value="consumable">Consumable</Option>
              <Option value="loose">Loose</Option>
              <Option value="floor">Floor</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Brief description of box contents" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default KitBoxManager;
