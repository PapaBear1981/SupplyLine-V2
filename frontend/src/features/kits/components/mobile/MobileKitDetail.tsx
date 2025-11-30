import { useNavigate } from 'react-router-dom';
import { List, Tag, Button, Badge } from 'antd-mobile';
import {
  ExclamationCircleOutlined,
  EnvironmentOutlined,
  InboxOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Kit, KitStatus } from '../../types';

interface MobileKitDetailProps {
  kit: Kit;
  onEdit: (kit: Kit) => void;
  onClose: () => void;
}

// Status color mapping
const statusColors: Record<KitStatus, string> = {
  active: '#52c41a',
  deployed: '#1890ff',
  maintenance: '#faad14',
  inactive: '#8c8c8c',
  retired: '#ff4d4f',
};

export const MobileKitDetail = ({ kit, onEdit, onClose }: MobileKitDetailProps) => {
  const navigate = useNavigate();

  const handleViewDetails = () => {
    onClose();
    navigate(`/kits/${kit.id}`);
  };

  const handleViewLocation = () => {
    onClose();
    navigate(`/kits/${kit.id}?tab=location`);
  };

  const handleViewBoxes = () => {
    onClose();
    navigate(`/kits/${kit.id}?tab=boxes`);
  };

  const handleViewItems = () => {
    onClose();
    navigate(`/kits/${kit.id}?tab=items`);
  };

  const getFullAddress = () => {
    const parts = [
      kit.location_address,
      kit.location_city,
      kit.location_state,
      kit.location_zip,
    ].filter(Boolean);
    return parts.join(', ') || 'Not set';
  };

  return (
    <div className="detail-popup">
      <div className="detail-header">
        <div className="detail-title">{kit.name}</div>
        <Tag color={statusColors[kit.status]}>
          {kit.status.replace('_', ' ')}
        </Tag>
      </div>

      <List>
        <List.Item extra={kit.aircraft_type_name || 'N/A'}>
          Aircraft Type
        </List.Item>

        {kit.description && (
          <List.Item>
            <div>
              <div style={{ fontSize: 13, color: 'var(--adm-color-text-secondary)', marginBottom: 4 }}>
                Description
              </div>
              <div>{kit.description}</div>
            </div>
          </List.Item>
        )}

        <List.Item
          extra={
            <Badge content={kit.box_count || 0} color={kit.box_count ? '#1890ff' : '#d9d9d9'}>
              <InboxOutlined style={{ fontSize: 20, color: '#8c8c8c' }} />
            </Badge>
          }
          onClick={handleViewBoxes}
          arrow
        >
          Boxes
        </List.Item>

        <List.Item
          extra={
            <Badge content={kit.item_count || 0} color={kit.item_count ? '#1890ff' : '#d9d9d9'}>
              <ToolOutlined style={{ fontSize: 20, color: '#8c8c8c' }} />
            </Badge>
          }
          onClick={handleViewItems}
          arrow
        >
          Items
        </List.Item>

        {kit.pending_reorders !== undefined && kit.pending_reorders > 0 && (
          <List.Item
            extra={
              <Badge content={kit.pending_reorders} color="#faad14">
                <ExclamationCircleOutlined style={{ fontSize: 20, color: '#faad14' }} />
              </Badge>
            }
          >
            Pending Reorders
          </List.Item>
        )}

        {kit.trailer_number && (
          <List.Item extra={kit.trailer_number}>
            Trailer Number
          </List.Item>
        )}

        <List.Item
          extra={kit.has_location ? '✓' : 'Not set'}
          onClick={kit.has_location ? handleViewLocation : undefined}
          arrow={kit.has_location}
        >
          <div>
            <div style={{ marginBottom: 4 }}>
              <EnvironmentOutlined style={{ marginRight: 4 }} />
              Location
            </div>
            {kit.has_location && (
              <div style={{ fontSize: 12, color: 'var(--adm-color-text-secondary)' }}>
                {getFullAddress()}
              </div>
            )}
          </div>
        </List.Item>

        {kit.location_notes && (
          <List.Item>
            <div>
              <div style={{ fontSize: 13, color: 'var(--adm-color-text-secondary)', marginBottom: 4 }}>
                Location Notes
              </div>
              <div style={{ fontSize: 14 }}>{kit.location_notes}</div>
            </div>
          </List.Item>
        )}

        <List.Item extra={kit.creator_name || 'N/A'}>
          Created By
        </List.Item>

        <List.Item extra={dayjs(kit.created_at).format('MMM D, YYYY')}>
          Created Date
        </List.Item>

        {kit.updated_at && kit.updated_at !== kit.created_at && (
          <List.Item extra={dayjs(kit.updated_at).format('MMM D, YYYY')}>
            Last Updated
          </List.Item>
        )}
      </List>

      <div className="detail-actions">
        <Button block color="primary" onClick={handleViewDetails}>
          View Full Details
        </Button>
        <Button
          block
          color="primary"
          fill="outline"
          onClick={() => onEdit(kit)}
        >
          Edit Kit
        </Button>
      </div>
    </div>
  );
};
