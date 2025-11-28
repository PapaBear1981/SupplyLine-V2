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
  Select,
  Switch,
  DatePicker,
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
  WarningOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetAnnouncementsQuery,
  useCreateAnnouncementMutation,
  useUpdateAnnouncementMutation,
  useDeleteAnnouncementMutation,
  useGetDepartmentsQuery,
} from '../services/adminApi';
import type { Announcement } from '../types';

const { TextArea } = Input;
const { Text } = Typography;

const priorityConfig = {
  low: { color: 'default', icon: null, label: 'Low' },
  medium: { color: 'blue', icon: null, label: 'Medium' },
  high: { color: 'orange', icon: <WarningOutlined />, label: 'High' },
  urgent: { color: 'red', icon: <ExclamationCircleOutlined />, label: 'Urgent' },
};

export const AnnouncementManagement = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [form] = Form.useForm();

  const { data: announcements = [], isLoading, error } = useGetAnnouncementsQuery();
  const { data: departments = [] } = useGetDepartmentsQuery();
  const [createAnnouncement, { isLoading: isCreating }] = useCreateAnnouncementMutation();
  const [updateAnnouncement, { isLoading: isUpdating }] = useUpdateAnnouncementMutation();
  const [deleteAnnouncement, { isLoading: isDeleting }] = useDeleteAnnouncementMutation();

  const handleCreate = () => {
    setEditingAnnouncement(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, priority: 'medium' });
    setModalOpen(true);
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    form.setFieldsValue({
      ...announcement,
      expires_at: announcement.expires_at ? dayjs(announcement.expires_at) : null,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAnnouncement(id).unwrap();
      message.success('Announcement deleted successfully');
    } catch (error) {
      message.error('Failed to delete announcement');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        expires_at: values.expires_at ? values.expires_at.toISOString() : null,
      };

      if (editingAnnouncement) {
        await updateAnnouncement({ id: editingAnnouncement.id, ...payload }).unwrap();
        message.success('Announcement updated successfully');
      } else {
        await createAnnouncement(payload).unwrap();
        message.success('Announcement created successfully');
      }
      setModalOpen(false);
      form.resetFields();
    } catch (error) {
      message.error(`Failed to ${editingAnnouncement ? 'update' : 'create'} announcement`);
    }
  };

  const columns: TableProps<Announcement>['columns'] = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (value: string) => <Text strong>{value}</Text>,
      sorter: (a, b) => a.title.localeCompare(b.title),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (value: string) => (
        <Tooltip title={value}>
          <Text type="secondary">{value}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (value: 'low' | 'medium' | 'high' | 'urgent') => {
        const config = priorityConfig[value];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
      filters: [
        { text: 'Low', value: 'low' },
        { text: 'Medium', value: 'medium' },
        { text: 'High', value: 'high' },
        { text: 'Urgent', value: 'urgent' },
      ],
      onFilter: (value, record) => record.priority === value,
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
      title: 'Expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (value: string | null) =>
        value ? (
          <Text type={dayjs(value).isBefore(dayjs()) ? 'danger' : undefined}>
            {dayjs(value).format('MMM D, YYYY')}
          </Text>
        ) : (
          <Text type="secondary">Never</Text>
        ),
      sorter: (a, b) => {
        const aTime = a.expires_at ? dayjs(a.expires_at).valueOf() : Infinity;
        const bTime = b.expires_at ? dayjs(b.expires_at).valueOf() : Infinity;
        return aTime - bTime;
      },
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => dayjs(value).format('MMM D, YYYY'),
      sorter: (a, b) => dayjs(a.created_at).valueOf() - dayjs(b.created_at).valueOf(),
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
            title="Delete announcement?"
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
          Create Announcement
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Failed to load announcements"
          description="Please try again later."
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={announcements}
        rowKey="id"
        loading={isLoading || isDeleting}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `${total} announcements`,
        }}
      />

      <Modal
        title={editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={isCreating || isUpdating}
        width={600}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter announcement title' }]}
          >
            <Input placeholder="Announcement title" />
          </Form.Item>
          <Form.Item
            name="message"
            label="Message"
            rules={[{ required: true, message: 'Please enter announcement message' }]}
          >
            <TextArea rows={4} placeholder="Announcement message" />
          </Form.Item>
          <Form.Item
            name="priority"
            label="Priority"
            rules={[{ required: true, message: 'Please select priority' }]}
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
          <Form.Item name="target_departments" label="Target Departments">
            <Select
              mode="multiple"
              placeholder="All departments (leave empty for everyone)"
              options={departments.map((dept) => ({
                label: dept.name,
                value: dept.name,
              }))}
              allowClear
            />
          </Form.Item>
          <Form.Item name="expires_at" label="Expiration Date">
            <DatePicker
              style={{ width: '100%' }}
              placeholder="No expiration"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
