import { useNavigate } from 'react-router-dom';
import { Button, DatePicker, Form, Input, Selector, Stepper, TextArea, Toast } from 'antd-mobile';
import dayjs from 'dayjs';
import { useCreateOrderMutation } from '../../services/ordersApi';
import type { CreateOrderRequest, OrderPriority, OrderType } from '../../types';

const priorityOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
] as const;

const typeOptions = [
  { label: 'Tool', value: 'tool' },
  { label: 'Chemical', value: 'chemical' },
  { label: 'Expendable', value: 'expendable' },
  { label: 'Kit', value: 'kit' },
] as const;

export const MobileOrderCreationForm: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [createOrder, { isLoading }] = useCreateOrderMutation();

  const onFinish = async (values: Record<string, unknown>) => {
    const payload: CreateOrderRequest = {
      title: (values.title as string)?.trim(),
      description: values.description as string,
      part_number: values.part_number as string,
      reference_type: values.reference_type as string,
      reference_number: values.reference_number as string,
      unit: values.unit as string,
      notes: values.notes as string,
      quantity: values.quantity as number,
      priority: (values.priority as OrderPriority[] | undefined)?.[0],
      order_type: (values.order_type as OrderType[] | undefined)?.[0],
      expected_due_date: values.expected_due_date
        ? dayjs(values.expected_due_date as string).toISOString()
        : undefined,
    };

    try {
      const created = await createOrder(payload).unwrap();
      Toast.show({ content: 'Order created', icon: 'success' });
      navigate(`/orders/${created.id}`);
    } catch {
      Toast.show({ content: 'Failed to create order', icon: 'fail' });
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <Button fill="none" onClick={() => navigate('/orders')} style={{ paddingLeft: 0 }}>
        ← Back to Fulfillment
      </Button>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        footer={<Button block type="submit" color="primary" loading={isLoading}>Create Fulfillment Record</Button>}
      >
        <Form.Header>Create Fulfillment Record</Form.Header>
        <Form.Item name="title" label="Title" rules={[{ required: true }]}> 
          <Input placeholder="Tool Bits for Kit #23" />
        </Form.Item>
        <Form.Item name="order_type" label="Type" rules={[{ required: true }]}> 
          <Selector options={typeOptions as unknown as {label: string; value: string}[]} />
        </Form.Item>
        <Form.Item name="part_number" label="Part Number">
          <Input placeholder="Enter part number" />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <TextArea rows={3} placeholder="Describe what needs to be fulfilled" />
        </Form.Item>
        <Form.Item name="priority" label="Priority" initialValue={['normal'] as OrderPriority[]}>
          <Selector options={priorityOptions as unknown as {label: string; value: string}[]} />
        </Form.Item>
        <Form.Item name="quantity" label="Quantity" initialValue={1}>
          <Stepper min={1} />
        </Form.Item>
        <Form.Item name="unit" label="Unit">
          <Input placeholder="each, box, gal" />
        </Form.Item>
        <Form.Item name="reference_type" label="Reference Type">
          <Input placeholder="Kit, Work Order" />
        </Form.Item>
        <Form.Item name="reference_number" label="Reference Number">
          <Input placeholder="KIT-00123" />
        </Form.Item>
        <Form.Item name="expected_due_date" label="Expected Due Date">
          <DatePicker>
            {(value) => <Button block>{value ? dayjs(value).format('MMM D, YYYY') : 'Select date'}</Button>}
          </DatePicker>
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <TextArea rows={2} placeholder="Additional context" />
        </Form.Item>
      </Form>
    </div>
  );
};
