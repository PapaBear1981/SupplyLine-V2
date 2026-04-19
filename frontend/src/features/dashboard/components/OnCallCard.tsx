import { Card, Avatar, Tag, Typography, Empty, Row, Col, Tooltip, theme } from 'antd';
import {
  PhoneOutlined,
  ToolOutlined,
  InboxOutlined,
  UserOutlined,
  MailOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  useGetOnCallPersonnelQuery,
  type OnCallEntry,
} from '@features/admin/services/oncallApi';
import styles from '../styles/Dashboard.module.scss';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface OnCallRoleProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  entry: OnCallEntry | undefined;
}

const OnCallRole = ({ label, description, icon, accentColor, entry }: OnCallRoleProps) => {
  const user = entry?.user ?? null;
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillAlter,
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${accentColor}1a`,
            color: accentColor,
            fontSize: 16,
          }}
        >
          {icon}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <Text strong style={{ fontSize: 14 }}>
            {label}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {description}
          </Text>
        </div>
      </div>

      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            size={48}
            src={user.avatar || undefined}
            icon={!user.avatar && <UserOutlined />}
            style={{ backgroundColor: user.avatar ? undefined : accentColor, flexShrink: 0 }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <Text strong ellipsis style={{ fontSize: 15 }}>
              {user.name}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              #{user.employee_number}
              {user.department ? ` · ${user.department}` : ''}
            </Text>
            {user.phone && (
              <Tooltip title={`Call ${user.name}`}>
                <a
                  href={`tel:${user.phone}`}
                  style={{
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 2,
                    fontWeight: 500,
                  }}
                >
                  <PhoneOutlined />
                  {user.phone}
                </a>
              </Tooltip>
            )}
            {user.email && (
              <Tooltip title={`Email ${user.name}`}>
                <a
                  href={`mailto:${user.email}`}
                  style={{
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 2,
                  }}
                >
                  <MailOutlined />
                  {user.email}
                </a>
              </Tooltip>
            )}
          </div>
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary">No one assigned</Text>}
          style={{ margin: '8px 0' }}
        />
      )}

      {entry?.updated_at && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          Updated {dayjs(entry.updated_at).fromNow()}
          {entry.updated_by ? ` by ${entry.updated_by.name}` : ''}
        </Text>
      )}
    </div>
  );
};

export const OnCallCard = () => {
  const { data, isLoading } = useGetOnCallPersonnelQuery();

  return (
    <Card
      className={styles.sectionCard}
      title={
        <span className={styles.sectionTitle}>
          <PhoneOutlined />
          On-Call Personnel
          <Tag color="blue" style={{ marginLeft: 8 }}>
            Current
          </Tag>
        </span>
      }
      loading={isLoading}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <OnCallRole
            label="Materials On-Call"
            description="Tools, chemicals, and supplies"
            icon={<InboxOutlined />}
            accentColor="#1890ff"
            entry={data?.materials}
          />
        </Col>
        <Col xs={24} md={12}>
          <OnCallRole
            label="Maintenance On-Call"
            description="Equipment repairs and service"
            icon={<ToolOutlined />}
            accentColor="#fa8c16"
            entry={data?.maintenance}
          />
        </Col>
      </Row>
    </Card>
  );
};
