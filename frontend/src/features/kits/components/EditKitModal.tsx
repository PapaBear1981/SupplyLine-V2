import { useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber, Row, Col, Divider, message } from 'antd';
import {
  useGetAircraftTypesQuery,
  useUpdateKitMutation,
  useAssignKitUserMutation,
} from '../services/kitsApi';
import { useGetUsersQuery } from '@features/users/services/usersApi';
import { useIsAdmin } from '@features/auth/hooks/usePermission';
import type { Kit } from '../types';

const { TextArea } = Input;

interface EditKitModalProps {
  open: boolean;
  kit: Kit | null;
  onClose: () => void;
  onSuccess?: () => void;
}

type EditKitFormValues = Partial<Kit> & { assigned_user_id?: number | null };

export function EditKitModal({ open, kit, onClose, onSuccess }: EditKitModalProps) {
  const [form] = Form.useForm<EditKitFormValues>();
  const isAdmin = useIsAdmin();
  const { data: aircraftTypes, isLoading: loadingTypes } = useGetAircraftTypesQuery({});
  const { data: users, isLoading: loadingUsers } = useGetUsersQuery(undefined, {
    skip: !isAdmin || !open,
  });
  const [updateKit, { isLoading: isUpdating }] = useUpdateKitMutation();
  const [assignKitUser, { isLoading: isAssigning }] = useAssignKitUserMutation();

  useEffect(() => {
    if (kit && open) {
      form.setFieldsValue({
        name: kit.name,
        aircraft_type_id: kit.aircraft_type_id,
        description: kit.description,
        status: kit.status,
        location_address: kit.location_address,
        location_city: kit.location_city,
        location_state: kit.location_state,
        location_zip: kit.location_zip,
        location_country: kit.location_country || 'USA',
        latitude: kit.latitude,
        longitude: kit.longitude,
        location_notes: kit.location_notes,
        trailer_number: kit.trailer_number,
        aircraft_tail_number: kit.aircraft_tail_number,
        tanker_scooper_number: kit.tanker_scooper_number,
        assigned_user_id: kit.assigned_user_id ?? null,
      });
    }
  }, [kit, open, form]);

  const handleSubmit = async (values: EditKitFormValues) => {
    if (!kit) return;

    const { assigned_user_id, ...kitFields } = values;

    try {
      await updateKit({
        id: kit.id,
        data: kitFields as Partial<Kit>,
      }).unwrap();

      // Admins can also (re)assign the responsible user. Fire only when changed
      // so non-admins (who never see the field) never trigger this call.
      if (isAdmin && assigned_user_id !== (kit.assigned_user_id ?? null)) {
        await assignKitUser({
          id: kit.id,
          assigned_user_id: assigned_user_id ?? null,
        }).unwrap();
      }

      message.success('Kit updated successfully');
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to update kit');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="Edit Kit"
      open={open}
      onOk={() => form.submit()}
      onCancel={handleCancel}
      confirmLoading={isUpdating || isAssigning}
      width={800}
      okText="Save Changes"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Divider>Basic Information</Divider>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Kit Name"
              name="name"
              rules={[{ required: true, message: 'Please enter kit name' }]}
            >
              <Input placeholder="Enter kit name" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Aircraft Type"
              name="aircraft_type_id"
              rules={[{ required: true, message: 'Please select aircraft type' }]}
            >
              <Select
                placeholder="Select aircraft type"
                loading={loadingTypes}
                options={aircraftTypes?.map(type => ({
                  label: type.name,
                  value: type.id,
                }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Status"
              name="status"
              rules={[{ required: true, message: 'Please select status' }]}
            >
              <Select
                placeholder="Select status"
                options={[
                  { label: 'Active', value: 'active' },
                  { label: 'Deployed', value: 'deployed' },
                  { label: 'Maintenance', value: 'maintenance' },
                  { label: 'Inactive', value: 'inactive' },
                  { label: 'Retired', value: 'retired' },
                ]}
              />
            </Form.Item>
          </Col>
          {isAdmin && (
            <Col span={12}>
              <Form.Item
                label="Assigned To"
                name="assigned_user_id"
                help="Point of contact for this kit (workload split — no extra permissions)"
              >
                <Select
                  placeholder="Unassigned"
                  loading={loadingUsers}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={(users ?? [])
                    .filter((u) => u.is_active)
                    .map((u) => ({
                      label: `${u.name} (${u.employee_number})`,
                      value: u.id,
                    }))}
                />
              </Form.Item>
            </Col>
          )}
        </Row>

        <Form.Item label="Description" name="description">
          <TextArea rows={3} placeholder="Enter kit description" />
        </Form.Item>

        <Divider>Aircraft Assignment</Divider>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Aircraft Tail Number"
              name="aircraft_tail_number"
              help="Tail number of the aircraft this kit supports (e.g., N123AB)"
            >
              <Input placeholder="e.g., N123AB" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Tanker / Scooper Number"
              name="tanker_scooper_number"
              help="Tanker or scooper number assigned to this kit"
            >
              <Input placeholder="e.g., T-12 or S-3" />
            </Form.Item>
          </Col>
        </Row>

        <Divider>Location Information</Divider>

        <Form.Item label="Address" name="location_address">
          <Input placeholder="Street address" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="City" name="location_city">
              <Input placeholder="City" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="State" name="location_state">
              <Input placeholder="State" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="ZIP Code" name="location_zip">
              <Input placeholder="ZIP" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Country" name="location_country">
              <Input placeholder="Country" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Trailer Number" name="trailer_number">
              <Input placeholder="Trailer number" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Latitude"
              name="latitude"
              help="Auto-filled from address if left empty"
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Auto-geocoded"
                step={0.000001}
                precision={6}
                min={-90}
                max={90}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Longitude"
              name="longitude"
              help="Auto-filled from address if left empty"
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Auto-geocoded"
                step={0.000001}
                precision={6}
                min={-180}
                max={180}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Location Notes" name="location_notes">
          <TextArea rows={2} placeholder="Additional location details or instructions" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default EditKitModal;
