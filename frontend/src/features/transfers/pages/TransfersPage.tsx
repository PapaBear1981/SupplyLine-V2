import { useState } from 'react';
import { Button, Space, Tabs, Tag, Typography } from 'antd';
import { PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { useAppSelector } from '@app/hooks';
import { useIsMobile } from '@shared/hooks/useMobile';
import { PermissionGuard } from '@features/auth/components/PermissionGuard';
import { usePermission } from '@features/auth/hooks/usePermission';
import { useActiveWarehouse } from '@features/warehouses/hooks/useActiveWarehouse';
import { MobileTransfersPage } from '../components/mobile/MobileTransfersPage';
import {
  useListInboundTransfersQuery,
  useListOutboundTransfersQuery,
  useListTransfersQuery,
} from '../services/transfersApi';
import { TransfersTable } from '../components/TransfersTable';
import { InitiateTransferModal } from '../components/InitiateTransferModal';
import { ReceiveTransferModal } from '../components/ReceiveTransferModal';
import { CancelTransferModal } from '../components/CancelTransferModal';
import type { Transfer } from '../types';

const { Title, Text } = Typography;

export const TransfersPage = () => {
  const isMobile = useIsMobile();
  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  const canView = usePermission('transfer.view');
  const canReceive = usePermission('transfer.receive');
  const canCancelOwn = usePermission('transfer.cancel_own');
  const isAdmin = useAppSelector((s) => s.auth.user?.is_admin);

  const [tab, setTab] = useState<'inbound' | 'outbound' | 'history'>('inbound');
  const [page, setPage] = useState(1);

  const [initiateOpen, setInitiateOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<Transfer | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Transfer | null>(null);

  const { activeWarehouseId } = useActiveWarehouse();

  // Pass activeWarehouseId so RTK Query uses a warehouse-scoped cache key.
  // When the user switches warehouses the ID changes, forcing a fresh fetch.
  const inbound = useListInboundTransfersQuery({ page, per_page: 20, activeWarehouseId });
  const outbound = useListOutboundTransfersQuery({ page, per_page: 20, activeWarehouseId });
  const history = useListTransfersQuery({ page, per_page: 20, activeWarehouseId });

  if (!canView && !isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <Title level={3}>Transfers</Title>
        <Text type="secondary">You don't have permission to view transfers.</Text>
      </div>
    );
  }

  if (isMobile) {
    return <MobileTransfersPage />;
  }

  const canCancelRow = (t: Transfer) =>
    isAdmin || (canCancelOwn && t.transferred_by_id === currentUserId);

  const activeData =
    tab === 'inbound' ? inbound : tab === 'outbound' ? outbound : history;

  return (
    <div data-testid="transfers-page">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <Space>
          <Title level={2} style={{ margin: 0 }}>
            Transfers
          </Title>
        </Space>
        <Space>
          <PermissionGuard permission="transfer.initiate">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setInitiateOpen(true)}
              data-testid="transfers-create-button"
            >
              Initiate transfer
            </Button>
          </PermissionGuard>
        </Space>
      </div>

      <Tabs
        activeKey={tab}
        onChange={(k) => {
          setPage(1);
          setTab(k as typeof tab);
        }}
        items={[
          {
            key: 'inbound',
            label: (
              <Space>
                <SwapOutlined />
                Inbound
                {inbound.data?.total ? (
                  <Tag color="gold">{inbound.data.total}</Tag>
                ) : null}
              </Space>
            ),
            children: (
              <TransfersTable
                rows={inbound.data?.transfers || []}
                loading={inbound.isLoading}
                canReceive={canReceive || Boolean(isAdmin)}
                canCancel={canCancelRow}
                onReceive={setReceiveTarget}
                onCancel={setCancelTarget}
                pagination={{
                  current: page,
                  pageSize: 20,
                  total: inbound.data?.total || 0,
                  onChange: (p) => setPage(p),
                }}
              />
            ),
          },
          {
            key: 'outbound',
            label: 'Outbound',
            children: (
              <TransfersTable
                rows={outbound.data?.transfers || []}
                loading={outbound.isLoading}
                canCancel={canCancelRow}
                onCancel={setCancelTarget}
                pagination={{
                  current: page,
                  pageSize: 20,
                  total: outbound.data?.total || 0,
                  onChange: (p) => setPage(p),
                }}
              />
            ),
          },
          {
            key: 'history',
            label: 'History',
            children: (
              <TransfersTable
                rows={history.data?.transfers || []}
                loading={history.isLoading}
                pagination={{
                  current: page,
                  pageSize: 20,
                  total: history.data?.total || 0,
                  onChange: (p) => setPage(p),
                }}
              />
            ),
          },
        ]}
      />

      {activeData.error && (
        <Text type="danger" style={{ display: 'block', marginTop: 12 }}>
          Failed to load transfers.
        </Text>
      )}

      <InitiateTransferModal
        open={initiateOpen}
        onClose={() => setInitiateOpen(false)}
      />
      <ReceiveTransferModal
        open={Boolean(receiveTarget)}
        transfer={receiveTarget}
        onClose={() => setReceiveTarget(null)}
      />
      <CancelTransferModal
        open={Boolean(cancelTarget)}
        transfer={cancelTarget}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
};
