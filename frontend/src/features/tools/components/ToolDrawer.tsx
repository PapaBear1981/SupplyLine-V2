import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Tabs,
  Descriptions,
  Tag,
  Button,
  Space,
  Spin,
  message,
  Form,
  Timeline,
  Empty,
  Image,
  Modal,
  Select,
  Input,
  DatePicker,
  Typography,
} from 'antd';
import {
  EditOutlined,
  QrcodeOutlined,
  HistoryOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  PrinterOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetToolQuery,
  useUpdateToolMutation,
  useCreateToolMutation,
  useGetToolCalibrationsQuery,
  useGetToolBarcodeQuery,
} from '../services/toolsApi';
import { ToolForm } from './ToolForm';
import type { ToolFormData, ToolStatus, CalibrationStatus } from '../types';
import { LabelPrintModal } from '@/components/shared/LabelPrintModal';
import { PermissionGuard } from '@features/auth/components/PermissionGuard';
import { ToolHistoryTimeline } from '@features/tool-checkout';

interface ToolDrawerProps {
  open: boolean;
  mode: 'view' | 'edit' | 'create';
  toolId?: number | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const MAINTENANCE_TYPES = [
  'Scheduled Maintenance',
  'Repair',
  'Calibration',
  'Inspection',
  'Cleaning / Lubrication',
  'Parts Replacement',
  'Other',
];

const { Text } = Typography;

export const ToolDrawer = ({ open, mode: initialMode, toolId, onClose, onSuccess }: ToolDrawerProps) => {
  const [mode, setMode] = useState(initialMode);
  const [form] = Form.useForm();
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [maintModalOpen, setMaintModalOpen] = useState(false);
  const [maintForm] = Form.useForm();

  // Fetch tool data if viewing or editing
  const { data: tool, isLoading } = useGetToolQuery(toolId!, {
    skip: !toolId || initialMode === 'create',
  });

  const { data: calibrations } = useGetToolCalibrationsQuery(toolId!, {
    skip: !toolId || mode === 'create',
  });

  const { data: barcodeData } = useGetToolBarcodeQuery(toolId!, {
    skip: !toolId || mode === 'create',
  });

  const [updateTool, { isLoading: isUpdating }] = useUpdateToolMutation();
  const [createTool, { isLoading: isCreating }] = useCreateToolMutation();

  // Update mode when initialMode changes
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Reset form when tool data changes
  useEffect(() => {
    if (tool && mode === 'edit') {
      form.resetFields();
    }
  }, [tool, mode, form]);

  const handleSubmit = async (values: ToolFormData) => {
    try {
      if (mode === 'create') {
        await createTool(values).unwrap();
        message.success('Tool created successfully');
      } else if (mode === 'edit' && toolId) {
        await updateTool({ id: toolId, data: values }).unwrap();
        message.success('Tool updated successfully');
      }
      onSuccess?.();
      onClose();
    } catch {
      message.error(`Failed to ${mode === 'create' ? 'create' : 'update'} tool`);
    }
  };

  const handleMaintenanceSubmit = async () => {
    try {
      const values = await maintForm.validateFields();
      await updateTool({
        id: toolId!,
        data: {
          status: 'maintenance',
          status_reason: `${values.maintenance_type}${values.description ? `: ${values.description}` : ''}`,
          maintenance_return_date: values.return_date
            ? (values.return_date as ReturnType<typeof dayjs>).format('YYYY-MM-DD')
            : undefined,
        },
      }).unwrap();
      message.success('Tool checked out for maintenance');
      setMaintModalOpen(false);
      maintForm.resetFields();
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { errorFields?: unknown; data?: { error?: string } };
      if (!e.errorFields) {
        message.error(e.data?.error || 'Failed to update tool status');
      }
    }
  };

  const handleCancel = () => {
    if (mode === 'edit') {
      setMode('view');
      form.resetFields();
    } else {
      onClose();
    }
  };

  const getStatusColor = (status: ToolStatus): string => {
    const colors: Record<ToolStatus, string> = {
      available: 'green',
      checked_out: 'blue',
      maintenance: 'orange',
      retired: 'red',
      in_transfer: 'purple',
    };
    return colors[status] || 'default';
  };

  const getCalibrationStatusColor = (status: CalibrationStatus): string => {
    const colors: Record<CalibrationStatus, string> = {
      current: 'green',
      due_soon: 'orange',
      overdue: 'red',
      not_applicable: 'default',
    };
    return colors[status] || 'default';
  };

  const renderDetailsTab = () => {
    if (!tool) return <Empty description="No tool data" />;

    return (
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Tool Number">
          <strong>{tool.tool_number}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="Serial Number">{tool.serial_number}</Descriptions.Item>
        {tool.lot_number && (
          <Descriptions.Item label="Lot Number">{tool.lot_number}</Descriptions.Item>
        )}
        <Descriptions.Item label="Description">{tool.description}</Descriptions.Item>
        <Descriptions.Item label="Category">
          <Tag>{tool.category}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Condition">
          <Tag color={tool.condition === 'New' ? 'green' : 'default'}>
            {tool.condition}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Location">{tool.location}</Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag color={getStatusColor(tool.status)}>
            {tool.status.replace('_', ' ').toUpperCase()}
          </Tag>
        </Descriptions.Item>
        {tool.status_reason && (
          <Descriptions.Item label="Status Reason">{tool.status_reason}</Descriptions.Item>
        )}
        {tool.warehouse_name && (
          <Descriptions.Item label="Warehouse">{tool.warehouse_name}</Descriptions.Item>
        )}
        <Descriptions.Item label="Requires Calibration">
          {tool.requires_calibration ? 'Yes' : 'No'}
        </Descriptions.Item>
        {tool.requires_calibration && (
          <>
            <Descriptions.Item label="Calibration Status">
              <Tag color={getCalibrationStatusColor(tool.calibration_status)}>
                {tool.calibration_status.replace('_', ' ').toUpperCase()}
              </Tag>
            </Descriptions.Item>
            {tool.calibration_frequency_days && (
              <Descriptions.Item label="Calibration Frequency">
                Every {tool.calibration_frequency_days} days
              </Descriptions.Item>
            )}
            {tool.last_calibration_date && (
              <Descriptions.Item label="Last Calibration">
                {dayjs(tool.last_calibration_date).format('MMM D, YYYY')}
              </Descriptions.Item>
            )}
            {tool.next_calibration_date && (
              <Descriptions.Item label="Next Calibration">
                {dayjs(tool.next_calibration_date).format('MMM D, YYYY')}
              </Descriptions.Item>
            )}
          </>
        )}
        <Descriptions.Item label="Created">
          {dayjs(tool.created_at).format('MMM D, YYYY h:mm A')}
        </Descriptions.Item>
      </Descriptions>
    );
  };

  const renderCalibrationTab = () => {
    if (!tool?.requires_calibration) {
      return <Empty description="This tool does not require calibration" />;
    }

    if (!calibrations || calibrations.length === 0) {
      return <Empty description="No calibration history" />;
    }

    const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      pass: { color: 'success', icon: <CheckCircleOutlined />, label: 'Pass' },
      fail: { color: 'error', icon: <CloseCircleOutlined />, label: 'Fail' },
      limited: { color: 'warning', icon: <MinusCircleOutlined />, label: 'Limited' },
    };

    return (
      <Timeline
        items={calibrations.map((cal) => {
          const status = statusConfig[cal.calibration_status] ?? statusConfig.pass;
          return {
            color: cal.calibration_status === 'pass' ? 'green' : cal.calibration_status === 'fail' ? 'red' : 'orange',
            children: (
              <div>
                <Space wrap>
                  <strong>{dayjs(cal.calibration_date).format('MMM D, YYYY')}</strong>
                  <Tag color={status.color} icon={status.icon}>{status.label}</Tag>
                </Space>
                {cal.performed_by_name && (
                  <div>Calibrated by: {cal.performed_by_name}</div>
                )}
                {cal.calibration_certificate_file && (
                  <div>Certificate file: {cal.calibration_certificate_file}</div>
                )}
                {cal.calibration_notes && (
                  <div style={{ marginTop: 8, color: '#666' }}>{cal.calibration_notes}</div>
                )}
                {cal.next_calibration_date && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                    Next due: {dayjs(cal.next_calibration_date).format('MMM D, YYYY')}
                  </div>
                )}
              </div>
            ),
          };
        })}
      />
    );
  };

  const renderQRCodeTab = () => {
    if (!barcodeData?.qr_code) {
      return <Empty description="QR code not available" />;
    }

    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Image
          src={`data:image/png;base64,${barcodeData.qr_code}`}
          alt={`QR Code for tool ${tool?.tool_number ?? ''}`}
          width={250}
          preview={false}
        />
        <div style={{ marginTop: 16 }}>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => setPrintModalOpen(true)}
            aria-label="Print label for this tool"
          >
            Print Label
          </Button>
        </div>
      </div>
    );
  };

  const getTitle = () => {
    if (mode === 'create') return 'Create New Tool';
    if (mode === 'edit') return 'Edit Tool';
    return tool ? `Tool: ${tool.tool_number}` : 'Tool Details';
  };

  const getExtraActions = () => {
    if (mode === 'view' && tool) {
      return (
        <Space>
          <Button
            icon={<PrinterOutlined />}
            onClick={() => setPrintModalOpen(true)}
            aria-label="Print label for this tool"
          >
            Print Label
          </Button>
          <PermissionGuard permission="tool.edit">
            {tool.status === 'available' && (
              <Button
                icon={<ToolOutlined />}
                onClick={() => { maintForm.resetFields(); setMaintModalOpen(true); }}
                aria-label="Check out for maintenance"
              >
                Maintenance
              </Button>
            )}
            <Button
              icon={<EditOutlined />}
              onClick={() => setMode('edit')}
              aria-label="Edit tool details"
            >
              Edit
            </Button>
          </PermissionGuard>
        </Space>
      );
    }
    return null;
  };

  return (
    <Drawer
      title={getTitle()}
      placement="right"
      width={window.innerWidth < 768 ? '100%' : 720}
      onClose={onClose}
      open={open}
      extra={getExtraActions()}
      destroyOnClose
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : mode === 'view' && tool ? (
        <Tabs
          defaultActiveKey="details"
          items={[
            {
              key: 'details',
              label: (
                <span>
                  <InfoCircleOutlined /> Details
                </span>
              ),
              children: renderDetailsTab(),
            },
            {
              key: 'calibration',
              label: (
                <span>
                  <CalendarOutlined /> Calibration
                </span>
              ),
              children: renderCalibrationTab(),
              disabled: !tool.requires_calibration,
            },
            {
              key: 'qrcode',
              label: (
                <span>
                  <QrcodeOutlined /> QR Code
                </span>
              ),
              children: renderQRCodeTab(),
            },
            {
              key: 'history',
              label: (
                <span>
                  <HistoryOutlined /> History
                </span>
              ),
              children: toolId ? <ToolHistoryTimeline toolId={toolId} /> : <Empty description="No tool selected" />,
            },
          ]}
        />
      ) : (
        <ToolForm
          form={form}
          initialValues={mode === 'edit' ? tool : null}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={isUpdating || isCreating}
        />
      )}

      {/* Label Print Modal */}
      {toolId && tool && (
        <LabelPrintModal
          open={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          itemType="tool"
          itemId={toolId}
          itemDescription={tool.tool_number}
        />
      )}

      {/* Maintenance checkout modal */}
      <Modal
        open={maintModalOpen}
        title={
          <Space>
            <ToolOutlined />
            <span>Check Out for Maintenance</span>
          </Space>
        }
        onCancel={() => { setMaintModalOpen(false); maintForm.resetFields(); }}
        onOk={handleMaintenanceSubmit}
        okText="Confirm"
        okButtonProps={{ loading: isUpdating }}
        destroyOnClose
      >
        {tool && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {tool.tool_number} — S/N {tool.serial_number}
            {tool.description ? ` — ${tool.description}` : ''}
          </Text>
        )}
        <Form form={maintForm} layout="vertical">
          <Form.Item
            label="Maintenance type"
            name="maintenance_type"
            rules={[{ required: true, message: 'Select a maintenance type' }]}
          >
            <Select
              options={MAINTENANCE_TYPES.map((t) => ({ label: t, value: t }))}
              placeholder="Select type…"
            />
          </Form.Item>
          <Form.Item label="Description (optional)" name="description">
            <Input.TextArea
              rows={3}
              placeholder="Describe the issue or work to be performed…"
            />
          </Form.Item>
          <Form.Item label="Expected return to service" name="return_date">
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(d) => d.isBefore(dayjs(), 'day')}
              placeholder="Select date…"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
};
