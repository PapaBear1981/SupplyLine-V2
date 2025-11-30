/**
 * ConflictErrorModal Component
 *
 * Displays a modal when a concurrent update collision is detected (409 Conflict).
 * Provides options for the user to resolve the conflict:
 * - Refresh: Discard local changes and load the current server data
 * - Force Update: Overwrite server changes with local changes (optional)
 * - Cancel: Close the modal and keep the form open
 */

import React from 'react';
import { Modal, Button, Alert, Space, Typography, Descriptions } from 'antd';
import {
  ExclamationCircleOutlined,
  ReloadOutlined,
  CloseOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ConflictModalProps } from '../types/conflict';

const { Text, Paragraph } = Typography;

export const ConflictErrorModal: React.FC<ConflictModalProps> = ({
  open,
  conflictError,
  resourceType,
  onRefresh,
  onForce,
  onCancel,
  loading = false,
}) => {
  if (!conflictError) return null;

  const { conflict_details, hint } = conflictError;

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 20 }} />
          <span>Update Conflict Detected</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel} icon={<CloseOutlined />}>
            Cancel
          </Button>
          {onForce && (
            <Button
              danger
              onClick={onForce}
              loading={loading}
              icon={<WarningOutlined />}
              title="This will overwrite any changes made by other users"
            >
              Force Update
            </Button>
          )}
          <Button
            type="primary"
            onClick={onRefresh}
            loading={loading}
            icon={<ReloadOutlined />}
          >
            Refresh & Retry
          </Button>
        </Space>
      }
      width={520}
    >
      <Alert
        type="warning"
        showIcon
        message={`This ${resourceType} has been modified by another user`}
        description={
          hint || 'Your changes could not be saved because someone else updated this record.'
        }
        style={{ marginBottom: 16 }}
      />

      <Descriptions
        column={1}
        size="small"
        bordered
        style={{ marginBottom: 16 }}
      >
        <Descriptions.Item label="Your Version">
          <Text type="secondary">
            {conflict_details.provided_version ?? 'Unknown'}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Current Version">
          <Text strong style={{ color: '#1890ff' }}>
            {conflict_details.current_version ?? 'Unknown'}
          </Text>
        </Descriptions.Item>
        {conflict_details.resource_type && (
          <Descriptions.Item label="Resource Type">
            {conflict_details.resource_type}
          </Descriptions.Item>
        )}
      </Descriptions>

      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        <strong>Recommended:</strong> Click &quot;Refresh & Retry&quot; to load the latest
        version, then re-apply your changes if needed.
      </Paragraph>
    </Modal>
  );
};

export default ConflictErrorModal;
