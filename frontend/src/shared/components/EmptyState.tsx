import React from 'react';
import { Button, Empty } from 'antd';
import { PlusOutlined, InboxOutlined } from '@ant-design/icons';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: 'default' | 'custom';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Data Yet',
  description = 'Get started by creating your first item.',
  actionText,
  onAction,
  icon = 'default',
}) => {
  return (
    <div className="custom-empty" style={{ padding: '48px 24px' }}>
      {icon === 'default' ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={null}
          style={{ opacity: 0.6 }}
        />
      ) : (
        <InboxOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
      )}
      <h3 className="custom-empty-title" style={{ marginTop: 16, fontSize: 16, fontWeight: 600, color: '#262626' }}>
        {title}
      </h3>
      <p className="custom-empty-description" style={{ fontSize: 14, color: '#8c8c8c', marginBottom: 24 }}>
        {description}
      </p>
      {actionText && onAction && (
        <Button type="primary" icon={<PlusOutlined />} onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
