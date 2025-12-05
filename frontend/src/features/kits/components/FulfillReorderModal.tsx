import { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Typography,
  Descriptions,
  Tag,
  Alert,
  Spin,
  message,
} from 'antd';
import { useFulfillKitReorderMutation } from '../../orders/services/kitReordersApi';
import { useGetKitBoxesQuery } from '../services/kitsApi';
import type { KitReorderRequest, KitReorderPriority } from '../../orders/types';
import type { KitBox } from '../types';

const { TextArea } = Input;
const { Text } = Typography;

interface FulfillReorderModalProps {
  open: boolean;
  reorder: KitReorderRequest;
  kitId: number;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  box_id: number;
  notes?: string;
}

const FulfillReorderModal = ({
  open,
  reorder,
  kitId,
  onClose,
  onSuccess,
}: FulfillReorderModalProps) => {
  const [form] = Form.useForm<FormValues>();
  const [fulfillReorder, { isLoading: isFulfilling }] = useFulfillKitReorderMutation();
  const { data: boxes = [], isLoading: isLoadingBoxes } = useGetKitBoxesQuery(kitId);
  const [selectedBox, setSelectedBox] = useState<KitBox | undefined>(undefined);

  // Set default box when boxes are loaded
  useEffect(() => {
    if (boxes.length > 0 && !form.getFieldValue('box_id')) {
      const defaultBox = boxes[0];
      form.setFieldsValue({ box_id: defaultBox.id });
      setSelectedBox(defaultBox);
    }
  }, [boxes, form]);

  const getPriorityColor = (priority: KitReorderPriority) => {
    switch (priority) {
      case 'low':
        return 'default';
      case 'medium':
        return 'blue';
      case 'high':
        return 'orange';
      case 'urgent':
        return 'red';
      default:
        return 'default';
    }
  };

  const getBoxTypeColor = (boxType: string) => {
    switch (boxType) {
      case 'expendable':
        return 'green';
      case 'tooling':
        return 'blue';
      case 'consumable':
        return 'orange';
      case 'loose':
        return 'purple';
      case 'floor':
        return 'cyan';
      default:
        return 'default';
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      await fulfillReorder({
        reorderId: reorder.id,
        notes: values.notes,
      }).unwrap();

      message.success('Reorder fulfilled successfully - item added to kit');
      form.resetFields();
      onSuccess();
    } catch (error: unknown) {
      const err = error as { data?: { error?: string } };
      message.error(err.data?.error || 'Failed to fulfill reorder');
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const handleBoxChange = (boxId: number) => {
    const box = boxes.find(b => b.id === boxId);
    setSelectedBox(box);
  };

  // Filter boxes by type based on item type
  const getRecommendedBoxes = () => {
    if (reorder.item_type === 'expendable') {
      return boxes.filter(b => b.box_type === 'expendable' || b.box_type === 'consumable');
    }
    if (reorder.item_type === 'chemical') {
      return boxes.filter(b => b.box_type === 'consumable' || b.box_type === 'expendable');
    }
    return boxes;
  };

  const recommendedBoxes = getRecommendedBoxes();
  const otherBoxes = boxes.filter(b => !recommendedBoxes.includes(b));

  return (
    <Modal
      title="Fulfill Reorder Request"
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      okText="Fulfill Order"
      confirmLoading={isFulfilling}
      width={600}
      destroyOnClose
    >
      {isLoadingBoxes ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <Text style={{ display: 'block', marginTop: 16 }}>Loading kit boxes...</Text>
        </div>
      ) : boxes.length === 0 ? (
        <Alert
          message="No Boxes Available"
          description="This kit has no boxes. Please add a box to the kit before fulfilling this order."
          type="error"
          showIcon
        />
      ) : (
        <>
          <Alert
            message="Item Fulfillment"
            description={
              reorder.item_id
                ? "This will add quantity to the existing item in the kit."
                : "This will create a new item in the kit with the requested quantity."
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {/* Item Summary */}
          <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Part Number" span={2}>
              <Text strong>{reorder.part_number}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Description" span={2}>
              {reorder.description}
            </Descriptions.Item>
            <Descriptions.Item label="Item Type">
              <Tag>{reorder.item_type.toUpperCase()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Quantity">
              <Text strong>{reorder.quantity_requested}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Priority">
              <Tag color={getPriorityColor(reorder.priority)}>
                {reorder.priority.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Request Type">
              {reorder.is_automatic ? (
                <Tag color="geekblue">AUTOMATIC</Tag>
              ) : (
                <Tag>MANUAL</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>

          <Form form={form} layout="vertical">
            <Form.Item
              name="box_id"
              label="Destination Box"
              rules={[{ required: true, message: 'Please select a box' }]}
              extra={
                selectedBox && (
                  <Text type="secondary">
                    Selected: {selectedBox.box_number} - {selectedBox.description || 'No description'}
                    ({selectedBox.item_count || 0} items)
                  </Text>
                )
              }
            >
              <Select
                placeholder="Select destination box"
                onChange={handleBoxChange}
                options={[
                  ...(recommendedBoxes.length > 0 ? [
                    {
                      label: 'Recommended Boxes',
                      options: recommendedBoxes.map(box => ({
                        label: (
                          <span>
                            {box.box_number} - {box.description || 'No description'}
                            <Tag color={getBoxTypeColor(box.box_type)} style={{ marginLeft: 8 }}>
                              {box.box_type.toUpperCase()}
                            </Tag>
                          </span>
                        ),
                        value: box.id,
                      })),
                    },
                  ] : []),
                  ...(otherBoxes.length > 0 ? [
                    {
                      label: 'Other Boxes',
                      options: otherBoxes.map(box => ({
                        label: (
                          <span>
                            {box.box_number} - {box.description || 'No description'}
                            <Tag color={getBoxTypeColor(box.box_type)} style={{ marginLeft: 8 }}>
                              {box.box_type.toUpperCase()}
                            </Tag>
                          </span>
                        ),
                        value: box.id,
                      })),
                    },
                  ] : []),
                ]}
              />
            </Form.Item>

            <Form.Item
              name="notes"
              label="Fulfillment Notes (Optional)"
            >
              <TextArea
                rows={3}
                placeholder="Add any notes about the fulfillment (e.g., special handling, condition notes, etc.)"
                maxLength={500}
                showCount
              />
            </Form.Item>
          </Form>

          {reorder.item_type === 'chemical' && (
            <Alert
              message="Chemical Item"
              description="Chemicals require warehouse tracking. A new chemical record will be created if this is a new item."
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </>
      )}
    </Modal>
  );
};

export default FulfillReorderModal;
