import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Space,
  Button,
  Tabs,
  Modal,
  Form,
  Input,
  Select,
  message,
  Row,
  Col,
  Typography,
  Tag,
  Spin,
  Table,
  Badge,
  DatePicker,
  Popconfirm,
  Checkbox,
  Empty,
  Divider,
  Timeline,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  CheckOutlined,
  StopOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  ApartmentOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetRequestQuery,
  useUpdateRequestMutation,
  useGetRequestMessagesQuery,
  useCreateRequestMessageMutation,
  useMarkRequestMessageAsReadMutation,
  useMarkItemsAsOrderedMutation,
  useMarkItemsAsReceivedMutation,
  useCancelRequestItemsMutation,
  useGetRequestTimelineQuery,
} from '../services/requestsApi';
import { useGetOrdersByRequestQuery } from '../services/ordersApi';
import type { ProcurementOrder } from '../types';
import { useGetUsersQuery } from '@features/users/services/usersApi';
import { StatusBadge, PriorityBadge, ItemTypeBadge, MessageThread } from '../components';
import type { UpdateRequestRequest, RequestItem, RequestStatus } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Statuses considered terminal — no further workflow actions apply.
const TERMINAL_STATUSES: RequestStatus[] = ['fulfilled', 'cancelled'];

// Item statuses that can still be acted on (cancellation, in-flight, etc.).
const TERMINAL_ITEM_STATUSES = new Set(['received', 'cancelled', 'fulfilled']);

interface MarkOrderedFormValues {
  items: Record<
    number,
    {
      vendor?: string;
      tracking_number?: string;
      expected_delivery_date?: dayjs.Dayjs | null;
    }
  >;
}

/** Row-keyed input state for the inline approval/ordered table. */
interface ItemOrderInputs {
  vendor: string;
  tracking_number: string;
  expected_delivery_date: dayjs.Dayjs | null;
}

/** Build an empty inputs map pre-populated with existing item values. */
const buildInitialItemInputs = (items: RequestItem[]): Record<number, ItemOrderInputs> => {
  const map: Record<number, ItemOrderInputs> = {};
  items.forEach((item) => {
    map[item.id] = {
      vendor: item.vendor ?? '',
      tracking_number: item.tracking_number ?? '',
      expected_delivery_date: item.expected_delivery_date
        ? dayjs(item.expected_delivery_date)
        : null,
    };
  });
  return map;
};

