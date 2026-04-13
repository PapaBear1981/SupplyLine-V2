import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Selector,
  Stepper,
  TextArea,
  Toast,
  Picker,
} from 'antd-mobile';
import { useState } from 'react';
import dayjs from 'dayjs';
import { useCreateOrderMutation } from '../../services/ordersApi';
import type { CreateOrderRequest, OrderPriority, OrderType } from '../../types';
import {
  MobilePageScaffold,
  MobileSectionCard,
  MobileDetailHeader,
} from '@shared/components/mobile';
import { useHaptics } from '@shared/hooks/useHaptics';
import './MobileOrderCreationForm.css';

interface FormValues {
  title: string;
  order_type?: OrderType[];
  part_number?: string;
  description?: string;
  priority?: OrderPriority[];
  quantity?: number;
  unit?: string;
  vendor?: string;
  expected_due_date?: Date[];
  notes?: string;
}

const typeOptions = [
  { label: 'Tool', value: 'tool' as const },
  { label: 'Chemical', value: 'chemical' as const },
  { label: 'Expendable', value: 'expendable' as const },
  { label: 'Kit', value: 'kit' as const },
];

const priorityOptions = [
  { label: 'Low', value: 'low' as const },
  { label: 'Normal', value: 'normal' as const },
  { label: 'High', value: 'high' as const },
  { label: 'Critical', value: 'critical' as const },
];

const unitOptions = ['each', 'box', 'case', 'roll', 'pack', 'mL', 'L', 'gal', 'oz', 'lb'];

export const MobileOrderCreationForm = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [createOrder, { isLoading }] = useCreateOrderMutation();
  const haptics = useHaptics();

  // Form state for controlled fields that Form.Item doesn't support well
  // on mobile (DatePicker, Picker, etc.).
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: CreateOrderRequest = {
        title: values.title,
        order_type: values.order_type?.[0],
        part_number: values.part_number,
        description: values.description,
        priority: values.priority?.[0] ?? 'normal',
        quantity: values.quantity,
        unit: values.unit,
        notes: values.notes,
        expected_due_date: values.expected_due_date?.[0]
          ? dayjs(values.expected_due_date[0]).format('YYYY-MM-DD')
          : undefined,
      };
      const result = await createOrder(payload).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Fulfillment record created' });
      navigate(`/orders/${result.id}`, { replace: true });
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to create order' });
    }
  };

  return (
    <MobilePageScaffold
      header={
        <MobileDetailHeader
          title="New Fulfillment Record"
          subtitle="Fill in the details below"
          actions={
            <Button
              size="small"
              fill="none"
              onClick={() => navigate('/orders')}
            >
              Cancel
            </Button>
          }
        />
      }
    >
      <Form
        form={form}
        layout="vertical"
        className="mobile-order-creation-form"
        initialValues={{
          priority: ['normal'],
        }}
      >
        <MobileSectionCard title="Item">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input placeholder="e.g. Tool bits for Kit #23" />
          </Form.Item>

          <Form.Item name="order_type" label="Type">
            <Selector options={typeOptions} multiple={false} />
          </Form.Item>

          <Form.Item name="part_number" label="Part Number">
            <Input placeholder="Enter part number" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea
              rows={3}
              placeholder="Describe what needs to be fulfilled..."
            />
          </Form.Item>
        </MobileSectionCard>

        <MobileSectionCard title="Priority & Quantity">
          <Form.Item name="priority" label="Priority">
            <Selector options={priorityOptions} multiple={false} />
          </Form.Item>

          <div className="mobile-order-creation-form__row">
            <Form.Item name="quantity" label="Quantity">
              <Stepper min={0} />
            </Form.Item>

            <Form.Item name="unit" label="Unit">
              {/* Picker-backed field */}
              <UnitField
                onOpen={() => setUnitPickerVisible(true)}
                visible={unitPickerVisible}
                onClose={() => setUnitPickerVisible(false)}
              />
            </Form.Item>
          </div>
        </MobileSectionCard>

        <MobileSectionCard title="Schedule">
          <Form.Item name="expected_due_date" label="Expected Due Date">
            <DueDateField
              visible={datePickerVisible}
              onOpen={() => setDatePickerVisible(true)}
              onClose={() => setDatePickerVisible(false)}
            />
          </Form.Item>
        </MobileSectionCard>

        <MobileSectionCard title="Notes">
          <Form.Item name="notes" noStyle>
            <TextArea rows={4} placeholder="Additional notes (optional)" />
          </Form.Item>
        </MobileSectionCard>

        <div className="mobile-order-creation-form__submit">
          <Button
            block
            color="primary"
            size="large"
            loading={isLoading}
            onClick={handleSubmit}
          >
            Create Fulfillment Record
          </Button>
        </div>
      </Form>
    </MobilePageScaffold>
  );
};

// ----------------------------------------------------------------------------
// Form field helpers — antd-mobile's Picker / DatePicker expose imperative
// open handlers and emit value via onConfirm, so we wrap them in tiny
// controlled components so Form.Item can bind them like any other input.
// ----------------------------------------------------------------------------

interface UnitFieldProps {
  value?: string;
  onChange?: (value: string) => void;
  onOpen: () => void;
  onClose: () => void;
  visible: boolean;
}

const UnitField = ({ value, onChange, onOpen, onClose, visible }: UnitFieldProps) => {
  return (
    <>
      <Input
        placeholder="each"
        value={value}
        onClick={(e) => {
          e.preventDefault();
          onOpen();
        }}
        readOnly
      />
      <Picker
        visible={visible}
        columns={[unitOptions.map((u) => ({ label: u, value: u }))]}
        value={value ? [value] : ['each']}
        onClose={onClose}
        onConfirm={(val) => {
          onChange?.(String(val[0] ?? 'each'));
          onClose();
        }}
      />
    </>
  );
};

interface DueDateFieldProps {
  value?: Date[];
  onChange?: (value: Date[]) => void;
  visible: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const DueDateField = ({ value, onChange, visible, onOpen, onClose }: DueDateFieldProps) => {
  // antd-mobile DatePicker uses year/month/day columns. For the mobile
  // creation form we can keep it simple and just show a readable label,
  // opening a bottom-sheet Picker for year/month/day.
  const label = value?.[0]
    ? dayjs(value[0]).format('MMM D, YYYY')
    : '';

  return (
    <>
      <Input
        placeholder="Select a date"
        value={label}
        readOnly
        onClick={(e) => {
          e.preventDefault();
          onOpen();
        }}
      />
      {visible && (
        <Picker
          visible={visible}
          columns={buildDateColumns()}
          onClose={onClose}
          onConfirm={(val) => {
            const [year, month, day] = val as (string | null)[];
            if (year && month && day) {
              const date = new Date(Number(year), Number(month) - 1, Number(day));
              onChange?.([date]);
            }
            onClose();
          }}
        />
      )}
    </>
  );
};

function buildDateColumns() {
  const now = dayjs();
  const years: Array<{ label: string; value: string }> = [];
  for (let y = now.year(); y <= now.year() + 3; y++) {
    years.push({ label: `${y}`, value: `${y}` });
  }
  const months: Array<{ label: string; value: string }> = Array.from({ length: 12 }).map(
    (_, i) => ({
      label: dayjs().month(i).format('MMM'),
      value: String(i + 1).padStart(2, '0'),
    })
  );
  const days: Array<{ label: string; value: string }> = Array.from({ length: 31 }).map(
    (_, i) => ({
      label: `${i + 1}`,
      value: String(i + 1).padStart(2, '0'),
    })
  );
  return [years, months, days];
}
