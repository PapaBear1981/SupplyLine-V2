import { useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Tooltip,
  Typography,
  Switch,
  theme,
} from 'antd';
import type { TableProps } from 'antd';
import {
  LoginOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetMyCheckoutsQuery } from '../services/checkoutApi';
import type { ToolCheckout } from '../types';
import { CheckoutDetailsDrawer } from './CheckoutDetailsDrawer';

const { Text } = Typography;

interface MyCheckoutsTableProps {
  onCheckin: (checkout: ToolCheckout) => void;
}

export const MyCheckoutsTable = ({ onCheckin }: MyCheckoutsTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [includeReturned, setIncludeReturned] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState<ToolCheckout | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { token } = theme.useToken();

  const { data, isLoading, isFetching } = useGetMyCheckoutsQuery({
    page,
    per_page: pageSize,
    include_returned: includeReturned,
  });

  const handleViewDetails = (checkout: ToolCheckout) => {
    setSelectedCheckout(checkout);
    setDetailsOpen(true);
  };

  const columns: TableProps<ToolCheckout>['columns'] = [
    {
      title: 'Tool',
      key: 'tool',
      fixed: 'left',
      width: 200,
      render: (_, record) => (
        <div>
          <Text strong>{record.tool_number}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.serial_number}
          </Text>
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'tool_description',
      key: 'description',
      ellipsis: true,
      width: 200,
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        if (record.return_date) {
          return (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Returned
            </Tag>
          );
        }
        if (record.is_overdue) {
          return (
            <Tag color="error" icon={<WarningOutlined />}>
              Overdue
            </Tag>
          );
        }
        return (
          <Tag color="processing" icon={<ClockCircleOutlined />}>
            Checked Out
          </Tag>
        );
      },
    },
    {
      title: 'Checkout Date',
      dataIndex: 'checkout_date',
      key: 'checkout_date',
      width: 150,
      render: (date) => (
        <Tooltip title={dayjs(date).format('MMM D, YYYY h:mm A')}>
          {dayjs(date).format('MMM D, YYYY')}
        </Tooltip>
      ),
      sorter: (a, b) =>
        dayjs(a.checkout_date).unix() - dayjs(b.checkout_date).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Expected Return',
      dataIndex: 'expected_return_date',
      key: 'expected_return_date',
      width: 150,
      render: (date, record) => {
        if (!date) return <Text type="secondary">Not set</Text>;
        return (
          <Space direction="vertical" size={0}>
            <Text>{dayjs(date).format('MMM D, YYYY')}</Text>
            {!record.return_date && record.is_overdue && (
              <Text type="danger" style={{ fontSize: 12 }}>
                {record.days_overdue} day{record.days_overdue !== 1 ? 's' : ''} overdue
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Return Date',
      dataIndex: 'return_date',
      key: 'return_date',
      width: 150,
      render: (date) =>
        date ? (
          dayjs(date).format('MMM D, YYYY')
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Work Order',
      dataIndex: 'work_order',
      key: 'work_order',
      width: 120,
      render: (value) => value || <Text type="secondary">-</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          {!record.return_date && (
            <Tooltip title="Return Tool">
              <Button
                type="primary"
                icon={<LoginOutlined />}
                onClick={() => onCheckin(record)}
                size="small"
              >
                Return
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Filter */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text>Show returned tools:</Text>
        <Switch
          checked={includeReturned}
          onChange={(checked) => {
            setIncludeReturned(checked);
            setPage(1);
          }}
        />
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={data?.checkouts || []}
        rowKey="id"
        loading={isLoading || isFetching}
        scroll={{ x: 1100 }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} checkout${total !== 1 ? 's' : ''}`,
          pageSizeOptions: ['10', '25', '50', '100'],
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          },
        }}
        rowClassName={(record) =>
          record.is_overdue && !record.return_date ? 'ant-table-row-overdue' : ''
        }
      />

      {/* Details Drawer */}
      <CheckoutDetailsDrawer
        open={detailsOpen}
        checkout={selectedCheckout}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedCheckout(null);
        }}
        onCheckin={(checkout) => {
          setDetailsOpen(false);
          onCheckin(checkout);
        }}
      />

      <style>{`
        .ant-table-row-overdue > td {
          background-color: ${token.colorErrorBg} !important;
        }
        .ant-table-row-overdue:hover > td {
          background-color: ${token.colorErrorBgHover} !important;
        }
      `}</style>
    </>
  );
};
