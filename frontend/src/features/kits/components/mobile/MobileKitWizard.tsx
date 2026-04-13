import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  TextArea,
  Selector,
  Stepper,
  Toast,
  SpinLoading,
} from 'antd-mobile';
import { AddOutline, DeleteOutline } from 'antd-mobile-icons';
import {
  useCreateKitMutation,
  useGetAircraftTypesQuery,
} from '../../services/kitsApi';
import type { KitFormData, BoxType } from '../../types';
import {
  MobilePageScaffold,
  MobileDetailHeader,
  MobileSectionCard,
  MobileEmptyState,
  MobileFormSheet,
} from '@shared/components/mobile';
import { useHaptics } from '@shared/hooks/useHaptics';
import './MobileKitWizard.css';

interface KitFormValues {
  name: string;
  aircraft_type_id?: string[];
  description?: string;
}

interface BoxDraft {
  _key: string;
  box_number: string;
  box_type: BoxType;
  description?: string;
}

interface BoxFormValues {
  box_number: string;
  box_type?: BoxType[];
  description?: string;
  quantity?: number;
}

const boxTypeOptions: Array<{ label: string; value: BoxType }> = [
  { label: 'Expendable', value: 'expendable' },
  { label: 'Tooling', value: 'tooling' },
  { label: 'Consumable', value: 'consumable' },
  { label: 'Loose', value: 'loose' },
  { label: 'Floor', value: 'floor' },
];

let boxKeySeq = 0;
const newKey = () => `box-${++boxKeySeq}`;

