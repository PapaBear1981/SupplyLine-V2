import { useState } from 'react';
import {
  Table,
  Input,
  Tag,
  Button,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';
import {
  SearchOutlined,
  LoginOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetActiveCheckoutsQuery } from '../services/checkoutApi';
import type { ToolCheckout } from '../types';
import { CheckoutDetailsDrawer } from './CheckoutDetailsDrawer';

const { Text } = Typography;

interface ActiveCheckoutsTableProps {
  onCheckin: (checkout: ToolCheckout) => void;
}

export const ActiveCheckoutsTable = ({ onCheckin }: ActiveCheckoutsTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [selectedCheckout, setSelectedCheckout] = useState<ToolCheckout | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data, isLoading, isFetching } = useGetActiveCheckoutsQuery({
    page,
    per_page: pageSize,
    q: committedSearch || undefined,
  });

  const handleSearch = () => {
    setCommittedSearch(searchQuery);
    setPage(1);
  };

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
      sorter: (a, b) =>
        (a.tool_number || '').localeCompare(b.tool_number || ''),
    },
    {
      title: 'Description',
      dataIndex: 'tool_description',
      key: 'description',
      ellipsis: true,
      width: 200,
    },
    {
      title: 'Checked Out To',
      key: 'user',
      width: 180,
      render: (_, record) => (
        <div>
          <Text>{record.user_name}</Text>
          {record.user_department && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.user_department}
              </Text>
            </div>
          )}
        </div>
      ),
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
    },
    {
      title: 'Expected Return',
      dataIndex: 'expected_return_date',
      key: 'expected_return_date',
      width: 160,
      render: (date, record) => (
        <Space>
          {date ? (
            <>
              {dayjs(date).format('MMM D, YYYY')}
              {record.is_overdue && (
                <Tag color="error" icon={<WarningOutlined />}>
                  {record.days_overdue}d overdue
                </Tag>
              )}
            </>
          ) : (
            <Text type="secondary">Not set</Text>
          )}
        </Space>
      ),
      sorter: (a, b) => {
        if (!a.expected_return_date) return 1;
        if (!b.expected_return_date) return -1;
        return (
          dayjs(a.expected_return_date).unix() -
          dayjs(b.expected_return_date).unix()
        );
      },
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 120,
      render: (_, record) => {
        const days = dayjs().diff(dayjs(record.checkout_date), 'day');
        return (
          <Space>
            <ClockCircleOutlined />
            {days} day{days !== 1 ? 's' : ''}
          </Space>
        );
      },
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
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Search Bar */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Input
          placeholder="Search by tool number, serial, user name..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onPressEnter={handleSearch}
          style={{ maxWidth: 400 }}
          allowClear
          onClear={() => {
            setSearchQuery('');
            setCommittedSearch('');
            setPage(1);
          }}
        />
        <Button type="primary" onClick={handleSearch}>
          Search
        </Button>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={data?.checkouts || []}
        rowKey="id"
        loading={isLoading || isFetching}
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} active checkouts`,
          pageSizeOptions: ['10', '25', '50', '100'],
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          },
        }}
        rowClassName={(record) =>
          record.is_overdue ? 'ant-table-row-overdue' : ''
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
        .ant-table-row-overdue {
          background-color: #fff2f0 !important;
        }
        .ant-table-row-overdue:hover > td {
          background-color: #ffebe8 !important;
        }
      `}</style>
    </>
  );
};
