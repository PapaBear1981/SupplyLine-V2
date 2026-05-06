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
  Card,
  Statistic,
  Row,
  Col,
  Upload,
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
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetToolQuery,
  useUpdateToolMutation,
  useCreateToolMutation,
  useGetToolCalibrationsQuery,
  useAddToolCalibrationMutation,
  useUploadCalibrationCertificateMutation,
  useGetToolBarcodeQuery,
} from '../services/toolsApi';
import { ToolForm } from './ToolForm';
import type { ToolFormData, ToolStatus, CalibrationStatus } from '../types';
import { getToolActionErrorMessage } from '../utils/getToolActionErrorMessage';
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
  const [calModalOpen, setCalModalOpen] = useState(false);
  const [calForm] = Form.useForm();
  const [calCertFile, setCalCertFile] = useState<File | null>(null);

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
  const [addCalibration, { isLoading: isAddingCalibration }] = useAddToolCalibrationMutation();
  const [uploadCertificate] = useUploadCalibrationCertificateMutation();

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
    } catch (err: unknown) {
      message.error(
        getToolActionErrorMessage(err, mode === 'create' ? 'create' : 'update')
      );
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
            <Descriptions.Item label="Calibration Frequency">
              {tool.calibration_frequency_days
                ? `Every ${tool.calibration_frequency_days} days`
                : 'Not set'}
            </Descriptions.Item>
            <Descriptions.Item label="Last Calibration">
              {tool.last_calibration_date
                ? dayjs(tool.last_calibration_date).format('MMM D, YYYY')
                : <Text type="secondary">Not yet calibrated</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="Next Calibration">
              {tool.next_calibration_date
                ? dayjs(tool.next_calibration_date).format('MMM D, YYYY')
                : <Text type="secondary">—</Text>}
            </Descriptions.Item>
          </>
        )}
        <Descriptions.Item label="Created">
          {dayjs(tool.created_at).format('MMM D, YYYY h:mm A')}
        </Descriptions.Item>
      </Descriptions>
    );
  };

  const renderCalibrationTab = () => {
    if (!tool) return <Empty description="No tool data" />;

    if (!tool.requires_calibration) {
      return (
        <Empty
          description={
            <span>
              This tool is not currently tracked for calibration.
              <br />
              Enable "Requires Calibration" in tool details to start tracking.
            </span>
          }
        >
          <PermissionGuard permission="tool.edit">
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => setMode('edit')}
            >
              Edit Tool
            </Button>
          </PermissionGuard>
        </Empty>
      );
    }

    const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      pass: { color: 'success', icon: <CheckCircleOutlined />, label: 'Pass' },
      fail: { color: 'error', icon: <CloseCircleOutlined />, label: 'Fail' },
      limited: { color: 'warning', icon: <MinusCircleOutlined />, label: 'Limited' },
    };

    // Compute days until next calibration
    let daysUntilLabel = '—';
    let daysValueStyle: React.CSSProperties = {};
    if (tool.next_calibration_date) {
      const days = dayjs(tool.next_calibration_date).startOf('day').diff(dayjs().startOf('day'), 'day');
      if (days < 0) {
        daysUntilLabel = `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
        daysValueStyle = { color: '#cf1322' };
      } else if (days === 0) {
        daysUntilLabel = 'Due today';
        daysValueStyle = { color: '#d48806' };
      } else {
        daysUntilLabel = `${days} day${days === 1 ? '' : 's'}`;
        daysValueStyle = days <= 30 ? { color: '#d48806' } : { color: '#3f8600' };
      }
    } else if (!tool.last_calibration_date) {
      daysUntilLabel = 'Not yet calibrated';
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Card size="small">
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6}>
              <Statistic
                title="Status"
                valueRender={() => (
                  <Tag color={getCalibrationStatusColor(tool.calibration_status)}>
                    {tool.calibration_status.replace('_', ' ').toUpperCase()}
                  </Tag>
                )}
                value={tool.calibration_status}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="Frequency"
                value={tool.calibration_frequency_days ? `${tool.calibration_frequency_days} days` : 'Not set'}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="Last Calibration"
                value={
                  tool.last_calibration_date
                    ? dayjs(tool.last_calibration_date).format('MMM D, YYYY')
                    : 'Never'
                }
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic
                title="Next Calibration"
                value={
                  tool.next_calibration_date
                    ? dayjs(tool.next_calibration_date).format('MMM D, YYYY')
                    : '—'
                }
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col xs={24}>
              <Statistic
                title="Time Until Next"
                value={daysUntilLabel}
                valueStyle={{ ...daysValueStyle, fontSize: 18 }}
              />
            </Col>
          </Row>
        </Card>

        <PermissionGuard permission="tool.edit">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              calForm.resetFields();
              setCalCertFile(null);
              calForm.setFieldsValue({
                calibration_date: dayjs(),
                calibration_status: 'pass',
              });
              setCalModalOpen(true);
            }}
          >
            Record Calibration
          </Button>
        </PermissionGuard>

        <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 0 }}>
          Calibration History
        </Typography.Title>

        {!calibrations || calibrations.length === 0 ? (
          <Empty description="No calibration records yet" />
        ) : (
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
        )}
      </Space>
    );
  };

  const handleCalibrationSubmit = async () => {
    try {
      const values = await calForm.validateFields();
      const calDate = (values.calibration_date as ReturnType<typeof dayjs>);
      const nextDate = values.next_calibration_date as ReturnType<typeof dayjs> | undefined;

      const result = await addCalibration({
        toolId: toolId!,
        data: {
          calibration_date: calDate.toISOString(),
          next_calibration_date: nextDate ? nextDate.toISOString() : undefined,
          calibration_status: values.calibration_status,
          notes: values.notes || undefined,
        },
      }).unwrap();

      if (calCertFile && result.calibration?.id) {
        try {
          await uploadCertificate({
            calibrationId: result.calibration.id,
            toolId: toolId!,
            file: calCertFile,
          }).unwrap();
        } catch {
          message.warning('Calibration saved, but certificate upload failed');
        }
      }

      message.success('Calibration recorded');
      setCalModalOpen(false);
      calForm.resetFields();
      setCalCertFile(null);
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { errorFields?: unknown; data?: { error?: string } };
      if (!e.errorFields) {
        message.error(e.data?.error || 'Failed to record calibration');
      }
    }
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

      {/* Record Calibration modal */}
      <Modal
        open={calModalOpen}
        title={
          <Space>
            <CalendarOutlined />
            <span>Record Calibration</span>
          </Space>
        }
        onCancel={() => {
          setCalModalOpen(false);
          calForm.resetFields();
          setCalCertFile(null);
        }}
        onOk={handleCalibrationSubmit}
        okText="Save Calibration"
        okButtonProps={{ loading: isAddingCalibration }}
        destroyOnClose
      >
        {tool && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {tool.tool_number} — S/N {tool.serial_number}
            {tool.calibration_frequency_days
              ? ` — Frequency: every ${tool.calibration_frequency_days} days`
              : ''}
          </Text>
        )}
        <Form
          form={calForm}
          layout="vertical"
          onValuesChange={(changed) => {
            // Auto-compute next calibration date when calibration_date changes
            if ('calibration_date' in changed && tool?.calibration_frequency_days) {
              const calDate = changed.calibration_date as ReturnType<typeof dayjs> | null;
              if (calDate) {
                calForm.setFieldsValue({
                  next_calibration_date: calDate.add(tool.calibration_frequency_days, 'day'),
                });
              }
            }
          }}
        >
          <Form.Item
            label="Calibration date"
            name="calibration_date"
            rules={[{ required: true, message: 'Select the calibration date' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(d) => d.isAfter(dayjs(), 'day')}
            />
          </Form.Item>
          <Form.Item
            label="Result"
            name="calibration_status"
            rules={[{ required: true, message: 'Select calibration result' }]}
          >
            <Select
              options={[
                { label: 'Pass', value: 'pass' },
                { label: 'Limited', value: 'limited' },
                { label: 'Fail', value: 'fail' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Next calibration date"
            name="next_calibration_date"
            extra={
              tool?.calibration_frequency_days
                ? `Auto-calculated from frequency (${tool.calibration_frequency_days} days). Override as needed.`
                : 'Set the next calibration due date'
            }
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Notes (optional)" name="notes">
            <Input.TextArea
              rows={3}
              maxLength={1000}
              showCount
              placeholder="Equipment used, deviations, observations…"
            />
          </Form.Item>
          <Form.Item label="Certificate file (optional)">
            <Upload
              beforeUpload={(file) => {
                setCalCertFile(file);
                return false;
              }}
              onRemove={() => setCalCertFile(null)}
              fileList={calCertFile ? [{
                uid: '-1',
                name: calCertFile.name,
                status: 'done' as const,
              }] : []}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Attach certificate</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
};
