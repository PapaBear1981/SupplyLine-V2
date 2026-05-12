import { useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Modal, Row, Space, Table, Tag, Typography,
  Form, Input, Select, Drawer, message, Popconfirm, InputNumber, Switch,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

// Narrow shape of an RTK Query error payload — used to surface server-supplied
// error messages without resorting to `any` in catch blocks.
interface ApiError {
  data?: { error?: string; message?: string };
}
function apiErrorMessage(e: unknown, fallback: string): string {
  const err = e as ApiError | undefined;
  return err?.data?.error || err?.data?.message || fallback;
}
import {
  useListMasterKitsQuery,
  useGetMasterKitQuery,
  useCreateMasterKitMutation,
  useDeleteMasterKitMutation,
  useCreateMasterKitBoxMutation,
  useDeleteMasterKitBoxMutation,
  useCreateMasterKitEntryMutation,
  useDeleteMasterKitEntryMutation,
} from '../services/masterKitsApi';
import { useGetAircraftTypesQuery } from '../../kits/services/kitsApi';
import type { MasterKit, MasterKitBox, MasterKitEntry, MasterKitEntryType } from '../../kits/types';

const { Title, Text } = Typography;

/**
 * Admin page for managing master kit lists.
 *
 * Lists one row per master, with a drawer-based editor for boxes and entries.
 * Mirrors the chemical-parts admin pattern: admins can add/edit/delete entries
 * and the backend handles soft-unlinking kit rows that were inheriting them.
 */
export default function MasterKitsAdmin() {
  const { data: list, isLoading, error } = useListMasterKitsQuery();
  const { data: aircraftTypes } = useGetAircraftTypesQuery({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editorMasterId, setEditorMasterId] = useState<number | null>(null);

  const [createMaster, { isLoading: creating }] = useCreateMasterKitMutation();
  const [deleteMaster] = useDeleteMasterKitMutation();
  const [form] = Form.useForm();

  const handleCreate = async () => {
    const values = await form.validateFields();
    try {
      await createMaster(values).unwrap();
      message.success('Master kit created');
      setCreateOpen(false);
      form.resetFields();
    } catch (e: unknown) {
      message.error(apiErrorMessage(e, 'Failed to create master kit'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMaster(id).unwrap();
      message.success('Master kit deactivated');
    } catch {
      message.error('Failed to delete master kit');
    }
  };

  const masters = list?.master_kits || [];

  const columns: ColumnsType<MasterKit> = [
    {
      title: 'Aircraft Type',
      dataIndex: 'aircraft_type_name',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Boxes', dataIndex: 'box_count', align: 'right' },
    { title: 'Entries', dataIndex: 'entry_count', align: 'right' },
    {
      title: 'Status',
      dataIndex: 'is_active',
      render: (v) => (v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>),
    },
    {
      title: 'Actions',
      render: (_v, row) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => setEditorMasterId(row.id)}
            data-testid={`master-kit-edit-${row.id}`}
          >
            Edit
          </Button>
          <Popconfirm title="Deactivate this master?" onConfirm={() => handleDelete(row.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}
              data-testid={`master-kit-delete-${row.id}`}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div data-testid="master-kits-admin">
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Master Kit Lists</Title>
          <Text type="secondary">
            Canonical kit definitions per aircraft type. Edits propagate to linked kits.
          </Text>
        </Col>
        <Col>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
            data-testid="master-kits-create-button"
          >
            New Master Kit
          </Button>
        </Col>
      </Row>

      {error && (
        <Alert type="error" message="Failed to load master kits"
          description={apiErrorMessage(error, 'Unknown error')} closable
          style={{ marginBottom: 12 }} />
      )}

      <Card>
        <Table<MasterKit>
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={masters}
          pagination={false}
          locale={{ emptyText: <Empty description="No master kits yet" /> }}
        />
      </Card>

      <Modal
        title="Create master kit"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="Create"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="aircraft_type_id"
            label="Aircraft type"
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Pick aircraft type"
              data-testid="master-kit-aircraft-type-select"
              options={(aircraftTypes || []).map((at) => ({ label: at.name, value: at.id }))}
            />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Q400 Master Kit" data-testid="master-kit-name-input" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {editorMasterId !== null && (
        <MasterKitEditor
          masterId={editorMasterId}
          onClose={() => setEditorMasterId(null)}
        />
      )}
    </div>
  );
}


// ─── Editor drawer ───────────────────────────────────────────────────────────


interface EditorProps {
  masterId: number;
  onClose: () => void;
}

function MasterKitEditor({ masterId, onClose }: EditorProps) {
  const { data: master, refetch } = useGetMasterKitQuery(masterId);
  const [boxOpen, setBoxOpen] = useState(false);
  const [entryBox, setEntryBox] = useState<MasterKitBox | null>(null);
  const [createBox] = useCreateMasterKitBoxMutation();
  const [deleteBox] = useDeleteMasterKitBoxMutation();
  const [createEntry] = useCreateMasterKitEntryMutation();
  const [deleteEntry] = useDeleteMasterKitEntryMutation();
  const [boxForm] = Form.useForm();
  const [entryForm] = Form.useForm();

  const handleAddBox = async () => {
    const v = await boxForm.validateFields();
    try {
      await createBox({ master_kit_id: masterId, data: v }).unwrap();
      message.success('Box added');
      setBoxOpen(false);
      boxForm.resetFields();
      refetch();
    } catch (e: unknown) {
      message.error(apiErrorMessage(e, 'Failed to add box'));
    }
  };

  const handleDeleteBox = async (boxId: number) => {
    try {
      await deleteBox({ id: boxId, master_kit_id: masterId }).unwrap();
      message.success('Box deleted');
      refetch();
    } catch {
      message.error('Failed to delete box');
    }
  };

  const handleAddEntry = async () => {
    if (!entryBox) return;
    const v = await entryForm.validateFields();
    try {
      await createEntry({
        master_kit_id: masterId,
        data: { ...v, master_box_id: entryBox.id },
      }).unwrap();
      message.success('Entry added');
      setEntryBox(null);
      entryForm.resetFields();
      refetch();
    } catch (e: unknown) {
      message.error(apiErrorMessage(e, 'Failed to add entry'));
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    try {
      await deleteEntry({ id: entryId, master_kit_id: masterId }).unwrap();
      message.success('Entry deleted (kit rows soft-unlinked)');
      refetch();
    } catch {
      message.error('Failed to delete entry');
    }
  };

  return (
    <Drawer
      title={master ? `Edit: ${master.name}` : 'Loading…'}
      open
      onClose={onClose}
      width={720}
      data-testid="master-kit-editor"
    >
      {master && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Row justify="space-between" align="middle">
            <Col>
              <Text strong>{master.aircraft_type_name}</Text>{' '}
              <Text type="secondary">{master.description}</Text>
            </Col>
            <Col>
              <Button icon={<AppstoreAddOutlined />} onClick={() => setBoxOpen(true)}
                data-testid="master-kit-add-box-button">
                Add Box
              </Button>
            </Col>
          </Row>

          {(master.boxes || []).map((box) => (
            <Card
              key={box.id}
              size="small"
              title={`${box.box_number} — ${box.box_type}`}
              extra={
                <Space>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => setEntryBox(box)}
                    data-testid={`master-kit-add-entry-${box.id}`}>
                    Add Entry
                  </Button>
                  <Popconfirm title="Delete box (soft-unlinks kit rows)?"
                    onConfirm={() => handleDeleteBox(box.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }
            >
              {(!box.entries || box.entries.length === 0) ? (
                <Empty description="No entries in this box" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Table<MasterKitEntry>
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={box.entries}
                  columns={[
                    { title: 'Type', dataIndex: 'entry_type',
                      render: (v: MasterKitEntryType) => <Tag>{v}</Tag> },
                    { title: 'Part #', dataIndex: 'part_number' },
                    { title: 'Description', dataIndex: 'description', ellipsis: true },
                    { title: 'Qty', dataIndex: 'required_quantity', align: 'right' },
                    { title: 'Unit', dataIndex: 'unit' },
                    { title: 'Tracking', dataIndex: 'tracking_type',
                      render: (v) => v ? <Tag color="purple">{v}</Tag> : '—' },
                    {
                      title: '', width: 60,
                      render: (_v, row) => (
                        <Popconfirm title="Delete entry?" onConfirm={() => handleDeleteEntry(row.id)}>
                          <Button size="small" danger icon={<DeleteOutlined />}
                            data-testid={`master-kit-delete-entry-${row.id}`} />
                        </Popconfirm>
                      ),
                    },
                  ]}
                />
              )}
            </Card>
          ))}
        </Space>
      )}

      <Modal
        title="Add box"
        open={boxOpen}
        onCancel={() => { setBoxOpen(false); boxForm.resetFields(); }}
        onOk={handleAddBox}
      >
        <Form form={boxForm} layout="vertical">
          <Form.Item name="box_number" label="Box number" rules={[{ required: true }]}>
            <Input placeholder="Box1, Loose, Floor, …" data-testid="master-box-number-input" />
          </Form.Item>
          <Form.Item name="box_type" label="Box type" rules={[{ required: true }]}>
            <Select options={[
              { value: 'expendable', label: 'Expendable' },
              { value: 'tooling', label: 'Tooling' },
              { value: 'consumable', label: 'Consumable' },
              { value: 'loose', label: 'Loose' },
              { value: 'floor', label: 'Floor' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={entryBox ? `Add entry to ${entryBox.box_number}` : 'Add entry'}
        open={entryBox !== null}
        onCancel={() => { setEntryBox(null); entryForm.resetFields(); }}
        onOk={handleAddEntry}
      >
        <Form form={entryForm} layout="vertical" initialValues={{ entry_type: 'expendable', required_quantity: 1, unit: 'each', is_required: true }}>
          <Form.Item name="entry_type" label="Entry type" rules={[{ required: true }]}>
            <Select options={[
              { value: 'tool', label: 'Tool' },
              { value: 'chemical', label: 'Chemical (from inventory)' },
              { value: 'expendable', label: 'Expendable' },
            ]} data-testid="master-entry-type-select" />
          </Form.Item>
          <Form.Item name="part_number" label="Part number" rules={[{ required: true }]}>
            <Input data-testid="master-entry-part-number-input" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input />
          </Form.Item>
          <Form.Item name="required_quantity" label="Required quantity">
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="minimum_stock_level" label="Minimum stock level">
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unit" label="Unit">
            <Input />
          </Form.Item>
          <Form.Item
            shouldUpdate={(prev, cur) => prev.entry_type !== cur.entry_type}
            noStyle
          >
            {({ getFieldValue }) =>
              getFieldValue('entry_type') === 'expendable' ? (
                <Form.Item name="tracking_type" label="Tracking type (expendable only)"
                  rules={[{ required: true }]}>
                  <Select options={[
                    { value: 'lot', label: 'Lot' },
                    { value: 'serial', label: 'Serial' },
                  ]} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="is_required" label="Required" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
}
