import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  PlusOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useGetUsersQuery } from '@features/users/services/usersApi';
import {
  useCreateOnCallScheduleMutation,
  useDeleteOnCallScheduleMutation,
  useGetAdminOnCallScheduleQuery,
  useUpdateOnCallScheduleMutation,
  type OnCallRole,
  type OnCallScheduleEntry,
} from '../services/oncallScheduleApi';

const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

type RoleFilter = 'all' | OnCallRole;

interface ScheduleFormValues {
  role: OnCallRole;
  user_id: number;
  range: [Dayjs, Dayjs];
  notes?: string;
}

const ROLE_META: Record<OnCallRole, { label: string; color: string; icon: React.ReactNode }> = {
  materials: { label: 'Materials', color: '#1890ff', icon: <InboxOutlined /> },
  maintenance: { label: 'Maintenance', color: '#fa8c16', icon: <ToolOutlined /> },
};

export const OnCallScheduling = () => {
  const { token } = theme.useToken();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [windowDays, setWindowDays] = useState<number>(90);
  const [editing, setEditing] = useState<OnCallScheduleEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm<ScheduleFormValues>();

  const start = dayjs().startOf('day');
  const end = start.add(windowDays, 'day');

  const queryArgs = {
    start: start.format('YYYY-MM-DD'),
    end: end.format('YYYY-MM-DD'),
    ...(roleFilter !== 'all' ? { role: roleFilter as OnCallRole } : {}),
  };

  const { data: schedules = [], isLoading, isFetching } =
    useGetAdminOnCallScheduleQuery(queryArgs);
  const { data: users = [], isLoading: usersLoading } = useGetUsersQuery();
  const [createSchedule, { isLoading: isCreating }] = useCreateOnCallScheduleMutation();
  const [updateSchedule, { isLoading: isUpdating }] = useUpdateOnCallScheduleMutation();
  const [deleteSchedule] = useDeleteOnCallScheduleMutation();

  const userOptions = useMemo(
    () =>
      users
        .filter((u) => u.is_active)
        .map((u) => ({
          value: u.id,
          label: `${u.name} (#${u.employee_number})${u.department ? ` · ${u.department}` : ''}`,
          searchText: `${u.name} ${u.employee_number} ${u.department ?? ''}`.toLowerCase(),
        })),
    [users]
  );

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      role: 'materials',
      range: [dayjs().startOf('day'), dayjs().add(7, 'day').startOf('day')],
    });
    setIsModalOpen(true);
  };

  const openEdit = (entry: OnCallScheduleEntry) => {
    setEditing(entry);
    form.setFieldsValue({
      role: entry.role,
      user_id: entry.user?.id as number,
      range: [dayjs(entry.start_date), dayjs(entry.end_date)],
      notes: entry.notes ?? undefined,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSubmit = async (values: ScheduleFormValues, allowOverlap = false) => {
    const [startDate, endDate] = values.range;
    const payload = {
      role: values.role,
      user_id: values.user_id,
      start_date: startDate.format('YYYY-MM-DD'),
      end_date: endDate.format('YYYY-MM-DD'),
      notes: values.notes?.trim() || null,
      allow_overlap: allowOverlap,
    };

    try {
      if (editing) {
        await updateSchedule({ id: editing.id, ...payload }).unwrap();
        message.success('Schedule updated');
      } else {
        await createSchedule(payload).unwrap();
        message.success('Schedule added');
      }
      closeModal();
    } catch (err: unknown) {
      const apiError = err as { status?: number; data?: { error?: string; conflict?: OnCallScheduleEntry } };
      if (apiError.status === 409 && apiError.data?.conflict) {
        const conflict = apiError.data.conflict;
        Modal.confirm({
          title: 'Schedule conflict',
          content: (
            <div>
              <Paragraph>
                An overlapping schedule already exists for{' '}
                <Tag color={ROLE_META[values.role].color}>{ROLE_META[values.role].label}</Tag>:
              </Paragraph>
              <Paragraph>
                <Text strong>{conflict.user?.name ?? 'Unassigned'}</Text> from{' '}
                {dayjs(conflict.start_date).format('MMM D, YYYY')} to{' '}
                {dayjs(conflict.end_date).format('MMM D, YYYY')}
              </Paragraph>
              <Paragraph>Save anyway?</Paragraph>
            </div>
          ),
          okText: 'Save anyway',
          cancelText: 'Cancel',
          onOk: () => handleSubmit(values, true),
        });
      } else {
        message.error(apiError.data?.error || 'Failed to save schedule');
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id).unwrap();
      message.success('Schedule removed');
    } catch (err: unknown) {
      const apiError = err as { data?: { error?: string } };
      message.error(apiError.data?.error || 'Failed to delete schedule');
    }
  };

  const today = dayjs().startOf('day');

  const columns: ColumnsType<OnCallScheduleEntry> = [
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role: OnCallRole) => (
        <Tag color={ROLE_META[role].color} icon={ROLE_META[role].icon}>
          {ROLE_META[role].label}
        </Tag>
      ),
      filters: [
        { text: 'Materials', value: 'materials' },
        { text: 'Maintenance', value: 'maintenance' },
      ],
      onFilter: (value, record) => record.role === value,
    },
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      render: (_, record) =>
        record.user ? (
          <Space>
            <Avatar
              size="small"
              src={record.user.avatar || undefined}
              icon={!record.user.avatar && <UserOutlined />}
            />
            <div>
              <div style={{ fontWeight: 500 }}>{record.user.name}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                #{record.user.employee_number}
                {record.user.department ? ` · ${record.user.department}` : ''}
              </Text>
            </div>
          </Space>
        ) : (
          <Text type="secondary">Unassigned</Text>
        ),
    },
    {
      title: 'Period',
      key: 'period',
      width: 280,
      render: (_, record) => {
        const sd = dayjs(record.start_date);
        const ed = dayjs(record.end_date);
        const days = ed.diff(sd, 'day') + 1;
        const isCurrent = today.isSame(sd) || today.isSame(ed) || (today.isAfter(sd) && today.isBefore(ed));
        const isPast = ed.isBefore(today);
        return (
          <div>
            <div>
              {sd.format('MMM D, YYYY')} – {ed.format('MMM D, YYYY')}
            </div>
            <Space size={4} style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {days} day{days === 1 ? '' : 's'}
              </Text>
              {isCurrent && <Tag color="green">Active now</Tag>}
              {isPast && <Tag>Past</Tag>}
            </Space>
          </div>
        );
      },
      sorter: (a, b) => dayjs(a.start_date).valueOf() - dayjs(b.start_date).valueOf(),
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (notes: string | null) => notes || <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Remove this schedule?"
            okText="Remove"
            okType="danger"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <CalendarOutlined style={{ marginRight: 8 }} />
          On-Call Schedule
        </Title>
        <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
          Assign on-call coverage weeks or months in advance. All authenticated users can view the schedule
          to see who will be on call.
        </Paragraph>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={16}>
          <Card size="small" bordered>
            <Space wrap>
              <Text strong>Role:</Text>
              <Segmented
                value={roleFilter}
                onChange={(v) => setRoleFilter(v as RoleFilter)}
                options={[
                  { label: 'All', value: 'all' },
                  { label: 'Materials', value: 'materials' },
                  { label: 'Maintenance', value: 'maintenance' },
                ]}
              />
              <Text strong style={{ marginLeft: 12 }}>Window:</Text>
              <Segmented
                value={windowDays}
                onChange={(v) => setWindowDays(Number(v))}
                options={[
                  { label: '30 days', value: 30 },
                  { label: '90 days', value: 90 },
                  { label: '6 months', value: 180 },
                  { label: '1 year', value: 365 },
                ]}
              />
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8} style={{ textAlign: 'right' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Schedule Entry
          </Button>
        </Col>
      </Row>

      {schedules.length === 0 && !isLoading ? (
        <Alert
          type="info"
          showIcon
          message="No schedule entries in this window"
          description="Click 'Add Schedule Entry' to assign someone to an on-call rotation."
          style={{ marginBottom: 16 }}
        />
      ) : null}

      <Card bordered={false} style={{ background: token.colorBgContainer }}>
        <Table
          rowKey="id"
          loading={isLoading || isFetching}
          dataSource={schedules}
          columns={columns}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          size="middle"
        />
      </Card>

      <Modal
        title={editing ? 'Edit Schedule Entry' : 'Add Schedule Entry'}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={isCreating || isUpdating}
        okText={editing ? 'Save Changes' : 'Add Entry'}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => handleSubmit(values, false)}
          initialValues={{ role: 'materials' }}
        >
          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true, message: 'Select a role' }]}
          >
            <Select
              options={[
                { value: 'materials', label: 'Materials' },
                { value: 'maintenance', label: 'Maintenance' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="User"
            name="user_id"
            rules={[{ required: true, message: 'Select a user' }]}
          >
            <Select
              showSearch
              placeholder="Select a user"
              loading={usersLoading}
              options={userOptions}
              filterOption={(input, option) =>
                (option?.searchText as string | undefined)?.includes(input.toLowerCase()) ?? false
              }
            />
          </Form.Item>

          <Form.Item
            label="Date Range"
            name="range"
            rules={[{ required: true, message: 'Pick start and end dates' }]}
          >
            <RangePicker style={{ width: '100%' }} format="MMM D, YYYY" />
          </Form.Item>

          <Form.Item label="Notes" name="notes">
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              placeholder="Optional notes (e.g. coverage reason, special instructions)"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
