import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Selector,
  Stepper,
  TextArea,
  Toast,
  Dialog,
} from 'antd-mobile';
import { AddOutline, DeleteOutline } from 'antd-mobile-icons';
import { useCreateRequestMutation } from '../../services/requestsApi';
import type {
  CreateRequestRequest,
  CreateRequestItemRequest,
  RequestPriority,
  ItemType,
} from '../../types';
import {
  MobilePageScaffold,
  MobileSectionCard,
  MobileDetailHeader,
  MobileEmptyState,
  MobileFormSheet,
} from '@shared/components/mobile';
import { useHaptics } from '@shared/hooks/useHaptics';
import { useScanner } from '@features/scanner';
import '../mobile/MobileOrderCreationForm.css';
import './MobileRequestForm.css';

interface FormValues {
  title: string;
  priority?: RequestPriority[];
  description?: string;
  notes?: string;
}

interface ItemDraft extends CreateRequestItemRequest {
  _key: string;
}

interface ItemDraftFormValues {
  description: string;
  part_number?: string;
  item_type?: ItemType[];
  quantity?: number;
  unit?: string;
}

const priorityOptions: Array<{ label: string; value: RequestPriority }> = [
  { label: 'Routine', value: 'routine' },
  { label: 'Urgent', value: 'urgent' },
  { label: 'AOG', value: 'aog' },
];

const itemTypeOptions: Array<{ label: string; value: ItemType }> = [
  { label: 'Tool', value: 'tool' },
  { label: 'Chemical', value: 'chemical' },
  { label: 'Expendable', value: 'expendable' },
  { label: 'Repairable', value: 'repairable' },
  { label: 'Other', value: 'other' },
];

let itemKeySeq = 0;
const newKey = () => `item-${++itemKeySeq}`;

