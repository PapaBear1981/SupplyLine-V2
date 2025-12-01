import { useState } from 'react';
import {
  Card,
  Tabs,
  List,
  Tag,
  Badge,
  SearchBar,
  Skeleton,
  PullToRefresh,
  FloatingBubble,
  Popup,
  Form,
  Input,
  Button,
  TextArea,
  Picker,
  Toast,
  Empty,
  Selector,
} from 'antd-mobile';
import { AddOutline, CloseOutline } from 'antd-mobile-icons';
import {
  SwapOutlined,
  WarningOutlined,
  UserOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  useGetCheckoutStatsQuery,
  useGetActiveCheckoutsQuery,
  useGetMyCheckoutsQuery,
  useGetOverdueCheckoutsQuery,
  useSearchToolsForCheckoutQuery,
  useCreateCheckoutMutation,
  useCheckinToolMutation,
} from '../../services/checkoutApi';
import type { ToolCheckout } from '../../types';
import './MobileToolCheckout.css';

dayjs.extend(relativeTime);

const conditionOptions = [
  [
    { label: 'New', value: 'New' },
    { label: 'Good', value: 'Good' },
    { label: 'Fair', value: 'Fair' },
    { label: 'Poor', value: 'Poor' },
    { label: 'Damaged', value: 'Damaged' },
  ],
];

