import { useState, useEffect } from 'react';
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
import { AddOutline, CloseOutline, DeleteOutline } from 'antd-mobile-icons';
import {
  SwapOutlined,
  WarningOutlined,
  UserOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  ShoppingCartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  useGetCheckoutStatsQuery,
  useGetActiveCheckoutsQuery,
  useGetOverdueCheckoutsQuery,
  useGetDueTodayCheckoutsQuery,
  useSearchToolsForCheckoutQuery,
  useCreateCheckoutMutation,
  useBatchCheckoutMutation,
  useCheckinToolMutation,
  useLazyGetToolActiveCheckoutQuery,
} from '../../services/checkoutApi';
import { useLazyGetUsersQuery } from '@features/users/services/usersApi';
import type { User } from '@features/users/types';
import type { ToolCheckout, ToolSearchResult, BatchCheckoutResult } from '../../types';
import { useScanner } from '@features/scanner';
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
  const [activeTab, setActiveTab] = useState('active');
  const [showCheckoutPopup, setShowCheckoutPopup] = useState(false);
  const [showCheckinPopup, setShowCheckinPopup] = useState(false);
  const [showResultsPopup, setShowResultsPopup] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState<ToolCheckout | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [cartItems, setCartItems] = useState<ToolSearchResult[]>([]);
  const [batchResults, setBatchResults] = useState<BatchCheckoutResult[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [checkoutForm] = Form.useForm();
  const [checkinForm] = Form.useForm();
  const { openScanner } = useScanner();

  // API queries
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetCheckoutStatsQuery();
  const { data: activeCheckouts, isLoading: activeLoading, refetch: refetchActive } = useGetActiveCheckoutsQuery({});
  const { data: overdueCheckouts, isLoading: overdueLoading, refetch: refetchOverdue } = useGetOverdueCheckoutsQuery({});
  const { data: dueTodayCheckouts, isLoading: dueTodayLoading, refetch: refetchDueToday } = useGetDueTodayCheckoutsQuery({});
  const { data: toolResults } = useSearchToolsForCheckoutQuery(searchQuery, {
    skip: searchQuery.length < 2,
  });
  const [searchUsers, { data: userResults }] = useLazyGetUsersQuery();
  const [checkoutTool, { isLoading: isCheckingOut }] = useCreateCheckoutMutation();
  const [batchCheckout, { isLoading: isBatchingOut }] = useBatchCheckoutMutation();
  const [checkinTool, { isLoading: isCheckingIn }] = useCheckinToolMutation();
  const [fetchActiveCheckout] = useLazyGetToolActiveCheckoutQuery();

  const isSubmitting = isCheckingOut || isBatchingOut;

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchActive(), refetchOverdue(), refetchDueToday()]);
  };

  // Debounced user search (300ms)
  useEffect(() => {
    if (userSearchQuery.length >= 2) {
      const timer = setTimeout(() => {
        searchUsers({ q: userSearchQuery });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [userSearchQuery, searchUsers]);

  const handleAddToCart = (tool: ToolSearchResult) => {
    if (cartItems.find(t => t.id === tool.id)) {
      Toast.show({ content: 'Tool already in cart', icon: 'fail' });
      return;
    }
    if (cartItems.length === 0 && tool.location) {
      checkoutForm.setFieldsValue({ location: tool.location });
    }
    setCartItems(prev => [...prev, tool]);
    setSearchQuery('');
  };

  const handleRemoveFromCart = (toolId: number) => {
    setCartItems(prev => prev.filter(t => t.id !== toolId));
  };

  const handleScanTool = () => {
    openScanner({
      title: 'Scan tool to add to cart',
      accept: ['tool'],
      onResolved: (result) => {
        const data = result.itemData ?? {};
        const toolNumber =
          typeof data['tool_number'] === 'string'
            ? String(data['tool_number'])
            : `Tool #${result.itemId}`;
        const description =
          typeof data['description'] === 'string' ? String(data['description']) : '';
        if (cartItems.find(t => t.id === result.itemId)) {
          Toast.show({ content: 'Tool already in cart', icon: 'fail' });
          return;
        }
        const scannedTool: ToolSearchResult = {
          id: result.itemId,
          tool_number: toolNumber,
          serial_number:
            typeof data['serial_number'] === 'string' ? String(data['serial_number']) : '',
          description,
          category: '',
          condition: typeof data['condition'] === 'string' ? String(data['condition']) : 'Good',
          status: 'available',
          calibration_status: 'ok',
          available: true,
          checked_out_to: null,
          location: typeof data['location'] === 'string' ? String(data['location']) : null,
        };
        if (cartItems.length === 0) {
          const loc = typeof data['location'] === 'string' ? String(data['location']) : '';
          if (loc) checkoutForm.setFieldsValue({ location: loc });
        }
        setCartItems(prev => [...prev, scannedTool]);
        setShowCheckoutPopup(true);
      },
    });
  };

  const handleScanReturn = () => {
    openScanner({
      title: 'Scan tool to return',
      accept: ['tool'],
      onResolved: async (result) => {
        try {
          const { data } = await fetchActiveCheckout(result.itemId);
          if (!data?.checkout) {
            Toast.show({ icon: 'fail', content: 'This tool is not currently checked out' });
            return;
          }
          handleCheckin(data.checkout);
        } catch {
          Toast.show({ icon: 'fail', content: 'This tool is not currently checked out' });
        }
      },
    });
  };

  const resetCheckoutState = () => {
    setShowCheckoutPopup(false);
    setCartItems([]);
    setSelectedUser(null);
    setSearchQuery('');
    setUserSearchQuery('');
    checkoutForm.resetFields();
  };

  const handleCheckin = (checkout: ToolCheckout) => {
    setSelectedCheckout(checkout);
    checkinForm.resetFields();
    setShowCheckinPopup(true);
  };

  const handleCheckoutSubmit = async () => {
    if (cartItems.length === 0) {
      Toast.show({ content: 'Add at least one tool to the cart', icon: 'fail' });
      return;
    }
    if (!selectedUser) {
      Toast.show({ content: 'Please select who is checking out', icon: 'fail' });
      return;
    }

    const values = await checkoutForm.validateFields();

    const conditionVal = Array.isArray(values.condition) ? values.condition[0] : values.condition;
    if (cartItems.length === 1) {
      // Single checkout — same as before
      try {
        await checkoutTool({
          tool_id: cartItems[0].id,
          user_id: selectedUser.id,
          condition_at_checkout: conditionVal || 'Good',
          notes: values.notes || undefined,
          work_order: values.work_order || undefined,
          location: values.location || undefined,
        }).unwrap();
        Toast.show({ content: `Checked out to ${selectedUser.name}`, icon: 'success' });
        resetCheckoutState();
        handleRefresh();
      } catch (error: unknown) {
        const msg =
          error && typeof error === 'object' && 'data' in error
            ? ((error as Record<string, unknown>).data as Record<string, unknown>)
                ?.error as string
            : 'Failed to checkout tool';
        Toast.show({ content: msg, icon: 'fail' });
      }
    } else {
      // Batch checkout
      try {
        const result = await batchCheckout({
          tool_ids: cartItems.map(t => t.id),
          user_id: selectedUser.id,
          condition_at_checkout: conditionVal || 'Good',
          notes: values.notes || undefined,
          work_order: values.work_order || undefined,
          location: values.location || undefined,
        }).unwrap();
        setBatchResults(result.results);
        resetCheckoutState();
        setShowResultsPopup(true);
        handleRefresh();
      } catch {
        Toast.show({ content: 'Batch checkout failed', icon: 'fail' });
      }
    }
  };

  const handleCheckinSubmit = async () => {
    if (!selectedCheckout) return;
    try {
      const values = await checkinForm.validateFields();
      const conditionVal = Array.isArray(values.condition) ? values.condition[0] : values.condition;
      await checkinTool({
        checkoutId: selectedCheckout.id,
        data: {
          condition_at_return: conditionVal || 'Good',
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

  const activeList = activeCheckouts?.checkouts || [];
  const overdueList = overdueCheckouts?.checkouts || [];
  const dueTodayList = dueTodayCheckouts?.checkouts || [];

  return (
    <div className="mobile-tool-checkout">
      {/* Stats Cards */}
      <div className="stats-row">
        <Card className="stat-card" onClick={() => setActiveTab('active')}>
          {statsLoading ? (
            <Skeleton.Paragraph lineCount={2} animated />
          ) : (
            <>
              <div className="stat-icon blue"><SwapOutlined /></div>
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
              <div className="stat-icon blue"><ClockCircleOutlined /></div>
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
              <div className="stat-icon green"><HistoryOutlined /></div>
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
              <Badge content={activeList.length > 0 ? activeList.length : null}>
                <span><SwapOutlined /> Active</span>
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
              <List>{activeList.map(c => renderCheckoutItem(c))}</List>
            )}
          </Tabs.Tab>
          <Tabs.Tab
            title={
              <Badge
                content={dueTodayList.length > 0 ? dueTodayList.length : null}
                style={{ '--background-color': '#faad14' } as React.CSSProperties}
              >
                <span><ClockCircleOutlined /> Due Today</span>
              </Badge>
            }
            key="due-today"
          >
            {dueTodayLoading ? (
              <div style={{ padding: 16 }}>
                {[1, 2, 3].map(i => <Skeleton key={i} animated className="checkout-skeleton" />)}
              </div>
            ) : dueTodayList.length === 0 ? (
              <Empty description="Nothing due back today" style={{ padding: '48px 0' }} />
            ) : (
              <List>{dueTodayList.map(c => renderCheckoutItem(c))}</List>
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

      {/* FAB — Scan to Return */}
      <FloatingBubble
        style={{
          '--initial-position-bottom': '156px',
          '--initial-position-right': '16px',
          '--edge-distance': '16px',
          '--background': '#52c41a',
        } as React.CSSProperties}
        onClick={handleScanReturn}
      >
        <SwapOutlined style={{ fontSize: 22 }} />
      </FloatingBubble>

      {/* FAB — shows cart icon + count when tools are in cart */}
      <FloatingBubble
        style={{
          '--initial-position-bottom': '88px',
          '--initial-position-right': '16px',
          '--edge-distance': '16px',
        }}
        onClick={() => setShowCheckoutPopup(true)}
      >
        {cartItems.length > 0 ? (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCartOutlined style={{ fontSize: 24 }} />
            <span style={{
              position: 'absolute', top: -10, right: -10,
              background: '#ff4d4f', color: '#fff', borderRadius: '50%',
              width: 18, height: 18, fontSize: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, lineHeight: 1,
            }}>
              {cartItems.length}
            </span>
          </div>
        ) : (
          <AddOutline fontSize={24} />
        )}
      </FloatingBubble>

      {/* Checkout Popup */}
      <Popup
        visible={showCheckoutPopup}
        onMaskClick={() => setShowCheckoutPopup(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          height: '85vh',
          overflow: 'auto',
        }}
      >
        <div className="form-popup">
          <div className="form-header">
            <span>Checkout Tool{cartItems.length !== 1 ? 's' : ''}</span>
            <CloseOutline onClick={() => setShowCheckoutPopup(false)} />
          </div>

          {/* Tool search — adds to cart */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <SearchBar
                placeholder="Search tool by number or serial..."
                value={searchQuery}
                onChange={setSearchQuery}
              />
            </div>
            <Button size="small" fill="outline" onClick={handleScanTool}>
              Scan
            </Button>
          </div>

          {searchQuery.length >= 2 && toolResults && toolResults.tools.length > 0 && (
            <List header="Tap to add to cart" className="tool-search-results">
              {toolResults.tools.filter(t => t.available).map(tool => (
                <List.Item
                  key={tool.id}
                  onClick={() => handleAddToCart(tool)}
                  description={`S/N: ${tool.serial_number} | ${tool.condition}`}
                  extra={
                    cartItems.find(c => c.id === tool.id)
                      ? <Tag color="success">Added</Tag>
                      : <Tag color="primary">+ Add</Tag>
                  }
                >
                  {tool.tool_number} — {tool.description}
                </List.Item>
              ))}
            </List>
          )}

          {/* Cart */}
          {cartItems.length > 0 && (
            <div className="checkout-cart">
              <div className="cart-header">
                <ShoppingCartOutlined />
                <span>Cart — {cartItems.length} tool{cartItems.length !== 1 ? 's' : ''}</span>
              </div>
              <List className="cart-list">
                {cartItems.map(tool => (
                  <List.Item
                    key={tool.id}
                    description={tool.serial_number ? `S/N: ${tool.serial_number}` : undefined}
                    extra={
                      <Button
                        size="mini"
                        color="danger"
                        fill="none"
                        onClick={() => handleRemoveFromCart(tool.id)}
                      >
                        <DeleteOutline />
                      </Button>
                    }
                  >
                    <span className="cart-tool-number">{tool.tool_number}</span>
                    {tool.description && (
                      <span className="cart-tool-desc"> · {tool.description}</span>
                    )}
                  </List.Item>
                ))}
              </List>
            </div>
          )}

          {/* User search */}
          <SearchBar
            placeholder="Search user by name or employee number..."
            value={userSearchQuery}
            onChange={setUserSearchQuery}
            style={{ marginBottom: 12, marginTop: 16 }}
          />

          {userSearchQuery.length >= 2 && userResults && userResults.length > 0 && (
            <List header="Select User" className="user-search-results">
              {userResults.filter(u => u.is_active).map(user => (
                <List.Item
                  key={user.id}
                  onClick={() => {
                    setSelectedUser(user);
                    setUserSearchQuery('');
                  }}
                  description={user.department || 'No department'}
                >
                  {user.name} #{user.employee_number}
                </List.Item>
              ))}
            </List>
          )}

          {selectedUser && (
            <Card style={{
              marginBottom: 12,
              background: 'rgba(82, 196, 26, 0.08)',
              borderColor: '#52c41a',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    <UserOutlined /> {selectedUser.name}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    #{selectedUser.employee_number}
                    {selectedUser.department && ` · ${selectedUser.department}`}
                  </div>
                </div>
                <Button size="small" onClick={() => setSelectedUser(null)}>Change</Button>
              </div>
            </Card>
          )}

          {/* Checkout details — applied to all tools in cart */}
          <Form
            form={checkoutForm}
            layout="vertical"
            footer={
              <Button
                block
                color="primary"
                loading={isSubmitting}
                disabled={cartItems.length === 0 || !selectedUser}
                onClick={handleCheckoutSubmit}
              >
                {cartItems.length > 1
                  ? `Checkout ${cartItems.length} Tools`
                  : 'Checkout Tool'}
              </Button>
            }
          >
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
            <Form.Item name="location" label="Checkout Location">
              <Input placeholder="Where is this tool going? (e.g. Hangar 3, Bay 12)" />
            </Form.Item>
            <Form.Item name="notes" label="Notes">
              <TextArea
                placeholder={
                  cartItems.length > 1
                    ? 'Notes applied to all tools (optional)'
                    : 'Additional notes (optional)'
                }
                rows={2}
              />
            </Form.Item>
          </Form>
        </div>
      </Popup>

      {/* Batch Results Popup */}
      <Popup
        visible={showResultsPopup}
        onMaskClick={() => setShowResultsPopup(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '70vh',
          overflow: 'auto',
        }}
      >
        <div className="form-popup">
          <div className="form-header">
            <span>Checkout Results</span>
            <CloseOutline onClick={() => setShowResultsPopup(false)} />
          </div>
          {batchResults && (
            <>
              <div className="batch-summary">
                <span className="batch-success">
                  <CheckCircleOutlined /> {batchResults.filter(r => r.success).length} succeeded
                </span>
                {batchResults.some(r => !r.success) && (
                  <span className="batch-failure">
                    <CloseCircleOutlined /> {batchResults.filter(r => !r.success).length} failed
                  </span>
                )}
              </div>
              <List>
                {batchResults.map(result => (
                  <List.Item
                    key={result.tool_id}
                    prefix={
                      result.success
                        ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                        : <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                    }
                    description={
                      <span style={{ color: result.success ? '#52c41a' : '#ff4d4f', fontSize: 12 }}>
                        {result.success ? 'Checked out successfully' : result.error}
                      </span>
                    }
                  >
                    <span style={{ fontWeight: 600 }}>
                      {result.tool_number || `Tool #${result.tool_id}`}
                    </span>
                  </List.Item>
                ))}
              </List>
              <Button
                block
                color="primary"
                style={{ marginTop: 16 }}
                onClick={() => setShowResultsPopup(false)}
              >
                Done
              </Button>
            </>
          )}
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
            <Form.Item name="damage_reported" label="Report Damage?">
              <Selector
                options={[
                  { label: 'No Damage', value: 'no_damage' },
                  { label: 'Report Damage', value: 'damage' },
                ]}
              />
            </Form.Item>
            <Form.Item name="damage_description" label="Damage Description">
              <TextArea placeholder="Describe the damage..." rows={3} />
            </Form.Item>
          </Form>
        </div>
      </Popup>
    </div>
  );
};
