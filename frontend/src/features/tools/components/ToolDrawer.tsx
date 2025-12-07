import { useState, useEffect } from 'react';
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
} from 'antd';
import {
  EditOutlined,
  QrcodeOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  PrinterOutlined,
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

interface ToolDrawerProps {
  open: boolean;
  mode: 'view' | 'edit' | 'create';
  toolId?: number | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ToolDrawer = ({ open, mode: initialMode, toolId, onClose, onSuccess }: ToolDrawerProps) => {
  const [mode, setMode] = useState(initialMode);
  const [form] = Form.useForm();
  const [printModalOpen, setPrintModalOpen] = useState(false);

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

    return (
      <Timeline
        items={calibrations.map((cal) => ({
          color: 'blue',
          children: (
            <div>
              <div>
                <strong>{dayjs(cal.calibration_date).format('MMM D, YYYY')}</strong>
              </div>
              <div>Calibrated by: {cal.calibrated_by}</div>
              {cal.certificate_number && <div>Certificate: {cal.certificate_number}</div>}
              {cal.notes && <div style={{ marginTop: 8, color: '#666' }}>{cal.notes}</div>}
              <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                Next due: {dayjs(cal.next_calibration_date).format('MMM D, YYYY')}
              </div>
            </div>
          ),
        }))}
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
          alt="Tool QR Code"
          width={250}
          preview={false}
        />
        <div style={{ marginTop: 16 }}>
          <Button type="primary" icon={<QrcodeOutlined />}>
            Print QR Code
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
          >
            Print Label
          </Button>
          <Button
            icon={<EditOutlined />}
            onClick={() => setMode('edit')}
          >
            Edit
          </Button>
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
                  <HistoryOutlined /> Calibration
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
    </Drawer>
  );
};
