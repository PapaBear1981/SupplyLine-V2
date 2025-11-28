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
  Statistic,
  Card,
  Row,
  Col,
} from 'antd';
import type { TableProps } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ApartmentOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  useGetAircraftTypesQuery,
  useCreateAircraftTypeMutation,
  useUpdateAircraftTypeMutation,
  useDeactivateAircraftTypeMutation,
} from '../../kits/services/kitsApi';
import type { AircraftType } from '../../kits/types';

const { TextArea } = Input;
const { Text } = Typography;

export const AircraftTypeManagement = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AircraftType | null>(null);
  const [form] = Form.useForm();

  const { data: aircraftTypes = [], isLoading, error } = useGetAircraftTypesQuery({ include_inactive: true });
  const [createAircraftType, { isLoading: isCreating }] = useCreateAircraftTypeMutation();
  const [updateAircraftType, { isLoading: isUpdating }] = useUpdateAircraftTypeMutation();
  const [deactivateAircraftType, { isLoading: isDeleting }] = useDeactivateAircraftTypeMutation();

  const handleCreate = () => {
    setEditingType(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setModalOpen(true);
  };

  const handleEdit = (aircraftType: AircraftType) => {
    setEditingType(aircraftType);
    form.setFieldsValue(aircraftType);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deactivateAircraftType(id).unwrap();
      message.success('Aircraft type deactivated successfully');
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to deactivate aircraft type');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingType) {
        await updateAircraftType({
          id: editingType.id,
          data: {
            name: values.name,
            description: values.description,
            is_active: values.is_active,
          },
        }).unwrap();
        message.success('Aircraft type updated successfully');
      } else {
        await createAircraftType({
          name: values.name,
          description: values.description,
        }).unwrap();
        message.success('Aircraft type created successfully');
      }
      setModalOpen(false);
      form.resetFields();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || `Failed to ${editingType ? 'update' : 'create'} aircraft type`);
    }
  };

  const activeCount = aircraftTypes.filter((type) => type.is_active).length;
  const totalKits = aircraftTypes.reduce((sum, type) => sum + (type.kit_count || 0), 0);

  const columns: TableProps<AircraftType>['columns'] = [
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
      render: (value: string | null | undefined) => value || <Text type="secondary">—</Text>,
    },
    {
      title: 'Kits',
      dataIndex: 'kit_count',
      key: 'kit_count',
      render: (value: number | undefined) => (
        <Tag color="blue">
          {value || 0} {value === 1 ? 'kit' : 'kits'}
        </Tag>
      ),
      sorter: (a, b) => (a.kit_count || 0) - (b.kit_count || 0),
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
          {record.is_active && (
            <Popconfirm
              title="Deactivate aircraft type?"
              description={
                record.kit_count && record.kit_count > 0
                  ? `This aircraft type has ${record.kit_count} kit(s). Deactivating will hide it from new kit creation.`
                  : 'This action will deactivate the aircraft type.'
              }
              onConfirm={() => handleDelete(record.id)}
              okButtonProps={{ danger: true }}
              icon={<WarningOutlined style={{ color: 'orange' }} />}
            >
              <Tooltip title="Deactivate">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Aircraft Types"
              value={aircraftTypes.length}
              prefix={<ApartmentOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Active Types"
              value={activeCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Kits"
              value={totalKits}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Add Aircraft Type
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Failed to load aircraft types"
          description="Please try again later."
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={aircraftTypes}
        rowKey="id"
        loading={isLoading || isDeleting}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `${total} aircraft types`,
        }}
      />

      <Modal
        title={editingType ? 'Edit Aircraft Type' : 'Create Aircraft Type'}
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
            label="Aircraft Type Name"
            rules={[
              { required: true, message: 'Please enter aircraft type name' },
              { min: 2, message: 'Name must be at least 2 characters' },
            ]}
          >
            <Input placeholder="e.g., Boeing 737, Airbus A320, Cessna 172" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Optional description or notes about this aircraft type" />
          </Form.Item>
          {editingType && (
            <Form.Item name="is_active" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};
