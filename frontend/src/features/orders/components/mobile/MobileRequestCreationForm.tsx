import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, List, Selector, Stepper, SwipeAction, TextArea, Toast } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import { useCreateRequestMutation } from '../../services/requestsApi';
import type { CreateRequestItemRequest, CreateRequestRequest, ItemType, RequestPriority } from '../../types';

const priorityOptions = [
  { label: 'Routine', value: 'routine' },
  { label: 'Urgent', value: 'urgent' },
  { label: 'AOG', value: 'aog' },
] as const;

const itemTypeOptions = [
  { label: 'Tool', value: 'tool' },
  { label: 'Chemical', value: 'chemical' },
  { label: 'Expendable', value: 'expendable' },
  { label: 'Repairable', value: 'repairable' },
  { label: 'Other', value: 'other' },
] as const;

export const MobileRequestCreationForm: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<CreateRequestItemRequest[]>([]);
  const [itemForm] = Form.useForm();
  const [requestForm] = Form.useForm();
  const [showItemForm, setShowItemForm] = useState(false);
  const [createRequest, { isLoading }] = useCreateRequestMutation();

  const addItem = (values: Record<string, unknown>) => {
    setItems((prev) => [...prev, {
      description: values.description as string,
      item_type: ((values.item_type as ItemType[])?.[0] || 'tool') as ItemType,
      part_number: values.part_number as string,
      quantity: values.quantity as number,
      unit: values.unit as string,
    }]);
    itemForm.resetFields();
    setShowItemForm(false);
  };

  const submitRequest = async (values: Record<string, unknown>) => {
    if (items.length === 0) {
      Toast.show({ content: 'Add at least one item', icon: 'fail' });
      return;
    }

    const payload: CreateRequestRequest = {
      title: values.title as string,
      description: values.description as string,
      notes: values.notes as string,
      priority: ((values.priority as RequestPriority[] | undefined)?.[0] || 'routine') as RequestPriority,
      items,
    };

    try {
      const req = await createRequest(payload).unwrap();
      Toast.show({ content: 'Request created', icon: 'success' });
      navigate(`/requests/${req.id}`);
    } catch {
      Toast.show({ content: 'Failed to create request', icon: 'fail' });
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <Button fill="none" onClick={() => navigate('/requests')} style={{ paddingLeft: 0 }}>
        ← Back to Requests
      </Button>

      <Form
        form={requestForm}
        layout="vertical"
        onFinish={submitRequest}
        footer={<Button block color="primary" type="submit" loading={isLoading}>Create Request</Button>}
      >
        <Form.Header>Create New Request</Form.Header>
        <Form.Item name="title" label="Title" rules={[{ required: true }]}> 
          <Input placeholder="Tool Restock for Warehouse A" />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <TextArea rows={3} placeholder="Describe this request" />
        </Form.Item>
        <Form.Item name="priority" label="Priority" initialValue={['routine'] as RequestPriority[]}>
          <Selector options={priorityOptions as unknown as {label: string; value: string}[]} />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <TextArea rows={2} placeholder="Additional context" />
        </Form.Item>
      </Form>

      <Card title="Items" extra={<Button size="mini" onClick={() => setShowItemForm(true)}><AddOutline /> Add</Button>}>
        {items.length === 0 ? (
          <div style={{ color: 'var(--adm-color-weak)', padding: '8px 0' }}>No items added yet.</div>
        ) : (
          <List>
            {items.map((item, idx) => (
              <SwipeAction
                key={`${item.description}-${idx}`}
                rightActions={[{ key: 'delete', text: 'Delete', color: 'danger', onClick: () => setItems(items.filter((_, i) => i !== idx)) }]}
              >
                <List.Item description={`${item.item_type} · ${item.quantity || 1} ${item.unit || 'each'}`}>
                  {item.description}
                </List.Item>
              </SwipeAction>
            ))}
          </List>
        )}
      </Card>

      {showItemForm && (
        <Card style={{ marginTop: 12 }} title="Add Item">
          <Form form={itemForm} layout="vertical" onFinish={addItem} footer={<Button block type="submit" color="primary">Save Item</Button>}>
            <Form.Item name="description" label="Description" rules={[{ required: true }]}>
              <Input placeholder="Item description" />
            </Form.Item>
            <Form.Item name="item_type" label="Type" initialValue={['tool'] as ItemType[]}>
              <Selector options={itemTypeOptions as unknown as {label: string; value: string}[]} />
            </Form.Item>
            <Form.Item name="part_number" label="Part Number">
              <Input placeholder="Optional" />
            </Form.Item>
            <Form.Item name="quantity" label="Quantity" initialValue={1}>
              <Stepper min={1} />
            </Form.Item>
            <Form.Item name="unit" label="Unit" initialValue="each">
              <Input placeholder="each, box, gal" />
            </Form.Item>
            <Button block onClick={() => setShowItemForm(false)} fill="outline" style={{ marginTop: 8 }}>Cancel</Button>
          </Form>
        </Card>
      )}
    </div>
  );
};
