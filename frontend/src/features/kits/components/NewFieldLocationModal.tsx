import { Modal, Form, Input, Select, Row, Col, Divider, message, Alert } from 'antd';
import {
  useGetAircraftTypesQuery,
  useCreateKitMutation,
} from '../services/kitsApi';
import { useIsAdmin } from '@features/auth/hooks/usePermission';

interface NewFieldLocationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormValues {
  name: string;
  aircraft_type_id: number;
  aircraft_tail_number?: string;
  tanker_scooper_number?: string;
  trailer_number?: string;
  location_address?: string;
  location_city?: string;
  location_state?: string;
  location_zip?: string;
  location_country?: string;
  location_notes?: string;
}

/**
 * Slim form for registering a new "field location" while Kit Management is
 * deactivated. Skips boxes / items / master-kit selection (the wizard's job)
 * and only collects identifiers + address. Tail/tanker fields are admin-only;
 * non-admin users see an info banner explaining who to contact.
 */
export function NewFieldLocationModal({
  open,
  onClose,
  onSuccess,
}: NewFieldLocationModalProps) {
  const [form] = Form.useForm<FormValues>();
  const isAdmin = useIsAdmin();
  const { data: aircraftTypes, isLoading: loadingTypes } = useGetAircraftTypesQuery({});
  const [createKit, { isLoading }] = useCreateKitMutation();

  const handleSubmit = async (values: FormValues) => {
    const payload = { ...values };
    if (!isAdmin) {
      delete payload.aircraft_tail_number;
      delete payload.tanker_scooper_number;
    }
    try {
      await createKit(payload).unwrap();
      message.success('Field location registered');
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (err) {
      const e = err as { data?: { error?: string } };
      message.error(e?.data?.error || 'Failed to register field location');
    }
  };

  return (
    <Modal
      title="Register Field Location"
      open={open}
      onOk={() => form.submit()}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={isLoading}
      width={720}
      okText="Register"
      destroyOnHidden
    >
      {!isAdmin && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Tail and tanker numbers are admin-only fields"
          description="You can register the address / trailer details — contact an administrator to assign the aircraft tail or tanker number."
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{ location_country: 'USA' }}
      >
        <Divider>Identity</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Field Location Name"
              name="name"
              rules={[{ required: true, message: 'Enter a friendly name' }]}
            >
              <Input placeholder="e.g., Spokane Apron" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Aircraft Type"
              name="aircraft_type_id"
              rules={[{ required: true, message: 'Pick an aircraft type' }]}
            >
              <Select
                placeholder="Select aircraft type"
                loading={loadingTypes}
                options={aircraftTypes?.map((t) => ({ label: t.name, value: t.id }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Aircraft Tail Number" name="aircraft_tail_number">
              <Input placeholder="e.g., N123AB" disabled={!isAdmin} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Tanker / Scooper Number" name="tanker_scooper_number">
              <Input placeholder="e.g., T-12" disabled={!isAdmin} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Trailer Number" name="trailer_number">
              <Input placeholder="e.g., TR-42" />
            </Form.Item>
          </Col>
        </Row>

        <Divider>Location</Divider>
        <Form.Item label="Address" name="location_address">
          <Input placeholder="Street address" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="City" name="location_city">
              <Input />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="State" name="location_state">
              <Input />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="ZIP" name="location_zip">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Country" name="location_country">
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Notes" name="location_notes">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default NewFieldLocationModal;