export const RequestDetailView: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [editForm] = Form.useForm();
  const [orderedForm] = Form.useForm<MarkOrderedFormValues>();
  const [cancelItemsForm] = Form.useForm<{ item_ids: number[]; cancellation_reason: string }>();

  // Workflow step forms
  const [startReviewForm] = Form.useForm<{ buyer_id?: number; notes?: string }>();
  const [approveForm] = Form.useForm<{ buyer_id?: number; notes?: string }>();
  const [fulfillForm] = Form.useForm<{ notes?: string }>();
  const [needsInfoForm] = Form.useForm<{ info_needed: string }>();

  // Single-item modal forms
  const [singleOrderForm] = Form.useForm<{
    vendor?: string;
    tracking_number?: string;
    expected_delivery_date?: dayjs.Dayjs | null;
  }>();
  const [singleCancelForm] = Form.useForm<{ cancellation_reason: string }>();

  // Existing bulk modals (unchanged)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isOrderedModalVisible, setIsOrderedModalVisible] = useState(false);
  const [isReceivedModalVisible, setIsReceivedModalVisible] = useState(false);
  const [isCancelItemsModalVisible, setIsCancelItemsModalVisible] = useState(false);
  const [selectedReceivedIds, setSelectedReceivedIds] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState('details');

  // Workflow step modal visibility
  const [isStartReviewModalVisible, setIsStartReviewModalVisible] = useState(false);
  const [isApproveModalVisible, setIsApproveModalVisible] = useState(false);
  const [isFulfillModalVisible, setIsFulfillModalVisible] = useState(false);
  const [isNeedsInfoModalVisible, setIsNeedsInfoModalVisible] = useState(false);

  // Per-item state maps for approval table + single-item modals
  const [approvalItemInputs, setApprovalItemInputs] = useState<Record<number, ItemOrderInputs>>({});
  const [singleOrderItemId, setSingleOrderItemId] = useState<number | null>(null);
  const [singleCancelItemId, setSingleCancelItemId] = useState<number | null>(null);

  const { data: request, isLoading } = useGetRequestQuery(Number(requestId));
  const { data: messages = [], isLoading: messagesLoading } = useGetRequestMessagesQuery(
    Number(requestId)
  );
  const { data: users = [], isLoading: usersLoading } = useGetUsersQuery();
  const [updateRequest, { isLoading: updating }] = useUpdateRequestMutation();
  const [createMessage] = useCreateRequestMessageMutation();
  const [markMessageAsRead] = useMarkRequestMessageAsReadMutation();
  const [markItemsAsOrdered, { isLoading: markingOrdered }] = useMarkItemsAsOrderedMutation();
  const [markItemsAsReceived, { isLoading: markingReceived }] = useMarkItemsAsReceivedMutation();
  const [cancelRequestItems, { isLoading: cancellingItems }] = useCancelRequestItemsMutation();
  const { data: timelineData, isLoading: timelineLoading } = useGetRequestTimelineQuery(
    Number(requestId)
  );
  const { data: fulfillmentActions = [], isLoading: isLoadingActions } =
    useGetOrdersByRequestQuery(Number(requestId));

  // Individual submit-loading indicators (layered over shared mutation flags)
  const [startingReview, setStartingReview] = useState(false);
  const [approvingFulfillment, setApprovingFulfillment] = useState(false);
  const [fulfillingRequest, setFulfillingRequest] = useState(false);
  const [sendingNeedsInfo, setSendingNeedsInfo] = useState(false);
  const [submittingSingleOrder, setSubmittingSingleOrder] = useState(false);
  const [submittingSingleCancel, setSubmittingSingleCancel] = useState(false);

  const userOptions = useMemo(
    () =>
      users
        .filter((u) => u.is_active !== false)
        .map((u) => ({
          label: u.name,
          value: u.id,
        })),
    [users]
  );

  const handleEdit = () => {
    if (request) {
      editForm.setFieldsValue({
        title: request.title,
        description: request.description,
        priority: request.priority,
        notes: request.notes,
      });
      setIsEditModalVisible(true);
    }
  };

  const handleSaveEdit = async (values: UpdateRequestRequest) => {
    try {
      await updateRequest({ requestId: Number(requestId), updates: values }).unwrap();
      message.success('Request updated successfully');
      setIsEditModalVisible(false);
    } catch {
      message.error('Failed to update request');
    }
  };

  const handleSendMessage = async (data: { subject: string; message: string }) => {
    await createMessage({
      requestId: Number(requestId),
      message: data,
    }).unwrap();
  };

  const handleMarkMessageRead = async (messageId: number) => {
    await markMessageAsRead(messageId).unwrap();
  };

  if (isLoading || !request) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  const items: RequestItem[] = request.items ?? [];
  const pendingItems = items.filter((i) => i.status === 'pending');
  const orderedOrShippedItems = items.filter(
    (i) => i.status === 'ordered' || i.status === 'shipped'
  );
  const cancellableItems = items.filter((i) => !TERMINAL_ITEM_STATUSES.has(i.status));
  const isTerminal = TERMINAL_STATUSES.includes(request.status);

  /**
   * Update a single field in the approval table's inputs map without
   * clobbering sibling fields. Keeps React state updates immutable.
   */
  const updateApprovalInput = (
    itemId: number,
    field: keyof ItemOrderInputs,
    value: ItemOrderInputs[keyof ItemOrderInputs]
  ) => {
    setApprovalItemInputs((prev) => ({
      ...prev,
      [itemId]: {
        vendor: prev[itemId]?.vendor ?? '',
        tracking_number: prev[itemId]?.tracking_number ?? '',
        expected_delivery_date: prev[itemId]?.expected_delivery_date ?? null,
        [field]: value,
      },
    }));
  };

  // ----- Start Review modal -------------------------------------------------

  const openStartReviewModal = () => {
    startReviewForm.setFieldsValue({
      buyer_id: request.buyer_id,
      notes: undefined,
    });
    setIsStartReviewModalVisible(true);
  };

  const handleStartReviewSubmit = async (values: { buyer_id?: number; notes?: string }) => {
    const updates: UpdateRequestRequest = { status: 'under_review' };
    if (values.buyer_id) updates.buyer_id = values.buyer_id;
    const trimmedNotes = values.notes?.trim();
    if (trimmedNotes) updates.notes = trimmedNotes;

    setStartingReview(true);
    try {
      await updateRequest({ requestId: Number(requestId), updates }).unwrap();
      message.success('Review started');
      setIsStartReviewModalVisible(false);
      startReviewForm.resetFields();
    } catch {
      message.error('Failed to start review');
    } finally {
      setStartingReview(false);
    }
  };

  // ----- Approve for Fulfillment modal --------------------------------------

  const openApproveModal = () => {
    approveForm.setFieldsValue({
      buyer_id: request.buyer_id,
      notes: undefined,
    });
    setApprovalItemInputs(buildInitialItemInputs(items));
    setIsApproveModalVisible(true);
  };

  const handleApproveSubmit = async (values: { buyer_id?: number; notes?: string }) => {
    setApprovingFulfillment(true);
    try {
      // Collect items that have at least a vendor filled in.
      const orderedPayload = items
        .map((item) => {
          const entry = approvalItemInputs[item.id];
          if (!entry) return null;
          const vendor = entry.vendor.trim();
          if (!vendor) return null;
          const tracking = entry.tracking_number.trim();
          return {
            item_id: item.id,
            vendor,
            tracking_number: tracking || undefined,
            expected_delivery_date: entry.expected_delivery_date
              ? entry.expected_delivery_date.format('YYYY-MM-DD')
              : undefined,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      if (orderedPayload.length > 0) {
        await markItemsAsOrdered({
          requestId: Number(requestId),
          data: { items: orderedPayload },
        }).unwrap();
      }

      const updates: UpdateRequestRequest = { status: 'pending_fulfillment' };
      if (values.buyer_id) updates.buyer_id = values.buyer_id;
      const trimmedNotes = values.notes?.trim();
      if (trimmedNotes) updates.notes = trimmedNotes;

      await updateRequest({ requestId: Number(requestId), updates }).unwrap();

      message.success('Request approved for fulfillment');
      setIsApproveModalVisible(false);
      approveForm.resetFields();
      setApprovalItemInputs({});
    } catch {
      message.error('Failed to approve request for fulfillment');
    } finally {
      setApprovingFulfillment(false);
    }
  };

  // ----- Mark Fulfilled modal -----------------------------------------------

  const openFulfillModal = () => {
    fulfillForm.resetFields();
    setIsFulfillModalVisible(true);
  };

  const handleFulfillSubmit = async (values: { notes?: string }) => {
    const updates: UpdateRequestRequest = { status: 'fulfilled' };
    const trimmedNotes = values.notes?.trim();
    if (trimmedNotes) updates.notes = trimmedNotes;

    setFulfillingRequest(true);
    try {
      await updateRequest({ requestId: Number(requestId), updates }).unwrap();
      message.success('Request marked as fulfilled');
      setIsFulfillModalVisible(false);
      fulfillForm.resetFields();
    } catch {
      message.error('Failed to mark request as fulfilled');
    } finally {
      setFulfillingRequest(false);
    }
  };

  // ----- Request More Info modal --------------------------------------------

  const openNeedsInfoModal = () => {
    needsInfoForm.resetFields();
    setIsNeedsInfoModalVisible(true);
  };

  const handleNeedsInfoSubmit = async (values: { info_needed: string }) => {
    const info = values.info_needed.trim();
    setSendingNeedsInfo(true);
    try {
      await updateRequest({
        requestId: Number(requestId),
        updates: {
          status: 'needs_info',
          needs_more_info: true,
          notes: info,
        },
      }).unwrap();
      message.success('Marked as needing more information');
      setIsNeedsInfoModalVisible(false);
      needsInfoForm.resetFields();
    } catch {
      message.error('Failed to mark request as needing info');
    } finally {
      setSendingNeedsInfo(false);
    }
  };

  // ----- Cancel Request (header popconfirm) ---------------------------------

  const handleCancelRequest = async () => {
    try {
      await updateRequest({
        requestId: Number(requestId),
        updates: { status: 'cancelled' },
      }).unwrap();
      message.success('Request cancelled');
    } catch {
      message.error('Failed to cancel request');
    }
  };

  // ----- Mark Items Ordered modal handlers (bulk, unchanged) ----------------

  const openOrderedModal = () => {
    const defaults: MarkOrderedFormValues = { items: {} };
    pendingItems.forEach((item) => {
      defaults.items[item.id] = {
        vendor: item.vendor ?? undefined,
        tracking_number: item.tracking_number ?? undefined,
        expected_delivery_date: item.expected_delivery_date
          ? dayjs(item.expected_delivery_date)
          : null,
      };
    });
    orderedForm.setFieldsValue(defaults);
    setIsOrderedModalVisible(true);
  };

  const handleMarkOrderedSubmit = async (values: MarkOrderedFormValues) => {
    const payload = pendingItems.map((item) => {
      const entry = values.items?.[item.id] ?? {};
      return {
        item_id: item.id,
        vendor: entry.vendor?.trim() || undefined,
        tracking_number: entry.tracking_number?.trim() || undefined,
        expected_delivery_date: entry.expected_delivery_date
          ? entry.expected_delivery_date.format('YYYY-MM-DD')
          : undefined,
      };
    });

    try {
      await markItemsAsOrdered({
        requestId: Number(requestId),
        data: { items: payload },
      }).unwrap();
      message.success('Items marked as ordered');
      setIsOrderedModalVisible(false);
      orderedForm.resetFields();
    } catch {
      message.error('Failed to mark items as ordered');
    }
  };

  // ----- Mark Items Received modal handlers --------------------------------

  const openReceivedModal = () => {
    setSelectedReceivedIds([]);
    setIsReceivedModalVisible(true);
  };

  const handleMarkReceivedSubmit = async () => {
    if (selectedReceivedIds.length === 0) {
      message.warning('Select at least one item to mark as received');
      return;
    }
    try {
      await markItemsAsReceived({
        requestId: Number(requestId),
        data: { item_ids: selectedReceivedIds },
      }).unwrap();
      message.success('Items marked as received');
      setIsReceivedModalVisible(false);
      setSelectedReceivedIds([]);
    } catch {
      message.error('Failed to mark items as received');
    }
  };

  // ----- Cancel Items modal handlers ---------------------------------------

  const openCancelItemsModal = () => {
    cancelItemsForm.resetFields();
    setIsCancelItemsModalVisible(true);
  };

  const handleCancelItemsSubmit = async (values: {
    item_ids: number[];
    cancellation_reason: string;
  }) => {
    try {
      await cancelRequestItems({
        requestId: Number(requestId),
        data: {
          item_ids: values.item_ids,
          cancellation_reason: values.cancellation_reason.trim(),
        },
      }).unwrap();
      message.success('Items cancelled');
      setIsCancelItemsModalVisible(false);
      cancelItemsForm.resetFields();
    } catch {
      message.error('Failed to cancel items');
    }
  };

  // ----- Per-item action handlers ------------------------------------------

  const openSingleOrderModal = (item: RequestItem) => {
    setSingleOrderItemId(item.id);
    singleOrderForm.setFieldsValue({
      vendor: item.vendor ?? undefined,
      tracking_number: item.tracking_number ?? undefined,
      expected_delivery_date: item.expected_delivery_date
        ? dayjs(item.expected_delivery_date)
        : null,
    });
  };

  const closeSingleOrderModal = () => {
    setSingleOrderItemId(null);
    singleOrderForm.resetFields();
  };

  const handleSingleOrderSubmit = async (values: {
    vendor?: string;
    tracking_number?: string;
    expected_delivery_date?: dayjs.Dayjs | null;
  }) => {
    if (singleOrderItemId == null) return;

    setSubmittingSingleOrder(true);
    try {
      await markItemsAsOrdered({
        requestId: Number(requestId),
        data: {
          items: [
            {
              item_id: singleOrderItemId,
              vendor: values.vendor?.trim() || undefined,
              tracking_number: values.tracking_number?.trim() || undefined,
              expected_delivery_date: values.expected_delivery_date
                ? values.expected_delivery_date.format('YYYY-MM-DD')
                : undefined,
            },
          ],
        },
      }).unwrap();
      message.success('Item marked as ordered');
      closeSingleOrderModal();
    } catch {
      message.error('Failed to mark item as ordered');
    } finally {
      setSubmittingSingleOrder(false);
    }
  };

  const handleSingleReceived = async (item: RequestItem) => {
    try {
      await markItemsAsReceived({
        requestId: Number(requestId),
        data: { item_ids: [item.id] },
      }).unwrap();
      message.success('Item marked as received');
    } catch {
      message.error('Failed to mark item as received');
    }
  };

  const openSingleCancelModal = (item: RequestItem) => {
    setSingleCancelItemId(item.id);
    singleCancelForm.resetFields();
  };

  const closeSingleCancelModal = () => {
    setSingleCancelItemId(null);
    singleCancelForm.resetFields();
  };

  const handleSingleCancelSubmit = async (values: { cancellation_reason: string }) => {
    if (singleCancelItemId == null) return;

    setSubmittingSingleCancel(true);
    try {
      await cancelRequestItems({
        requestId: Number(requestId),
        data: {
          item_ids: [singleCancelItemId],
          cancellation_reason: values.cancellation_reason.trim(),
        },
      }).unwrap();
      message.success('Item cancelled');
      closeSingleCancelModal();
    } catch {
      message.error('Failed to cancel item');
    } finally {
      setSubmittingSingleCancel(false);
    }
  };

  // ----- Item table columns -------------------------------------------------

  const itemColumns: ColumnsType<RequestItem> = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 220,
    },
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      width: 100,
      render: (type) => type && <ItemTypeBadge type={type} />,
    },
    {
      title: 'Part Number',
      dataIndex: 'part_number',
      key: 'part_number',
      width: 120,
      render: (pn) => pn || '-',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      render: (qty, record) => `${qty || 1} ${record.unit || 'each'}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => <StatusBadge status={status} type="item" />,
    },
    {
      title: 'Vendor',
      dataIndex: 'vendor',
      key: 'vendor',
      width: 140,
      render: (vendor) => vendor || '-',
    },
    {
      title: 'Tracking',
      dataIndex: 'tracking_number',
      key: 'tracking_number',
      width: 140,
      render: (tracking) => tracking || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, item) => {
        const canCancel = !TERMINAL_ITEM_STATUSES.has(item.status);
        return (
          <Space size={4} wrap>
            {item.status === 'pending' && (
              <Button
                size="small"
                type="primary"
                icon={<ShoppingCartOutlined />}
                onClick={() => openSingleOrderModal(item)}
              >
                Mark Ordered
              </Button>
            )}
            {(item.status === 'ordered' || item.status === 'shipped') && (
              <Popconfirm
                title="Mark this item as received?"
                okText="Yes"
                cancelText="No"
                onConfirm={() => handleSingleReceived(item)}
              >
                <Button size="small" icon={<InboxOutlined />} loading={markingReceived}>
                  Received
                </Button>
              </Popconfirm>
            )}
            {canCancel && (
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => openSingleCancelModal(item)}
              >
                Cancel
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  // ----- Approval table columns (inline-editable) ---------------------------

  const approvalColumns: ColumnsType<RequestItem> = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 200,
    },
    {
      title: 'Type',
      dataIndex: 'item_type',
      key: 'item_type',
      width: 90,
      render: (type) => type && <ItemTypeBadge type={type} />,
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 70,
      render: (qty, record) => `${qty || 1} ${record.unit || 'each'}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => <StatusBadge status={status} type="item" />,
    },
    {
      title: 'Vendor',
      key: 'vendor',
      width: 150,
      render: (_, item) => (
        <Input
          placeholder="Vendor"
          value={approvalItemInputs[item.id]?.vendor ?? ''}
          onChange={(e) => updateApprovalInput(item.id, 'vendor', e.target.value)}
        />
      ),
    },
    {
      title: 'Tracking #',
      key: 'tracking_number',
      width: 160,
      render: (_, item) => (
        <Input
          placeholder="Tracking"
          value={approvalItemInputs[item.id]?.tracking_number ?? ''}
          onChange={(e) => updateApprovalInput(item.id, 'tracking_number', e.target.value)}
        />
      ),
    },
    {
      title: 'Expected Delivery',
      key: 'expected_delivery_date',
      width: 170,
      render: (_, item) => (
        <DatePicker
          style={{ width: '100%' }}
          format="YYYY-MM-DD"
          value={approvalItemInputs[item.id]?.expected_delivery_date ?? null}
          onChange={(date) => updateApprovalInput(item.id, 'expected_delivery_date', date)}
        />
      ),
    },
  ];

  // ----- Header action buttons ---------------------------------------------

  const headerActionButtons: React.ReactNode[] = [];

  if (request.status === 'new') {
    headerActionButtons.push(
      <Button
        key="start-review"
        type="primary"
        icon={<PlayCircleOutlined />}
        loading={startingReview}
        onClick={openStartReviewModal}
      >
        Start Review
      </Button>
    );
  }

  if (request.status === 'under_review') {
    headerActionButtons.push(
      <Button
        key="approve"
        type="primary"
        icon={<CheckOutlined />}
        loading={approvingFulfillment}
        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
        onClick={openApproveModal}
      >
        Approve for Fulfillment
      </Button>
    );
  }

  if (
    request.status === 'pending_fulfillment' ||
    request.status === 'partially_fulfilled'
  ) {
    headerActionButtons.push(
      <Button
        key="fulfill"
        type="primary"
        icon={<CheckOutlined />}
        loading={fulfillingRequest}
        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
        onClick={openFulfillModal}
      >
        Mark Fulfilled
      </Button>
    );
  }

  if (!isTerminal) {
    headerActionButtons.push(
      <Button
        key="needs-info"
        icon={<QuestionCircleOutlined />}
        loading={sendingNeedsInfo}
        onClick={openNeedsInfoModal}
      >
        Request More Info
      </Button>
    );
    headerActionButtons.push(
      <Popconfirm
        key="cancel"
        title="Cancel this request?"
        okText="Yes, cancel it"
        cancelText="No"
        onConfirm={handleCancelRequest}
      >
        <Button danger loading={updating}>
          Cancel Request
        </Button>
      </Popconfirm>
    );
  }

  // ----- Tab definitions ---------------------------------------------------

  const tabItems = [
    {
      key: 'details',
      label: 'Request Details',
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* ── Request info ── */}
          <Card>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Request Number" span={2}>
                <Text strong style={{ fontSize: 16 }}>{request.request_number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Title" span={2}>
                {request.title}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <StatusBadge status={request.status} type="request" />
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <PriorityBadge priority={request.priority} />
              </Descriptions.Item>
              <Descriptions.Item label="Requester">
                {request.requester
                  ? `${request.requester.first_name} ${request.requester.last_name}`
                  : request.requester_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Assigned Buyer">
                {request.buyer_name || (request.buyer ? `${request.buyer.first_name} ${request.buyer.last_name}` : '-')}
              </Descriptions.Item>
              <Descriptions.Item label="Total Items">
                <Badge count={request.item_count || 0} showZero />
              </Descriptions.Item>
              {request.expected_due_date && (
                <Descriptions.Item label="Expected Due Date">
                  <Space>
                    {dayjs(request.expected_due_date).format('MMM D, YYYY')}
                    {request.is_late && <Tag color="red">Overdue</Tag>}
                  </Space>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Created At">
                {dayjs(request.created_at).format('MMM D, YYYY h:mm A')}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {dayjs(request.updated_at).format('MMM D, YYYY h:mm A')}
              </Descriptions.Item>
              {request.description && (
                <Descriptions.Item label="Description" span={2}>
                  {request.description}
                </Descriptions.Item>
              )}
              {request.notes && (
                <Descriptions.Item label="Notes" span={2}>
                  {request.notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* ── Fulfillment Actions (procurement orders) ── */}
          <Card
            title={
              <Space>
                <ApartmentOutlined style={{ color: '#1890ff' }} />
                <Text strong>Fulfillment Actions</Text>
                <Badge
                  count={fulfillmentActions.length}
                  showZero
                  style={{ backgroundColor: fulfillmentActions.length > 0 ? '#1890ff' : undefined }}
                />
              </Space>
            }
          >
            {isLoadingActions ? (
              <div style={{ textAlign: 'center', padding: 16 }}><Spin /></div>
            ) : fulfillmentActions.length === 0 ? (
              <Text type="secondary">No fulfillment actions yet for this request.</Text>
            ) : (
              <>
                {fulfillmentActions.length > 1 && (
                  <Alert
                    message={`Split fulfillment: ${fulfillmentActions.length} actions covering this request`}
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                  />
                )}
                <Table<ProcurementOrder>
                  columns={[
                    { title: 'Order #', dataIndex: 'order_number', key: 'order_number', width: 120, render: (n: string) => <Text strong>{n}</Text> },
                    { title: 'Vendor', dataIndex: 'vendor', key: 'vendor', width: 140, render: (v: string) => v || '-' },
                    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 70 },
                    { title: 'Status', dataIndex: 'status', key: 'status', width: 130, render: (s: string) => <StatusBadge status={s} /> },
                    { title: 'Tracking #', dataIndex: 'tracking_number', key: 'tracking_number', width: 140, render: (t: string) => t || '-' },
                    { title: 'Assigned To', dataIndex: 'buyer_name', key: 'buyer_name', width: 130, render: (n: string) => n || '-' },
                    { title: 'Ordered', dataIndex: 'ordered_date', key: 'ordered_date', width: 110, render: (d: string) => d ? dayjs(d).format('MMM D, YYYY') : '-' },
                    { title: 'Expected', dataIndex: 'expected_due_date', key: 'expected_due_date', width: 110, render: (d: string) => d ? dayjs(d).format('MMM D, YYYY') : '-' },
                  ]}
                  dataSource={fulfillmentActions}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 900 }}
                />
              </>
            )}
          </Card>

          {/* ── Request Timeline ── */}
          <Card title="Request Timeline">
            {timelineLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
            ) : !timelineData?.timeline.length ? (
              <Empty description="No timeline events yet" />
            ) : (
              <Timeline
                items={timelineData.timeline.map((event) => {
                  const colorMap: Record<string, string> = {
                    created: 'green',
                    status_changed: 'blue',
                    buyer_assigned: 'purple',
                    items_ordered: 'cyan',
                    items_received: 'green',
                    items_cancelled: 'red',
                    cancelled: 'red',
                    message_sent: 'gray',
                  };
                  const details = event.details as Record<string, unknown>;
                  return {
                    color: colorMap[event.event_type] ?? 'gray',
                    children: (
                      <Space direction="vertical" size={0}>
                        <Text strong>{event.description}</Text>
                        <Text type="secondary">
                          {dayjs(event.timestamp).format('MMM D, YYYY h:mm A')} — {event.user_name}
                        </Text>
                        {event.event_type === 'status_changed' && details.old_status != null && details.new_status != null && (
                          <Space size={4}>
                            <Tag>{String(details.old_status)}</Tag>
                            <span>→</span>
                            <Tag color={colorMap.status_changed}>{String(details.new_status)}</Tag>
                          </Space>
                        )}
                        {event.event_type === 'items_ordered' && Array.isArray(details.vendors) && (details.vendors as string[]).length > 0 && (
                          <Text type="secondary">Vendors: {(details.vendors as string[]).join(', ')}</Text>
                        )}
                        {event.event_type === 'message_sent' && details.message_preview != null && (
                          <Text type="secondary" italic>"{String(details.message_preview)}{String(details.message_preview).length >= 120 ? '…' : ''}"</Text>
                        )}
                        {details.notes != null && event.event_type === 'status_changed' && (
                          <Text type="secondary" italic>{String(details.notes)}</Text>
                        )}
                      </Space>
                    ),
                  };
                })}
              />
            )}
          </Card>
        </Space>
      ),
    },
    {
      key: 'items',
      label: `Items (${items.length})`,
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card title="Fulfillment Actions" size="small">
            <Space wrap>
              <Button
                type="primary"
                icon={<ShoppingCartOutlined />}
                disabled={pendingItems.length === 0}
                onClick={openOrderedModal}
              >
                Mark Items Ordered
              </Button>
              <Button
                icon={<InboxOutlined />}
                disabled={orderedOrShippedItems.length === 0}
                onClick={openReceivedModal}
              >
                Mark Items Received
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                disabled={cancellableItems.length === 0}
                onClick={openCancelItemsModal}
              >
                Cancel Items
              </Button>
            </Space>
          </Card>
          <Card>
            <Table
              columns={itemColumns}
              dataSource={items}
              rowKey="id"
              pagination={false}
              scroll={{ x: 1200 }}
            />
          </Card>
        </Space>
      ),
    },
    {
      key: 'messages',
      label: 'Messages',
      children: (
        <MessageThread
          messages={messages}
          loading={messagesLoading}
          onSendMessage={handleSendMessage}
          onMarkAsRead={handleMarkMessageRead}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/requests')}
          style={{ marginBottom: 16 }}
        >
          Back to Requests
        </Button>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              Request {request.request_number}
            </Title>
            <Text type="secondary">View and manage request details</Text>
          </Col>
          <Col>
            <Space wrap>
              <Button icon={<EditOutlined />} onClick={handleEdit}>
                Edit Request
              </Button>
              {headerActionButtons}
            </Space>
          </Col>
        </Row>
      </div>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* Edit Modal */}
      <Modal
        title="Edit Request"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={editForm} onFinish={handleSaveEdit} layout="vertical">
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="priority" label="Priority">
            <Select>
              <Select.Option value="low">Low</Select.Option>
              <Select.Option value="normal">Normal</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="critical">Critical</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={updating}>
                Save Changes
              </Button>
              <Button onClick={() => setIsEditModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Start Review Modal */}
      <Modal
        title="Start Review"
        open={isStartReviewModalVisible}
        onCancel={() => setIsStartReviewModalVisible(false)}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form form={startReviewForm} layout="vertical" onFinish={handleStartReviewSubmit}>
          <Form.Item
            name="buyer_id"
            label="Assign Buyer"
            help="Optional — a buyer can also be assigned later."
          >
            <Select
              allowClear
              showSearch
              placeholder="Select a buyer (optional)"
              loading={usersLoading}
              options={userOptions}
              filterOption={(input, option) =>
                (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Optional notes" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={startingReview}>
                Start Review
              </Button>
              <Button onClick={() => setIsStartReviewModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Approve for Fulfillment Modal */}
      <Modal
        title="Approve Request for Fulfillment"
        open={isApproveModalVisible}
        onCancel={() => setIsApproveModalVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        <Form form={approveForm} layout="vertical" onFinish={handleApproveSubmit}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="buyer_id"
                label="Assign Buyer"
                help="Optional — a buyer can also be assigned later."
              >
                <Select
                  allowClear
                  showSearch
                  placeholder="Select a buyer (optional)"
                  loading={usersLoading}
                  options={userOptions}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Optional notes" />
              </Form.Item>
            </Col>
          </Row>
          <Divider>Item Details</Divider>
          <Text type="secondary">
            Fill in vendor, tracking, and expected delivery for each item you want to mark as
            ordered as part of this approval. Items without a vendor will simply move to
            pending fulfillment without procurement details.
          </Text>
          <div style={{ marginTop: 12 }}>
            {items.length === 0 ? (
              <Empty description="No items on this request" />
            ) : (
              <Table
                columns={approvalColumns}
                dataSource={items}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 1000 }}
              />
            )}
          </div>
          <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={approvingFulfillment || markingOrdered}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                icon={<CheckOutlined />}
              >
                Approve for Fulfillment
              </Button>
              <Button onClick={() => setIsApproveModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Mark Fulfilled Modal */}
      <Modal
        title="Mark Request as Fulfilled"
        open={isFulfillModalVisible}
        onCancel={() => setIsFulfillModalVisible(false)}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Form form={fulfillForm} layout="vertical" onFinish={handleFulfillSubmit}>
          <Text>All items will be marked fulfilled.</Text>
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            {items.length === 0 ? (
              <Empty description="No items on this request" />
            ) : (
              <Table
                size="small"
                pagination={false}
                dataSource={items}
                rowKey="id"
                columns={[
                  {
                    title: 'Description',
                    dataIndex: 'description',
                    key: 'description',
                  },
                  {
                    title: 'Qty',
                    dataIndex: 'quantity',
                    key: 'quantity',
                    width: 80,
                    render: (qty, record) => `${qty || 1} ${record.unit || 'each'}`,
                  },
                  {
                    title: 'Current Status',
                    dataIndex: 'status',
                    key: 'status',
                    width: 140,
                    render: (status) => <StatusBadge status={status} type="item" />,
                  },
                ]}
              />
            )}
          </div>
          <Form.Item name="notes" label="Notes">
            <TextArea rows={3} placeholder="Optional notes about the fulfillment" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={fulfillingRequest}
                icon={<CheckOutlined />}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                Mark as Fulfilled
              </Button>
              <Button onClick={() => setIsFulfillModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Request More Info Modal */}
      <Modal
        title="Request More Information"
        open={isNeedsInfoModalVisible}
        onCancel={() => setIsNeedsInfoModalVisible(false)}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Form form={needsInfoForm} layout="vertical" onFinish={handleNeedsInfoSubmit}>
          <Form.Item
            name="info_needed"
            label="What information is needed?"
            rules={[
              { required: true, message: 'Please describe what information is needed' },
              {
                validator: (_, value) =>
                  value && value.trim().length >= 10
                    ? Promise.resolve()
                    : Promise.reject(new Error('Please provide at least 10 characters')),
              },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Describe what the requester needs to clarify or provide"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={sendingNeedsInfo}
                icon={<QuestionCircleOutlined />}
              >
                Request More Info
              </Button>
              <Button onClick={() => setIsNeedsInfoModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Mark Items Ordered Modal (bulk) */}
      <Modal
        title="Mark Items as Ordered"
        open={isOrderedModalVisible}
        onCancel={() => setIsOrderedModalVisible(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        {pendingItems.length === 0 ? (
          <Empty description="No pending items" />
        ) : (
          <Form form={orderedForm} layout="vertical" onFinish={handleMarkOrderedSubmit}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {pendingItems.map((item) => (
                <Card
                  key={item.id}
                  size="small"
                  title={item.description}
                  extra={
                    item.part_number ? (
                      <Text type="secondary">PN: {item.part_number}</Text>
                    ) : null
                  }
                >
                  <Row gutter={12}>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name={['items', item.id, 'vendor']}
                        label="Vendor"
                      >
                        <Input placeholder="Vendor name" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name={['items', item.id, 'tracking_number']}
                        label="Tracking #"
                      >
                        <Input placeholder="Tracking number" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name={['items', item.id, 'expected_delivery_date']}
                        label="Expected Delivery"
                      >
                        <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ))}
              <Form.Item style={{ marginBottom: 0 }}>
                <Space>
                  <Button type="primary" htmlType="submit" loading={markingOrdered}>
                    Mark {pendingItems.length} Item{pendingItems.length === 1 ? '' : 's'} Ordered
                  </Button>
                  <Button onClick={() => setIsOrderedModalVisible(false)}>Cancel</Button>
                </Space>
              </Form.Item>
            </Space>
          </Form>
        )}
      </Modal>

      {/* Mark Items Received Modal (bulk) */}
      <Modal
        title="Mark Items as Received"
        open={isReceivedModalVisible}
        onCancel={() => setIsReceivedModalVisible(false)}
        onOk={handleMarkReceivedSubmit}
        okText="Mark Received"
        confirmLoading={markingReceived}
        okButtonProps={{ disabled: selectedReceivedIds.length === 0 }}
        width={600}
        destroyOnClose
      >
        {orderedOrShippedItems.length === 0 ? (
          <Empty description="No items are currently ordered or shipped" />
        ) : (
          <>
            <Text type="secondary">
              Select the items that have been received:
            </Text>
            <Checkbox.Group
              value={selectedReceivedIds}
              onChange={(values) => setSelectedReceivedIds(values as number[])}
              style={{ display: 'block', marginTop: 12 }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {orderedOrShippedItems.map((item) => (
                  <Checkbox key={item.id} value={item.id}>
                    <Space>
                      <Text strong>{item.description}</Text>
                      <StatusBadge status={item.status} type="item" />
                      {item.vendor && <Text type="secondary">({item.vendor})</Text>}
                    </Space>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </>
        )}
      </Modal>

      {/* Cancel Items Modal (bulk) */}
      <Modal
        title="Cancel Items"
        open={isCancelItemsModalVisible}
        onCancel={() => setIsCancelItemsModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        {cancellableItems.length === 0 ? (
          <Empty description="No items are eligible for cancellation" />
        ) : (
          <Form
            form={cancelItemsForm}
            layout="vertical"
            onFinish={handleCancelItemsSubmit}
          >
            <Form.Item
              name="item_ids"
              label="Select items to cancel"
              rules={[
                {
                  required: true,
                  message: 'Select at least one item',
                  type: 'array',
                  min: 1,
                },
              ]}
            >
              <Checkbox.Group style={{ display: 'block' }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {cancellableItems.map((item) => (
                    <Checkbox key={item.id} value={item.id}>
                      <Space>
                        <Text strong>{item.description}</Text>
                        <StatusBadge status={item.status} type="item" />
                      </Space>
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </Form.Item>
            <Form.Item
              name="cancellation_reason"
              label="Reason"
              rules={[
                { required: true, message: 'Please provide a reason for cancellation' },
                {
                  validator: (_, value) =>
                    value && value.trim().length > 0
                      ? Promise.resolve()
                      : Promise.reject(new Error('Reason cannot be empty')),
                },
              ]}
            >
              <TextArea rows={3} placeholder="Why are these items being cancelled?" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button danger type="primary" htmlType="submit" loading={cancellingItems}>
                  Cancel Items
                </Button>
                <Button onClick={() => setIsCancelItemsModalVisible(false)}>
                  Keep Items
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Single-item Mark Ordered Modal */}
      <Modal
        title="Mark Item as Ordered"
        open={singleOrderItemId !== null}
        onCancel={closeSingleOrderModal}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Form form={singleOrderForm} layout="vertical" onFinish={handleSingleOrderSubmit}>
          <Form.Item name="vendor" label="Vendor">
            <Input placeholder="Vendor name" />
          </Form.Item>
          <Form.Item name="tracking_number" label="Tracking #">
            <Input placeholder="Tracking number" />
          </Form.Item>
          <Form.Item name="expected_delivery_date" label="Expected Delivery">
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={submittingSingleOrder}
                icon={<ShoppingCartOutlined />}
              >
                Mark Ordered
              </Button>
              <Button onClick={closeSingleOrderModal}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Single-item Cancel Modal */}
      <Modal
        title="Cancel Item"
        open={singleCancelItemId !== null}
        onCancel={closeSingleCancelModal}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form form={singleCancelForm} layout="vertical" onFinish={handleSingleCancelSubmit}>
          <Form.Item
            name="cancellation_reason"
            label="Cancellation reason"
            rules={[
              { required: true, message: 'Please provide a reason' },
              {
                validator: (_, value) =>
                  value && value.trim().length > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error('Reason cannot be empty')),
              },
            ]}
          >
            <TextArea rows={3} placeholder="Why is this item being cancelled?" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button
                danger
                type="primary"
                htmlType="submit"
                loading={submittingSingleCancel}
                icon={<StopOutlined />}
              >
                Cancel Item
              </Button>
              <Button onClick={closeSingleCancelModal}>Keep Item</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