export const MobileKitWizard = () => {
  const navigate = useNavigate();
  const haptics = useHaptics();
  const [createKit, { isLoading: creating }] = useCreateKitMutation();
  const { data: aircraftTypes = [], isLoading: typesLoading } = useGetAircraftTypesQuery({});

  const [form] = Form.useForm<KitFormValues>();
  const [boxForm] = Form.useForm<BoxFormValues>();
  const [boxes, setBoxes] = useState<BoxDraft[]>([]);
  const [boxSheetOpen, setBoxSheetOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const aircraftOptions = aircraftTypes.map((t) => ({
    label: t.name,
    value: String(t.id),
  }));

  const openNewBox = () => {
    setEditingKey(null);
    boxForm.resetFields();
    boxForm.setFieldsValue({ box_type: ['expendable'], quantity: 1 });
    setBoxSheetOpen(true);
  };

  const openEditBox = (box: BoxDraft) => {
    setEditingKey(box._key);
    boxForm.setFieldsValue({
      box_number: box.box_number,
      box_type: [box.box_type],
      description: box.description,
    });
    setBoxSheetOpen(true);
  };

  const handleBoxSubmit = async () => {
    try {
      const values = await boxForm.validateFields();
      const type: BoxType = values.box_type?.[0] ?? 'expendable';
      const qty = Math.max(1, Math.min(20, values.quantity ?? 1));

      if (editingKey) {
        // Edit mode — update single entry
        setBoxes((prev) =>
          prev.map((b) =>
            b._key === editingKey
              ? {
                  _key: editingKey,
                  box_number: values.box_number,
                  box_type: type,
                  description: values.description,
                }
              : b
          )
        );
      } else if (qty === 1) {
        setBoxes((prev) => [
          ...prev,
          {
            _key: newKey(),
            box_number: values.box_number,
            box_type: type,
            description: values.description,
          },
        ]);
      } else {
        // Add N boxes with numbered suffix
        const base = values.box_number;
        const newBoxes: BoxDraft[] = Array.from({ length: qty }).map((_, i) => ({
          _key: newKey(),
          box_number: `${base}${i > 0 ? `-${i + 1}` : ''}`,
          box_type: type,
          description: values.description,
        }));
        setBoxes((prev) => [...prev, ...newBoxes]);
      }

      haptics.trigger('success');
      setBoxSheetOpen(false);
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      haptics.trigger('error');
    }
  };

  const removeBox = (key: string) => {
    setBoxes((prev) => prev.filter((b) => b._key !== key));
    haptics.trigger('selection');
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!values.aircraft_type_id?.[0]) {
        Toast.show({ icon: 'fail', content: 'Pick an aircraft type' });
        return;
      }

      const payload: KitFormData = {
        name: values.name,
        aircraft_type_id: Number(values.aircraft_type_id[0]),
        description: values.description,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        boxes: boxes.map(({ _key, ...rest }) => rest),
      };

      const created = await createKit(payload).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Kit created' });
      navigate(`/kits/${created.id}`, { replace: true });
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to create kit' });
    }
  };

  return (
    <MobilePageScaffold
      header={
        <MobileDetailHeader
          title="New Kit"
          subtitle="Create a kit and its boxes"
          actions={
            <Button size="small" fill="none" onClick={() => navigate('/kits')}>
              Cancel
            </Button>
          }
        />
      }
    >
      <Form form={form} layout="vertical" className="mobile-kit-wizard">
        <MobileSectionCard title="Kit Information">
          <Form.Item
            name="name"
            label="Kit Name"
            rules={[{ required: true, message: 'Kit name is required' }]}
          >
            <Input placeholder="e.g. Alpha Team Heavy Kit" />
          </Form.Item>
          <Form.Item
            name="aircraft_type_id"
            label="Aircraft Type"
            rules={[{ required: true, message: 'Aircraft type is required' }]}
          >
            {typesLoading ? (
              <div style={{ padding: 8 }}>
                <SpinLoading />
              </div>
            ) : aircraftOptions.length === 0 ? (
              <div className="mobile-kit-wizard__hint">
                No aircraft types available — ask an admin to create one first.
              </div>
            ) : (
              <Selector
                options={aircraftOptions}
                multiple={false}
                columns={2}
              />
            )}
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Optional notes about this kit" />
          </Form.Item>
        </MobileSectionCard>

        <MobileSectionCard
          title={`Boxes (${boxes.length})`}
          extra={
            <Button size="mini" color="primary" onClick={openNewBox}>
              <AddOutline /> Add
            </Button>
          }
          flush
        >
          {boxes.length === 0 ? (
            <MobileEmptyState
              title="No boxes yet"
              description="You can add boxes now or later from the kit detail page."
              actionLabel="Add Box"
              onAction={openNewBox}
            />
          ) : (
            <div className="mobile-kit-wizard__boxes">
              {boxes.map((box) => (
                <div key={box._key} className="mobile-kit-wizard__box">
                  <div
                    className="mobile-kit-wizard__box-body"
                    onClick={() => openEditBox(box)}
                  >
                    <div className="mobile-kit-wizard__box-title">
                      {box.box_number}
                    </div>
                    <div className="mobile-kit-wizard__box-meta">
                      {box.box_type}
                      {box.description ? ` • ${box.description}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mobile-kit-wizard__box-remove"
                    onClick={() => removeBox(box._key)}
                    aria-label="Remove box"
                  >
                    <DeleteOutline fontSize={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </MobileSectionCard>

        <div className="mobile-kit-wizard__submit">
          <Button
            block
            color="primary"
            size="large"
            loading={creating}
            onClick={handleSubmit}
          >
            Create Kit
          </Button>
        </div>
      </Form>

      <MobileFormSheet
        visible={boxSheetOpen}
        title={editingKey ? 'Edit Box' : 'Add Box'}
        onClose={() => setBoxSheetOpen(false)}
        onSubmit={handleBoxSubmit}
        submitLabel={editingKey ? 'Save' : 'Add'}
      >
        <Form form={boxForm} layout="vertical">
          <Form.Item
            name="box_number"
            label={editingKey ? 'Box Number' : 'Box Number (or prefix)'}
            rules={[{ required: true, message: 'Box number is required' }]}
          >
            <Input placeholder="e.g. BOX-01" />
          </Form.Item>
          <Form.Item name="box_type" label="Type">
            <Selector options={boxTypeOptions} multiple={false} />
          </Form.Item>
          {!editingKey && (
            <Form.Item
              name="quantity"
              label="How many?"
              extra="Creates multiple boxes with -2, -3 suffixes"
            >
              <Stepper min={1} max={20} />
            </Form.Item>
          )}
          <Form.Item name="description" label="Description">
            <Input placeholder="Optional" />
          </Form.Item>
        </Form>
      </MobileFormSheet>
    </MobilePageScaffold>
  );
};
