import { useState } from 'react';
import { Button, Empty, List, Space, Tabs, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { MobilePageScaffold } from '@shared/components/mobile/MobilePageScaffold';
import { useAppSelector } from '@app/hooks';
import { PermissionGuard } from '@features/auth/components/PermissionGuard';
import { usePermission } from '@features/auth/hooks/usePermission';
import {
  useListInboundTransfersQuery,
  useListOutboundTransfersQuery,
  useListTransfersQuery,
} from '../../services/transfersApi';
import { InitiateTransferModal } from '../InitiateTransferModal';
import { ReceiveTransferModal } from '../ReceiveTransferModal';
import { CancelTransferModal } from '../CancelTransferModal';
import { TransferStatusTag } from '../TransferStatusTag';
import type { Transfer } from '../../types';

const { Text, Title } = Typography;

const TransferItem = ({
  transfer,
  onReceive,
  onCancel,
  canReceive,
  canCancel,
}: {
  transfer: Transfer;
  onReceive?: (t: Transfer) => void;
  onCancel?: (t: Transfer) => void;
  canReceive: boolean;
  canCancel: boolean;
}) => {
  return (
    <List.Item
      actions={[
        canReceive && transfer.status === 'pending_receipt' && onReceive ? (
          <Button key="rcv" type="primary" size="small" onClick={() => onReceive(transfer)}>
            Receive
          </Button>
        ) : null,
        canCancel && transfer.status === 'pending_receipt' && onCancel ? (
          <Button key="cxl" danger size="small" onClick={() => onCancel(transfer)}>
            Cancel
          </Button>
        ) : null,
      ].filter(Boolean)}
    >
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        <Space>
          <Tag>{transfer.item_type}</Tag>
          <Text strong>
            {transfer.item_snapshot?.description ||
              transfer.item_snapshot?.identifier ||
              `ID ${transfer.item_id}`}
          </Text>
          <TransferStatusTag status={transfer.status} />
        </Space>
        <Text type="secondary">
          {transfer.from_warehouse} → {transfer.to_warehouse} · Qty {transfer.quantity}
        </Text>
        <Text type="secondary">by {transfer.transferred_by}</Text>
      </Space>
    </List.Item>
  );
};

export const MobileTransfersPage = () => {
  const currentUserId = useAppSelector((s) => s.auth.user?.id);
  const isAdmin = useAppSelector((s) => s.auth.user?.is_admin);
  const canReceive = usePermission('transfer.receive') || Boolean(isAdmin);
  const canCancelOwn = usePermission('transfer.cancel_own');

  const [tab, setTab] = useState<'inbound' | 'outbound' | 'history'>('inbound');
  const inbound = useListInboundTransfersQuery({ page: 1, per_page: 50 });
  const outbound = useListOutboundTransfersQuery({ page: 1, per_page: 50 });
  const history = useListTransfersQuery({ page: 1, per_page: 50 });

  const [initiateOpen, setInitiateOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<Transfer | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Transfer | null>(null);

  const canCancelRow = (t: Transfer) =>
    Boolean(isAdmin) || (canCancelOwn && t.transferred_by_id === currentUserId);

  const rows =
    tab === 'inbound'
      ? inbound.data?.transfers
      : tab === 'outbound'
      ? outbound.data?.transfers
      : history.data?.transfers;

  return (
    <MobilePageScaffold
      header={
        <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>
            Transfers
          </Title>
          <PermissionGuard permission="transfer.initiate">
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setInitiateOpen(true)}
            >
              New
            </Button>
          </PermissionGuard>
        </div>
      }
      sticky={
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as typeof tab)}
          items={[
            {
              key: 'inbound',
              label: `Inbound${inbound.data?.total ? ` (${inbound.data.total})` : ''}`,
            },
            { key: 'outbound', label: 'Outbound' },
            { key: 'history', label: 'History' },
          ]}
        />
      }
    >
      {rows && rows.length > 0 ? (
        <List
          dataSource={rows}
          renderItem={(t) => (
            <TransferItem
              key={t.id}
              transfer={t}
              onReceive={setReceiveTarget}
              onCancel={setCancelTarget}
              canReceive={canReceive}
              canCancel={canCancelRow(t)}
            />
          )}
        />
      ) : (
        <Empty description="No transfers" style={{ marginTop: 32 }} />
      )}

      <InitiateTransferModal open={initiateOpen} onClose={() => setInitiateOpen(false)} />
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
    </MobilePageScaffold>
  );
};
