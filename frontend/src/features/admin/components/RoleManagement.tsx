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
  message,
  Alert,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
} from '@ant-design/icons';
import {
  useGetRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} from '../services/adminApi';
import type { UserRole } from '../types';

const { TextArea } = Input;
const { Text } = Typography;

export const RoleManagement = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [form] = Form.useForm();

  const { data: roles = [], isLoading, error } = useGetRolesQuery();
  const [createRole, { isLoading: isCreating }] = useCreateRoleMutation();
  const [updateRole, { isLoading: isUpdating }] = useUpdateRoleMutation();
  const [deleteRole, { isLoading: isDeleting }] = useDeleteRoleMutation();

  const handleCreate = () => {
    setEditingRole(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (role: UserRole) => {
    setEditingRole(role);
    form.setFieldsValue(role);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteRole(id).unwrap();
      message.success('Role deleted successfully');
    } catch (error) {
      message.error('Failed to delete role');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingRole) {
        await updateRole({ id: editingRole.id, ...values }).unwrap();
        message.success('Role updated successfully');
      } else {
        await createRole(values).unwrap();
        message.success('Role created successfully');
      }
      setModalOpen(false);
      form.resetFields();
    } catch (error) {
      message.error(`Failed to ${editingRole ? 'update' : 'create'} role`);
    }
  };

  const columns: TableProps<UserRole>['columns'] = [
    {
      title: 'Role Name',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record) => (
        <Space>
          <Text strong>{value}</Text>
          {record.is_system_role && (
            <Tag color="blue" icon={<LockOutlined />}>
              System
            </Tag>
          )}
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (value: string | null) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={record.is_system_role ? 'System roles cannot be edited' : 'Edit'}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              disabled={record.is_system_role}
            />
          </Tooltip>
          <Popconfirm
            title="Delete role?"
            description="Users with this role will lose associated permissions."
            onConfirm={() => handleDelete(record.id)}
            okButtonProps={{ danger: true }}
            disabled={record.is_system_role}
          >
            <Tooltip title={record.is_system_role ? 'System roles cannot be deleted' : 'Delete'}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={record.is_system_role}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message="Role Management"
        description="Create and manage user roles. Assign roles to users in the User Management tab to control access and permissions."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Create Role
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Failed to load roles"
          description="Please try again later."
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={roles}
        rowKey="id"
        loading={isLoading || isDeleting}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `${total} roles`,
        }}
      />

      <Modal
        title={editingRole ? 'Edit Role' : 'Create Role'}
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
            label="Role Name"
            rules={[
              { required: true, message: 'Please enter role name' },
              { pattern: /^[a-zA-Z0-9_\s-]+$/, message: 'Only letters, numbers, spaces, hyphens, and underscores allowed' },
            ]}
          >
            <Input placeholder="e.g., Manager, Supervisor, Viewer" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Optional description of role permissions and responsibilities" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
