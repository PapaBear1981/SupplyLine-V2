import { useState } from 'react';
import {
  Button,
  Table,
  Space,
  Tag,
  Tooltip,
  Popconfirm,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Alert,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
} from '../services/adminApi';
import type { Department } from '../types';

const { TextArea } = Input;
const { Text } = Typography;

export const DepartmentManagement = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [form] = Form.useForm();

  const { data: departments = [], isLoading, error } = useGetDepartmentsQuery();
  const [createDepartment, { isLoading: isCreating }] = useCreateDepartmentMutation();
  const [updateDepartment, { isLoading: isUpdating }] = useUpdateDepartmentMutation();
  const [deleteDepartment, { isLoading: isDeleting }] = useDeleteDepartmentMutation();

  const handleCreate = () => {
    setEditingDepartment(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setModalOpen(true);
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    form.setFieldsValue(department);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDepartment(id).unwrap();
      message.success('Department deleted successfully');
    } catch {
      message.error('Failed to delete department');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingDepartment) {
        await updateDepartment({ id: editingDepartment.id, ...values }).unwrap();
        message.success('Department updated successfully');
      } else {
        await createDepartment(values).unwrap();
        message.success('Department created successfully');
      }
      setModalOpen(false);
      form.resetFields();
    } catch {
      message.error(`Failed to ${editingDepartment ? 'update' : 'create'} department`);
    }
  };

  const columns: TableProps<Department>['columns'] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (value: string) => <Text strong>{value}</Text>,
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (value: string | null) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'red'} icon={value ? <CheckCircleOutlined /> : <StopOutlined />}>
          {value ? 'Active' : 'Inactive'}
        </Tag>
      ),
      filters: [
        { text: 'Active', value: true },
        { text: 'Inactive', value: false },
      ],
      onFilter: (value, record) => record.is_active === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete department?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Add Department
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Failed to load departments"
          description="Please try again later."
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={departments}
        rowKey="id"
        loading={isLoading || isDeleting}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `${total} departments`,
        }}
      />

      <Modal
        title={editingDepartment ? 'Edit Department' : 'Create Department'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={isCreating || isUpdating}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Department Name"
            rules={[{ required: true, message: 'Please enter department name' }]}
          >
            <Input placeholder="e.g., Engineering, Sales, Support" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
