import { useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Space,
  Tooltip,
  Typography,
  Alert,
  theme,
} from 'antd';
import type { TableProps } from 'antd';
import {
  LoginOutlined,
  EyeOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetOverdueCheckoutsQuery } from '../services/checkoutApi';
import type { ToolCheckout } from '../types';
import { CheckoutDetailsDrawer } from './CheckoutDetailsDrawer';

const { Text } = Typography;

interface OverdueCheckoutsTableProps {
  onCheckin: (checkout: ToolCheckout) => void;
}

export const OverdueCheckoutsTable = ({ onCheckin }: OverdueCheckoutsTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedCheckout, setSelectedCheckout] = useState<ToolCheckout | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { token } = theme.useToken();

  const { data, isLoading, isFetching } = useGetOverdueCheckoutsQuery({
    page,
    per_page: pageSize,
  });

  const handleViewDetails = (checkout: ToolCheckout) => {
    setSelectedCheckout(checkout);
    setDetailsOpen(true);
  };

  const getOverdueSeverity = (daysOverdue: number) => {
    if (daysOverdue > 30) return 'error';
    if (daysOverdue > 14) return 'warning';
    return 'default';
  };

  const columns: TableProps<ToolCheckout>['columns'] = [
    {
      title: 'Days Overdue',
      key: 'days_overdue',
      width: 130,
      fixed: 'left',
      render: (_, record) => {
        const severity = getOverdueSeverity(record.days_overdue);
        return (
          <Tag
            color={severity === 'error' ? 'red' : severity === 'warning' ? 'orange' : 'gold'}
            icon={<WarningOutlined />}
          >
            {record.days_overdue} day{record.days_overdue !== 1 ? 's' : ''}
          </Tag>
        );
      },
      sorter: (a, b) => a.days_overdue - b.days_overdue,
      defaultSortOrder: 'descend',
    },
    {
      title: 'Tool',
      key: 'tool',
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
      width: 130,
      render: (date) => dayjs(date).format('MMM D, YYYY'),
    },
    {
      title: 'Was Due',
      dataIndex: 'expected_return_date',
      key: 'expected_return_date',
      width: 130,
      render: (date) => (
        <Text type="danger">{dayjs(date).format('MMM D, YYYY')}</Text>
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
          <Tooltip title="Return Tool">
            <Button
              type="primary"
              danger
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

  const overdueCount = data?.total || 0;

  return (
    <>
      {overdueCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={`${overdueCount} tool${overdueCount !== 1 ? 's are' : ' is'} overdue`}
          description="These tools have exceeded their expected return dates. Please follow up with the users to return them."
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert
          type="success"
          showIcon
          message="No overdue checkouts"
          description="All tools are returned on time."
          style={{ marginBottom: 16 }}
        />
      )}

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
          showTotal: (total) => `Total ${total} overdue checkout${total !== 1 ? 's' : ''}`,
          pageSizeOptions: ['10', '25', '50', '100'],
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          },
        }}
        rowClassName={(record) => {
          const severity = getOverdueSeverity(record.days_overdue);
          if (severity === 'error') return 'ant-table-row-critical';
          if (severity === 'warning') return 'ant-table-row-warning';
          return 'ant-table-row-overdue';
        }}
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
          background-color: ${token.colorWarningBg} !important;
        }
        .ant-table-row-overdue:hover > td {
          background-color: ${token.colorWarningBgHover} !important;
        }
        .ant-table-row-warning > td {
          background-color: ${token.colorWarningBg} !important;
        }
        .ant-table-row-warning:hover > td {
          background-color: ${token.colorWarningBgHover} !important;
        }
        .ant-table-row-critical > td {
          background-color: ${token.colorErrorBg} !important;
        }
        .ant-table-row-critical:hover > td {
          background-color: ${token.colorErrorBgHover} !important;
        }
      `}</style>
    </>
  );
};