export const MobileToolCheckout = () => {
  const [activeTab, setActiveTab] = useState('my');
  const [showCheckoutPopup, setShowCheckoutPopup] = useState(false);
  const [showCheckinPopup, setShowCheckinPopup] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState<ToolCheckout | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutForm] = Form.useForm();
  const [checkinForm] = Form.useForm();

  // API queries
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetCheckoutStatsQuery();
  const { data: activeCheckouts, isLoading: activeLoading, refetch: refetchActive } = useGetActiveCheckoutsQuery({});
  const { data: myCheckouts, isLoading: myLoading, refetch: refetchMy } = useGetMyCheckoutsQuery({});
  const { data: overdueCheckouts, isLoading: overdueLoading, refetch: refetchOverdue } = useGetOverdueCheckoutsQuery({});
  const { data: toolResults } = useSearchToolsForCheckoutQuery(searchQuery, {
    skip: searchQuery.length < 2,
  });
  const [checkoutTool, { isLoading: isCheckingOut }] = useCreateCheckoutMutation();
  const [checkinTool, { isLoading: isCheckingIn }] = useCheckinToolMutation();

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchActive(), refetchMy(), refetchOverdue()]);
  };

  const handleCheckin = (checkout: ToolCheckout) => {
    setSelectedCheckout(checkout);
    checkinForm.resetFields();
    setShowCheckinPopup(true);
  };

  const handleCheckoutSubmit = async () => {
    try {
      const values = await checkoutForm.validateFields();
      await checkoutTool({
        tool_id: values.tool_id,
        condition_at_checkout: values.condition || 'Good',
        notes: values.notes || undefined,
        work_order: values.work_order || undefined,
      }).unwrap();
      Toast.show({ content: 'Tool checked out successfully', icon: 'success' });
      setShowCheckoutPopup(false);
      checkoutForm.resetFields();
      setSearchQuery('');
      handleRefresh();
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'data' in error
        ? ((error as Record<string, unknown>).data as Record<string, unknown>)?.error as string
        : 'Failed to checkout tool';
      Toast.show({ content: errorMessage, icon: 'fail' });
    }
  };

  const handleCheckinSubmit = async () => {
    if (!selectedCheckout) return;
    try {
      const values = await checkinForm.validateFields();
      await checkinTool({
        checkoutId: selectedCheckout.id,
        data: {
          condition_at_return: values.condition || 'Good',
          return_notes: values.notes || undefined,
          damage_reported: values.damage_reported?.[0] === 'damage' || false,
          damage_description: values.damage_description || undefined,
        },
      }).unwrap();
      Toast.show({ content: 'Tool returned successfully', icon: 'success' });
      setShowCheckinPopup(false);
      setSelectedCheckout(null);
      handleRefresh();
    } catch {
      Toast.show({ content: 'Failed to return tool', icon: 'fail' });
    }
  };

  const renderCheckoutItem = (checkout: ToolCheckout, showCheckin = true) => (
    <List.Item
      key={checkout.id}
      onClick={() => showCheckin && handleCheckin(checkout)}
      prefix={
        <div className={`checkout-icon ${checkout.is_overdue ? 'overdue' : ''}`}>
          <SwapOutlined />
        </div>
      }
      description={
        <div className="checkout-item-desc">
          <span>S/N: {checkout.serial_number}</span>
          <div className="checkout-item-meta">
            {checkout.is_overdue ? (
              <Tag color="danger" fill="outline">
                {checkout.days_overdue} days overdue
              </Tag>
            ) : (
              <Tag color="primary" fill="outline">
                {dayjs(checkout.checkout_date).fromNow()}
              </Tag>
            )}
            {checkout.user_name && (
              <span className="checkout-user">{checkout.user_name}</span>
            )}
          </div>
        </div>
      }
      arrow={showCheckin}
      extra={
        showCheckin && (
          <Button size="small" color="primary" fill="outline">
            Return
          </Button>
        )
      }
    >
      <div className="checkout-item-title">{checkout.tool_number}</div>
      <div className="checkout-item-subtitle">{checkout.tool_description}</div>
    </List.Item>
  );

  const myList = myCheckouts?.checkouts || [];
  const activeList = activeCheckouts?.checkouts || [];
  const overdueList = overdueCheckouts?.checkouts || [];

  return (
    <div className="mobile-tool-checkout">
      {/* Stats Cards */}
      <div className="stats-row">
        <Card className="stat-card" onClick={() => setActiveTab('active')}>
          {statsLoading ? (
            <Skeleton.Paragraph lineCount={2} animated />
          ) : (
            <>
              <div className="stat-icon blue">
                <SwapOutlined />
              </div>
              <div className="stat-value">{stats?.active_checkouts || 0}</div>
              <div className="stat-label">Active</div>
            </>
          )}
        </Card>
        <Card className="stat-card" onClick={() => setActiveTab('overdue')}>
          {statsLoading ? (
            <Skeleton.Paragraph lineCount={2} animated />
          ) : (
            <>
              <div className={`stat-icon ${stats?.overdue_checkouts ? 'red' : 'green'}`}>
                <WarningOutlined />
              </div>
              <div className="stat-value">{stats?.overdue_checkouts || 0}</div>
              <div className="stat-label">Overdue</div>
            </>
          )}
        </Card>
        <Card className="stat-card">
          {statsLoading ? (
            <Skeleton.Paragraph lineCount={2} animated />
          ) : (
            <>
              <div className="stat-icon blue">
                <ClockCircleOutlined />
              </div>
              <div className="stat-value">{stats?.checkouts_today || 0}</div>
              <div className="stat-label">Today</div>
            </>
          )}
        </Card>
        <Card className="stat-card">
          {statsLoading ? (
            <Skeleton.Paragraph lineCount={2} animated />
          ) : (
            <>
              <div className="stat-icon green">
                <HistoryOutlined />
              </div>
              <div className="stat-value">{stats?.returns_today || 0}</div>
              <div className="stat-label">Returns</div>
            </>
          )}
        </Card>
      </div>

      {/* Tabs */}
      <PullToRefresh onRefresh={handleRefresh}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} className="checkout-tabs">
          <Tabs.Tab
            title={
              <Badge content={myList.length > 0 ? myList.length : null}>
                <span><UserOutlined /> My</span>
              </Badge>
            }
            key="my"
          >
            {myLoading ? (
              <div style={{ padding: 16 }}>
                {[1, 2, 3].map(i => <Skeleton key={i} animated className="checkout-skeleton" />)}
              </div>
            ) : myList.length === 0 ? (
              <Empty description="No active checkouts" style={{ padding: '48px 0' }} />
            ) : (
              <List>{myList.map(c => renderCheckoutItem(c))}</List>
            )}
          </Tabs.Tab>
          <Tabs.Tab
            title={
              <Badge content={activeList.length > 0 ? activeList.length : null}>
                <span><SwapOutlined /> All</span>
              </Badge>
            }
            key="active"
          >
            {activeLoading ? (
              <div style={{ padding: 16 }}>
                {[1, 2, 3].map(i => <Skeleton key={i} animated className="checkout-skeleton" />)}
              </div>
            ) : activeList.length === 0 ? (
              <Empty description="No active checkouts" style={{ padding: '48px 0' }} />
            ) : (
              <List>{activeList.map(c => renderCheckoutItem(c, false))}</List>
            )}
          </Tabs.Tab>
          <Tabs.Tab
            title={
              <Badge
                content={overdueList.length > 0 ? overdueList.length : null}
                style={{ '--background-color': '#ff4d4f' } as React.CSSProperties}
              >
                <span><WarningOutlined /> Overdue</span>
              </Badge>
            }
            key="overdue"
          >
            {overdueLoading ? (
              <div style={{ padding: 16 }}>
                {[1, 2, 3].map(i => <Skeleton key={i} animated className="checkout-skeleton" />)}
              </div>
            ) : overdueList.length === 0 ? (
              <Empty description="No overdue checkouts" style={{ padding: '48px 0' }} />
            ) : (
              <List>{overdueList.map(c => renderCheckoutItem(c))}</List>
            )}
          </Tabs.Tab>
        </Tabs>
      </PullToRefresh>

      {/* Floating Checkout Button */}
      <FloatingBubble
        style={{
          '--initial-position-bottom': '76px',
          '--initial-position-right': '16px',
          '--edge-distance': '16px',
        }}
        onClick={() => setShowCheckoutPopup(true)}
      >
        <AddOutline fontSize={24} />
      </FloatingBubble>

      {/* Checkout Popup */}
      <Popup
        visible={showCheckoutPopup}
        onMaskClick={() => setShowCheckoutPopup(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          height: '80vh',
          overflow: 'auto',
        }}
      >
        <div className="form-popup">
          <div className="form-header">
            <span>Checkout Tool</span>
            <CloseOutline onClick={() => setShowCheckoutPopup(false)} />
          </div>

          <SearchBar
            placeholder="Search tool by number or serial..."
            value={searchQuery}
            onChange={setSearchQuery}
            style={{ marginBottom: 16 }}
          />

          {searchQuery.length >= 2 && toolResults && toolResults.tools.length > 0 && (
            <List header="Available Tools" className="tool-search-results">
              {toolResults.tools.filter((t) => t.available).map((tool) => (
                <List.Item
                  key={tool.id}
                  onClick={() => {
                    checkoutForm.setFieldValue('tool_id', tool.id);
                    checkoutForm.setFieldValue('tool_display', `${tool.tool_number} - ${tool.description}`);
                    setSearchQuery('');
                  }}
                  description={`S/N: ${tool.serial_number} | ${tool.condition}`}
                >
                  {tool.tool_number} - {tool.description}
                </List.Item>
              ))}
            </List>
          )}

          <Form
            form={checkoutForm}
            layout="vertical"
            footer={
              <Button
                block
                color="primary"
                loading={isCheckingOut}
                onClick={handleCheckoutSubmit}
              >
                Checkout Tool
              </Button>
            }
          >
            <Form.Item name="tool_id" hidden><Input /></Form.Item>
            <Form.Item
              name="tool_display"
              label="Selected Tool"
              rules={[{ required: true, message: 'Please select a tool' }]}
            >
              <Input placeholder="Search and select a tool above" readOnly />
            </Form.Item>
            <Form.Item
              name="condition"
              label="Condition at Checkout"
              trigger="onConfirm"
              onClick={(_e, pickerRef) => pickerRef.current?.open()}
            >
              <Picker columns={conditionOptions}>
                {(items) => items[0]?.label || 'Good'}
              </Picker>
            </Form.Item>
            <Form.Item name="work_order" label="Work Order">
              <Input placeholder="Enter work order (optional)" />
            </Form.Item>
            <Form.Item name="notes" label="Notes">
              <TextArea placeholder="Additional notes (optional)" rows={2} />
            </Form.Item>
          </Form>
        </div>
      </Popup>

      {/* Checkin Popup */}
      <Popup
        visible={showCheckinPopup}
        onMaskClick={() => setShowCheckinPopup(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <div className="form-popup">
          <div className="form-header">
            <span>Return Tool</span>
            <CloseOutline onClick={() => setShowCheckinPopup(false)} />
          </div>

          {selectedCheckout && (
            <Card className="selected-tool-card">
              <div className="selected-tool-info">
                <strong>{selectedCheckout.tool_number}</strong>
                <span>{selectedCheckout.tool_description}</span>
                <span className="text-secondary">S/N: {selectedCheckout.serial_number}</span>
              </div>
            </Card>
          )}

          <Form
            form={checkinForm}
            layout="vertical"
            footer={
              <Button
                block
                color="primary"
                loading={isCheckingIn}
                onClick={handleCheckinSubmit}
              >
                Return Tool
              </Button>
            }
          >
            <Form.Item
              name="condition"
              label="Condition at Return"
              trigger="onConfirm"
              onClick={(_e, pickerRef) => pickerRef.current?.open()}
            >
              <Picker columns={conditionOptions}>
                {(items) => items[0]?.label || 'Good'}
              </Picker>
            </Form.Item>
            <Form.Item name="notes" label="Return Notes">
              <TextArea placeholder="Any notes about the return" rows={2} />
            </Form.Item>
            <Form.Item
              name="damage_reported"
              label="Report Damage?"
            >
              <Selector
                options={[
                  { label: 'No Damage', value: 'no_damage' },
                  { label: 'Report Damage', value: 'damage' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="damage_description"
              label="Damage Description"
              dependencies={['damage_reported']}
            >
              <TextArea placeholder="Describe the damage..." rows={3} />
            </Form.Item>
          </Form>
        </div>
      </Popup>
    </div>
  );
};
