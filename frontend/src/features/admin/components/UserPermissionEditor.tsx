import { useState, useMemo } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Spin,
  Alert,
  Tag,
  Typography,
  message,
  Popconfirm,
  Form,
  Select,
  Input,
  DatePicker,
  Radio,
  Tabs,
  Tooltip,
  Divider,
} from 'antd';
import type { TableProps } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  useGetPermissionCategoriesQuery,
  useGetUserPermissionsQuery,
  useAddUserPermissionMutation,
  useRemoveUserPermissionMutation,
} from '../services/permissionsApi';
import type { Permission, UserPermission, PermissionCategory } from '@features/users/types';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

interface UserPermissionEditorProps {
  userId: number | null;
  userName: string;
  isAdmin?: boolean;
  open: boolean;
  onClose: () => void;
}

export const UserPermissionEditor: React.FC<UserPermissionEditorProps> = ({
  userId,
  userName,
  isAdmin = false,
  open,
  onClose,
}) => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: categories, isLoading: categoriesLoading } = useGetPermissionCategoriesQuery();
  const {
    data: userPermissions,
    isLoading: permissionsLoading,
    refetch,
  } = useGetUserPermissionsQuery(userId || 0, { skip: !userId });
  const [addPermission, { isLoading: isAdding }] = useAddUserPermissionMutation();
  const [removePermission, { isLoading: isRemoving }] = useRemoveUserPermissionMutation();

  // Permissions grouped by category for select dropdown
  const permissionOptions = useMemo(() => {
    if (!categories) return [];
    return categories.map((category: PermissionCategory) => ({
      label: category.name,
      options: category.permissions.map((perm: Permission) => ({
        label: `${perm.name} - ${perm.description}`,
        value: perm.id,
      })),
    }));
  }, [categories]);

  const handleAddPermission = async () => {
    if (!userId) return;

    try {
      const values = await form.validateFields();
      await addPermission({
        user_id: userId,
        permission_id: values.permission_id,
        grant_type: values.grant_type,
        reason: values.reason,
        expires_at: values.expires_at ? values.expires_at.toISOString() : undefined,
      }).unwrap();
      message.success(`Permission ${values.grant_type === 'grant' ? 'granted' : 'denied'} successfully`);
      setAddModalOpen(false);
      form.resetFields();
      refetch();
    } catch {
      message.error('Failed to update permission');
    }
  };

  const handleRemovePermission = async (permissionId: number) => {
    if (!userId) return;

    try {
      await removePermission({
        user_id: userId,
        permission_id: permissionId,
      }).unwrap();
      message.success('Permission override removed');
      refetch();
    } catch {
      message.error('Failed to remove permission');
    }
  };

  const userSpecificColumns: TableProps<UserPermission>['columns'] = [
    {
      title: 'Permission',
      dataIndex: 'permission_name',
      key: 'permission_name',
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {record.permission_description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.permission_description}
            </Text>
          )}
        </Space>
      ),
      sorter: (a, b) => a.permission_name.localeCompare(b.permission_name),
    },
    {
      title: 'Category',
      dataIndex: 'permission_category',
      key: 'permission_category',
      render: (category: string) => <Tag>{category}</Tag>,
    },
    {
      title: 'Type',
      dataIndex: 'grant_type',
      key: 'grant_type',
      render: (type: 'grant' | 'deny') =>
        type === 'grant' ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>
            Grant
          </Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            Deny
          </Tag>
        ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) =>
        record.is_active ? (
          <Tag color="green">Active</Tag>
        ) : (
          <Tag color="red">Expired</Tag>
        ),
    },
    {
      title: 'Expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (date: string | null) =>
        date ? (
          <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
            {dayjs(date).format('MMM D, YYYY')}
          </Tooltip>
        ) : (
          <Text type="secondary">Never</Text>
        ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string | null) =>
        reason ? (
          <Tooltip title={reason}>
            <Text ellipsis style={{ maxWidth: 150 }}>
              {reason}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="Remove this permission override?"
          description="The user's permission will revert to their role-based permissions."
          onConfirm={() => handleRemovePermission(record.permission_id)}
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} loading={isRemoving} />
        </Popconfirm>
      ),
    },
  ];

  const isLoading = categoriesLoading || permissionsLoading;

  return (
    <>
      <Modal
        title={`Manage Permissions: ${userName}`}
        open={open}
        onCancel={onClose}
        width={900}
        footer={[
          <Button key="close" onClick={onClose}>
            Close
          </Button>,
        ]}
      >
        {isAdmin ? (
          <Alert
            message="Administrator Account"
            description="This user is an administrator and automatically has all permissions. User-specific permission overrides cannot be applied to admin accounts."
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />
        ) : isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Tabs
            defaultActiveKey="specific"
            items={[
              {
                key: 'specific',
                label: 'User-Specific Overrides',
                children: (
                  <>
                    <Alert
                      message="User-Specific Permission Overrides"
                      description="These permissions override the user's role-based permissions. Grants add permissions not available from roles. Denies remove permissions even if granted by roles."
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />

                    <div style={{ marginBottom: 16 }}>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setAddModalOpen(true)}
                      >
                        Add Permission Override
                      </Button>
                    </div>

                    <Table
                      columns={userSpecificColumns}
                      dataSource={userPermissions?.user_specific_permissions || []}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      locale={{
                        emptyText: 'No user-specific permission overrides configured',
                      }}
                    />
                  </>
                ),
              },
              {
                key: 'effective',
                label: 'Effective Permissions',
                children: (
                  <>
                    <Alert
                      message="Effective Permissions"
                      description="These are all permissions the user currently has, combining role-based and user-specific overrides."
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />

                    <Space wrap style={{ marginBottom: 16 }}>
                      <Text strong>
                        Total: {userPermissions?.effective_permissions?.length || 0} permissions
                      </Text>
                    </Space>

                    <div
                      style={{
                        maxHeight: 300,
                        overflow: 'auto',
                        border: '1px solid #d9d9d9',
                        borderRadius: 4,
                        padding: 12,
                      }}
                    >
                      <Space wrap>
                        {userPermissions?.effective_permissions?.map((perm) => (
                          <Tag key={perm} color="blue">
                            {perm}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  </>
                ),
              },
              {
                key: 'roles',
                label: 'Role-Based Permissions',
                children: (
                  <>
                    <Alert
                      message="Role-Based Permissions"
                      description="These permissions come from the user's assigned roles."
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />

                    <Space style={{ marginBottom: 16 }}>
                      <Text strong>Assigned Roles:</Text>
                      {userPermissions?.roles?.map((role) => (
                        <Tag key={role.id} color={role.is_system_role ? 'purple' : 'default'}>
                          {role.name}
                        </Tag>
                      ))}
                    </Space>

                    <Divider />

                    <Text strong style={{ display: 'block', marginBottom: 8 }}>
                      Permissions from Roles ({userPermissions?.role_permissions?.length || 0}):
                    </Text>

                    <div
                      style={{
                        maxHeight: 300,
                        overflow: 'auto',
                        border: '1px solid #d9d9d9',
                        borderRadius: 4,
                        padding: 12,
                      }}
                    >
                      <Space wrap>
                        {userPermissions?.role_permissions?.map((perm) => (
                          <Tag key={perm} color="green">
                            {perm}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  </>
                ),
              },
            ]}
          />
        )}
      </Modal>

      {/* Add Permission Modal */}
      <Modal
        title="Add Permission Override"
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false);
          form.resetFields();
        }}
        onOk={handleAddPermission}
        confirmLoading={isAdding}
      >
        <Form form={form} layout="vertical" initialValues={{ grant_type: 'grant' }}>
          <Form.Item
            name="permission_id"
            label="Permission"
            rules={[{ required: true, message: 'Please select a permission' }]}
          >
            <Select
              showSearch
              placeholder="Select a permission"
              optionFilterProp="label"
              options={permissionOptions}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="grant_type"
            label="Override Type"
            rules={[{ required: true, message: 'Please select grant or deny' }]}
          >
            <Radio.Group>
              <Radio.Button value="grant">
                <CheckCircleOutlined /> Grant
              </Radio.Button>
              <Radio.Button value="deny">
                <CloseCircleOutlined /> Deny
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="reason" label="Reason (Optional)">
            <TextArea rows={2} placeholder="Why is this permission being granted/denied?" />
          </Form.Item>

          <Form.Item name="expires_at" label="Expires At (Optional)">
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="Leave empty for no expiration"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default UserPermissionEditor;