export const MobileRequestCreationForm = () => {
  const navigate = useNavigate();
  const haptics = useHaptics();
  const [createRequest, { isLoading }] = useCreateRequestMutation();
  const [form] = Form.useForm<FormValues>();
  const [itemForm] = Form.useForm<ItemDraftFormValues>();
  const { openScanner } = useScanner();

  const [items, setItems] = useState<ItemDraft[]>([]);
  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const openNewItem = () => {
    setEditingKey(null);
    itemForm.resetFields();
    itemForm.setFieldsValue({ quantity: 1, unit: 'each' });
    setItemSheetOpen(true);
  };

  const openEditItem = (item: ItemDraft) => {
    setEditingKey(item._key);
    itemForm.setFieldsValue({
      description: item.description,
      part_number: item.part_number,
      item_type: item.item_type ? [item.item_type] : undefined,
      quantity: item.quantity,
      unit: item.unit,
    });
    setItemSheetOpen(true);
  };

  const handleItemSubmit = async () => {
    try {
      const values = await itemForm.validateFields();
      const draft: ItemDraft = {
        _key: editingKey ?? newKey(),
        description: values.description,
        part_number: values.part_number,
        item_type: values.item_type?.[0],
        quantity: values.quantity ?? 1,
        unit: values.unit ?? 'each',
      };
      setItems((prev) => {
        if (editingKey) {
          return prev.map((i) => (i._key === editingKey ? draft : i));
        }
        return [...prev, draft];
      });
      haptics.trigger('success');
      setItemSheetOpen(false);
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      haptics.trigger('error');
    }
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i._key !== key));
    haptics.trigger('selection');
  };

  const handleScanToItem = () => {
    openScanner({
      title: 'Scan to add item',
      accept: ['tool', 'chemical'],
      onResolved: (result) => {
        const data = result.itemData ?? {};
        const description = String(
          data['description'] ?? data['name'] ?? `${result.itemType} ${result.itemId}`
        );
        const partNumber =
          typeof data['part_number'] === 'string'
            ? String(data['part_number'])
            : typeof data['tool_number'] === 'string'
              ? String(data['tool_number'])
              : undefined;

        setItems((prev) => [
          ...prev,
          {
            _key: newKey(),
            description,
            part_number: partNumber,
            item_type: result.itemType === 'tool' ? 'tool' : 'chemical',
            quantity: 1,
            unit: 'each',
          },
        ]);
        haptics.trigger('success');
        Toast.show({ icon: 'success', content: `Added ${description}`, duration: 1500 });
      },
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) {
        Toast.show({ icon: 'fail', content: 'Add at least one item' });
        return;
      }

      const payload: CreateRequestRequest = {
        title: values.title,
        priority: values.priority?.[0] ?? 'routine',
        description: values.description,
        notes: values.notes,
        items: items.map(({ _key: _, ...rest }) => rest),
      };

      const result = await createRequest(payload).unwrap();
      haptics.trigger('success');
      Toast.show({ icon: 'success', content: 'Request created' });
      navigate(`/requests/${result.id}`, { replace: true });
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return;
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to create request' });
    }
  };

  const handleCancel = () => {
    if (items.length === 0) {
      navigate('/requests');
      return;
    }
    Dialog.confirm({
      title: 'Discard this request?',
      content: `${items.length} item${items.length === 1 ? '' : 's'} will be lost.`,
      onConfirm: () => navigate('/requests'),
    });
  };

  return (
    <MobilePageScaffold
      header={
        <MobileDetailHeader
          title="New Request"
          subtitle="Request tools, chemicals, or expendables"
          actions={
            <Button size="small" fill="none" onClick={handleCancel}>
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
        initialValues={{ priority: ['routine'] }}
      >
        <MobileSectionCard title="Request Details">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Title is required' }]}
          >
            <Input placeholder="e.g. Replenish kit box 3" />
          </Form.Item>

          <Form.Item name="priority" label="Priority">
            <Selector options={priorityOptions} multiple={false} />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Context for the request..." />
          </Form.Item>
        </MobileSectionCard>

        <MobileSectionCard
          title={`Items (${items.length})`}
          extra={
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="mini" fill="outline" onClick={handleScanToItem}>
                Scan
              </Button>
              <Button size="mini" color="primary" onClick={openNewItem}>
                <AddOutline /> Add
              </Button>
            </div>
          }
          flush
        >
          {items.length === 0 ? (
            <MobileEmptyState
              title="No items yet"
              description="Add items manually or scan a label to pre-fill."
              actionLabel="Add Item"
              onAction={openNewItem}
            />
          ) : (
            <div className="mobile-request-form__items">
              {items.map((item) => (
                <div key={item._key} className="mobile-request-form__item">
                  <div
                    className="mobile-request-form__item-body"
                    onClick={() => openEditItem(item)}
                  >
                    <div className="mobile-request-form__item-title">
                      {item.description}
                    </div>
                    <div className="mobile-request-form__item-meta">
                      {item.quantity ?? 1} {item.unit ?? 'each'}
                      {item.part_number ? ` • PN: ${item.part_number}` : ''}
                      {item.item_type ? ` • ${item.item_type}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mobile-request-form__item-remove"
                    onClick={() => removeItem(item._key)}
                    aria-label="Remove item"
                  >
                    <DeleteOutline fontSize={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </MobileSectionCard>

        <MobileSectionCard title="Notes">
          <Form.Item name="notes" noStyle>
            <TextArea rows={3} placeholder="Additional notes (optional)" />
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
            Submit Request
          </Button>
        </div>
      </Form>

      <MobileFormSheet
        visible={itemSheetOpen}
        title={editingKey ? 'Edit Item' : 'Add Item'}
        onClose={() => setItemSheetOpen(false)}
        onSubmit={handleItemSubmit}
        submitLabel={editingKey ? 'Save' : 'Add'}
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Description is required' }]}
          >
            <Input placeholder="Item description" />
          </Form.Item>
          <Form.Item name="item_type" label="Type">
            <Selector options={itemTypeOptions} multiple={false} />
          </Form.Item>
          <Form.Item name="part_number" label="Part Number">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item name="quantity" label="Quantity">
            <Stepper min={1} />
          </Form.Item>
          <Form.Item name="unit" label="Unit">
            <Input placeholder="each" />
          </Form.Item>
        </Form>
      </MobileFormSheet>
    </MobilePageScaffold>
  );
};
