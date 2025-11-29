import {
  Drawer,
  Descriptions,
  Tag,
  Button,
  Space,
  Typography,
  Divider,
  Timeline,
  Empty,
} from 'antd';
import {
  LoginOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ToolOutlined,
  CalendarOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ToolCheckout } from '../types';

const { Text, Title } = Typography;

interface CheckoutDetailsDrawerProps {
  open: boolean;
  checkout: ToolCheckout | null;
  onClose: () => void;
  onCheckin: (checkout: ToolCheckout) => void;
}

export const CheckoutDetailsDrawer = ({
  open,
  checkout,
  onClose,
  onCheckin,
}: CheckoutDetailsDrawerProps) => {
  if (!checkout) return null;

  const isReturned = !!checkout.return_date;
  const daysCheckedOut = checkout.return_date
    ? dayjs(checkout.return_date).diff(dayjs(checkout.checkout_date), 'day')
    : dayjs().diff(dayjs(checkout.checkout_date), 'day');

  const getStatusTag = () => {
    if (isReturned) {
      return (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          Returned
        </Tag>
      );
    }
    if (checkout.is_overdue) {
      return (
        <Tag color="error" icon={<WarningOutlined />}>
          Overdue by {checkout.days_overdue} day{checkout.days_overdue !== 1 ? 's' : ''}
        </Tag>
      );
    }
    return (
      <Tag color="processing" icon={<ClockCircleOutlined />}>
        Checked Out
      </Tag>
    );
  };

  const timelineItems = [
    {
      color: 'blue',
      children: (
        <div>
          <Text strong>Checked Out</Text>
          <br />
          <Text type="secondary">
            {dayjs(checkout.checkout_date).format('MMM D, YYYY h:mm A')}
          </Text>
          <br />
          <Text>By {checkout.user_name}</Text>
          {checkout.condition_at_checkout && (
            <Tag style={{ marginTop: 4 }}>
              Condition: {checkout.condition_at_checkout}
            </Tag>
          )}
        </div>
      ),
    },
    ...(checkout.expected_return_date
      ? [
          {
            color: checkout.is_overdue && !isReturned ? 'red' : 'gray',
            children: (
              <div>
                <Text strong>Expected Return</Text>
                <br />
                <Text type="secondary">
                  {dayjs(checkout.expected_return_date).format('MMM D, YYYY')}
                </Text>
                {checkout.is_overdue && !isReturned && (
                  <Tag color="error" style={{ marginLeft: 8 }}>
                    Overdue
                  </Tag>
                )}
              </div>
            ),
          },
        ]
      : []),
    ...(checkout.damage_reported
      ? [
          {
            color: 'red',
            dot: <ExclamationCircleOutlined />,
            children: (
              <div>
                <Text strong type="danger">
                  Damage Reported
                </Text>
                {checkout.damage_reported_date && (
                  <>
                    <br />
                    <Text type="secondary">
                      {dayjs(checkout.damage_reported_date).format('MMM D, YYYY h:mm A')}
                    </Text>
                  </>
                )}
                <br />
                {checkout.damage_severity && (
                  <Tag
                    color={
                      checkout.damage_severity === 'unusable' ||
                      checkout.damage_severity === 'severe'
                        ? 'red'
                        : checkout.damage_severity === 'moderate'
                        ? 'orange'
                        : 'gold'
                    }
                  >
                    {checkout.damage_severity.toUpperCase()}
                  </Tag>
                )}
                {checkout.damage_description && (
                  <div style={{ marginTop: 4 }}>
                    <Text>{checkout.damage_description}</Text>
                  </div>
                )}
              </div>
            ),
          },
        ]
      : []),
    ...(isReturned
      ? [
          {
            color: 'green',
            dot: <CheckCircleOutlined />,
            children: (
              <div>
                <Text strong>Returned</Text>
                <br />
                <Text type="secondary">
                  {dayjs(checkout.return_date).format('MMM D, YYYY h:mm A')}
                </Text>
                {checkout.checked_in_by_name && (
                  <>
                    <br />
                    <Text>Checked in by {checkout.checked_in_by_name}</Text>
                  </>
                )}
                {checkout.condition_at_return && (
                  <Tag style={{ marginTop: 4 }}>
                    Condition: {checkout.condition_at_return}
                  </Tag>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Drawer
      title={
        <Space>
          <ToolOutlined />
          Checkout Details
        </Space>
      }
      placement="right"
      width={window.innerWidth < 768 ? '100%' : 600}
      onClose={onClose}
      open={open}
      extra={
        !isReturned && (
          <Button
            type="primary"
            icon={<LoginOutlined />}
            onClick={() => onCheckin(checkout)}
          >
            Return Tool
          </Button>
        )
      }
    >
      {/* Tool Info */}
      <div
        style={{
          background: '#f5f5f5',
          padding: 16,
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          {checkout.tool_number}
        </Title>
        <Text type="secondary">{checkout.serial_number}</Text>
        <div style={{ marginTop: 8 }}>
          <Text>{checkout.tool_description}</Text>
        </div>
        {checkout.tool_category && (
          <Tag style={{ marginTop: 8 }}>{checkout.tool_category}</Tag>
        )}
      </div>

      {/* Status */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        {getStatusTag()}
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">
            {daysCheckedOut} day{daysCheckedOut !== 1 ? 's' : ''}{' '}
            {isReturned ? 'total' : 'and counting'}
          </Text>
        </div>
      </div>

      {/* Checkout Details */}
      <Descriptions
        bordered
        size="small"
        column={1}
        title={
          <Space>
            <UserOutlined />
            User Details
          </Space>
        }
      >
        <Descriptions.Item label="Checked Out By">
          {checkout.user_name}
        </Descriptions.Item>
        {checkout.user_employee_number && (
          <Descriptions.Item label="Employee #">
            {checkout.user_employee_number}
          </Descriptions.Item>
        )}
        {checkout.user_department && (
          <Descriptions.Item label="Department">
            {checkout.user_department}
          </Descriptions.Item>
        )}
      </Descriptions>

      <Divider />

      <Descriptions
        bordered
        size="small"
        column={1}
        title={
          <Space>
            <CalendarOutlined />
            Checkout Information
          </Space>
        }
      >
        {checkout.work_order && (
          <Descriptions.Item label="Work Order">
            {checkout.work_order}
          </Descriptions.Item>
        )}
        {checkout.project && (
          <Descriptions.Item label="Project">{checkout.project}</Descriptions.Item>
        )}
        {checkout.checkout_notes && (
          <Descriptions.Item label="Checkout Notes">
            {checkout.checkout_notes}
          </Descriptions.Item>
        )}
        {checkout.return_notes && (
          <Descriptions.Item label="Return Notes">
            {checkout.return_notes}
          </Descriptions.Item>
        )}
      </Descriptions>

      <Divider />

      {/* Timeline */}
      <Title level={5}>
        <ClockCircleOutlined style={{ marginRight: 8 }} />
        Checkout Timeline
      </Title>
      {timelineItems.length > 0 ? (
        <Timeline items={timelineItems} />
      ) : (
        <Empty description="No timeline data" />
      )}
    </Drawer>
  );
};
