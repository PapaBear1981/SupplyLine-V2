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
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useGetDueTodayCheckoutsQuery } from '../services/checkoutApi';
import type { ToolCheckout } from '../types';
import { CheckoutDetailsDrawer } from './CheckoutDetailsDrawer';

const { Text } = Typography;

interface DueTodayCheckoutsTableProps {
  onCheckin: (checkout: ToolCheckout) => void;
}

export const DueTodayCheckoutsTable = ({ onCheckin }: DueTodayCheckoutsTableProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedCheckout, setSelectedCheckout] = useState<ToolCheckout | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { token } = theme.useToken();

  const { data, isLoading, isFetching } = useGetDueTodayCheckoutsQuery({
    page,
    per_page: pageSize,
  });

  const handleViewDetails = (checkout: ToolCheckout) => {
    setSelectedCheckout(checkout);
    setDetailsOpen(true);
  };

  const columns: TableProps<ToolCheckout>['columns'] = [
    {
      title: 'Tool',
      key: 'tool',
      width: 200,
      fixed: 'left',
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
      width: 130,
      render: (date) => dayjs(date).format('MMM D, YYYY'),
    },
    {
      title: 'Due Date',
      dataIndex: 'expected_return_date',
      key: 'expected_return_date',
      width: 160,
      render: (date) => (
        <Space>
          {dayjs(date).format('MMM D, YYYY')}
          <Tag color="blue" icon={<ClockCircleOutlined />}>
            Due Today
          </Tag>
        </Space>
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

  const dueTodayCount = data?.total || 0;

  return (
    <>
      {dueTodayCount > 0 ? (
        <Alert
          type="info"
          showIcon
          icon={<ClockCircleOutlined />}
          message={`${dueTodayCount} tool${dueTodayCount !== 1 ? 's are' : ' is'} due back today`}
          description="These tools are scheduled to be returned today. Please follow up with users as needed."
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert
          type="success"
          showIcon
          message="No tools due today"
          description="No tools are scheduled to be returned today."
          style={{ marginBottom: 16 }}
        />
      )}

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
          showTotal: (total) => `Total ${total} due today`,
          pageSizeOptions: ['10', '25', '50', '100'],
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          },
        }}
        rowClassName={() => 'ant-table-row-due-today'}
      />

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
        .ant-table-row-due-today > td {
          background-color: ${token.colorInfoBg} !important;
        }
        .ant-table-row-due-today:hover > td {
          background-color: ${token.colorInfoBgHover} !important;
        }
      `}</style>
    </>
  );
};
