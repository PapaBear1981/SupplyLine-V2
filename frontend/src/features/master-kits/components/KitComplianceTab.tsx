import { useState } from 'react';
import {
  Alert, Button, Card, Col, Empty, Progress, Row, Space, Statistic, Table, Tag, Typography,
  Tooltip,
} from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, ShoppingCartOutlined, ImportOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  useGetKitComplianceQuery,
  useSyncKitFromMasterMutation,
} from '../services/masterKitsApi';
import type {
  KitComplianceMissing, KitComplianceExtra, KitComplianceDeviation,
} from '../../kits/types';

const { Text } = Typography;

interface Props {
  kitId: number;
  onCreateReorder?: (item: KitComplianceMissing) => void;
}

/**
 * Compliance tab: shows how a kit deviates from its master kit definition.
 * Hidden gracefully when the kit isn't linked to a master.
 */
export function KitComplianceTab({ kitId, onCreateReorder }: Props) {
  const { data, isLoading, refetch } = useGetKitComplianceQuery(kitId);
  const [syncFromMaster, { isLoading: syncing }] = useSyncKitFromMasterMutation();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return <Card loading data-testid="kit-compliance-tab" />;
  }

  if (!data || !data.linked_to_master) {
    return (
      <Empty
        description={
          <Space direction="vertical" size={4}>
            <Text strong>Kit is not linked to a master kit list</Text>
            <Text type="secondary">
              Link this kit to its aircraft type's master to track compliance.
            </Text>
          </Space>
        }
        data-testid="kit-compliance-not-linked"
      />
    );
  }

  const totalMissing = data.missing.length;
  const totalDeviations = data.deviations.length;
  const totalExtras = data.extras.length;

  const missingColumns: ColumnsType<KitComplianceMissing> = [
    {
      title: 'Part #',
      dataIndex: 'part_number',
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'entry_type',
      render: (v) => <Tag>{v}</Tag>,
    },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    {
      title: 'Required',
      dataIndex: 'required_quantity',
      align: 'right',
      render: (v, row) => `${v} ${row.unit}`,
    },
    {
      title: '',
      width: 160,
      render: (_v, row) => (
        <Space size={4}>
          {onCreateReorder && (
            <Tooltip title="Create a reorder request for this part">
              <Button
                size="small"
                icon={<ShoppingCartOutlined />}
                onClick={() => onCreateReorder(row)}
                data-testid={`compliance-reorder-${row.master_entry_id}`}
              >
                Reorder
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Transfer in from warehouse (coming soon)">
            <Button
              size="small"
              icon={<ImportOutlined />}
              disabled
              data-testid={`compliance-transfer-${row.master_entry_id}`}
            >
              Transfer in
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const deviationColumns: ColumnsType<KitComplianceDeviation> = [
    { title: 'Part #', dataIndex: 'part_number' },
    { title: 'Type', dataIndex: 'entry_type', render: (v) => <Tag>{v}</Tag> },
    { title: 'Expected', dataIndex: 'expected_quantity', align: 'right' },
    {
      title: 'Actual',
      dataIndex: 'actual_quantity',
      align: 'right',
      render: (v, row) => (
        <Text type={v < row.expected_quantity ? 'warning' : undefined}>{v}</Text>
      ),
    },
    { title: 'Reason', dataIndex: 'reason' },
  ];

  const extrasColumns: ColumnsType<KitComplianceExtra> = [
    { title: 'Part #', dataIndex: 'part_number' },
    { title: 'Type', dataIndex: 'entry_type', render: (v) => <Tag>{v}</Tag> },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    { title: 'Qty', dataIndex: 'quantity', align: 'right' },
    {
      title: '',
      width: 90,
      render: (_v, row) =>
        row.is_orphan ? (
          <Tag color="orange" data-testid={`compliance-extra-orphan-${row.kit_row_id}`}>Orphaned</Tag>
        ) : (
          <Tag>Custom</Tag>
        ),
    },
  ];

  const pct = data.percent_compliant ?? 100;
  const status: 'success' | 'normal' | 'exception' =
    pct >= 95 ? 'success' : pct >= 70 ? 'normal' : 'exception';

  return (
    <div data-testid="kit-compliance-tab">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Compliance"
              value={pct}
              suffix="%"
              valueStyle={{ color: status === 'success' ? '#3f8600' : status === 'normal' ? '#1677ff' : '#cf1322' }}
            />
            <Progress
              percent={pct}
              status={status === 'exception' ? 'exception' : status === 'success' ? 'success' : 'active'}
              showInfo={false}
              data-testid="kit-compliance-progress"
            />
          </Card>
        </Col>
        <Col xs={12} md={5}>
          <Card>
            <Statistic
              title="Missing"
              value={totalMissing}
              prefix={<ExclamationCircleOutlined style={{ color: totalMissing > 0 ? '#cf1322' : undefined }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={5}>
          <Card>
            <Statistic
              title="Deviations"
              value={totalDeviations}
              prefix={<ExclamationCircleOutlined style={{ color: totalDeviations > 0 ? '#faad14' : undefined }} />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Extras / Custom"
              value={totalExtras}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {data.master_kit_name && (
        <Alert
          message={
            <span>
              Linked to master: <Text strong>{data.master_kit_name}</Text>
            </span>
          }
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          action={
            <Button
              size="small"
              loading={syncing}
              onClick={async () => {
                await syncFromMaster({ kitId }).unwrap();
                refetch();
              }}
              data-testid="kit-compliance-sync"
            >
              Re-sync from master
            </Button>
          }
        />
      )}

      <Card title={<span>Missing items <Tag color={totalMissing > 0 ? 'red' : 'green'}>{totalMissing}</Tag></span>}
            style={{ marginBottom: 12 }}
            data-testid="compliance-missing-list">
        {totalMissing === 0 ? (
          <Empty description="Nothing missing" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table<KitComplianceMissing>
            rowKey="master_entry_id"
            size="small"
            pagination={false}
            dataSource={showAll ? data.missing : data.missing.slice(0, 10)}
            columns={missingColumns}
            footer={() => data.missing.length > 10 ? (
              <Button type="link" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show top 10' : `Show all ${data.missing.length}`}
              </Button>
            ) : null}
          />
        )}
      </Card>

      {totalDeviations > 0 && (
        <Card title={<span>Quantity deviations <Tag color="orange">{totalDeviations}</Tag></span>}
              style={{ marginBottom: 12 }}
              data-testid="compliance-deviations-list">
          <Table<KitComplianceDeviation>
            rowKey="master_entry_id"
            size="small"
            pagination={false}
            dataSource={data.deviations}
            columns={deviationColumns}
          />
        </Card>
      )}

      {totalExtras > 0 && (
        <Card title={<span>Extras / Custom items <Tag>{totalExtras}</Tag></span>}
              data-testid="compliance-extras-list">
          <Table<KitComplianceExtra>
            rowKey="kit_row_id"
            size="small"
            pagination={false}
            dataSource={data.extras}
            columns={extrasColumns}
          />
        </Card>
      )}
    </div>
  );
}
