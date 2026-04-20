import { useState } from 'react';
import {
  Table,
  Tag,
  Space,
  Button,
  Select,
  Modal,
  Form,
  Input,
  Popconfirm,
  Typography,
  Descriptions,
  message,
  Badge,
  Tooltip,
  theme,
} from 'antd';
import type { TableProps } from 'antd';
import {
  BugOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  GithubOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetBugReportsQuery,
  useUpdateBugReportMutation,
  useDeleteBugReportMutation,
} from '../services/adminApi';
import type { BugReport, BugSeverity, BugStatus } from '../types';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const severityConfig: Record<BugSeverity, { color: string; label: string }> = {
  low: { color: 'default', label: 'Low' },
  medium: { color: 'blue', label: 'Medium' },
  high: { color: 'orange', label: 'High' },
  critical: { color: 'red', label: 'Critical' },
};

const statusConfig: Record<BugStatus, { color: string; label: string; icon: React.ReactNode }> = {
  open: { color: 'error', label: 'Open', icon: <ExclamationCircleOutlined /> },
  in_progress: { color: 'processing', label: 'In Progress', icon: <SyncOutlined spin /> },
  resolved: { color: 'success', label: 'Resolved', icon: <CheckCircleOutlined /> },
  closed: { color: 'default', label: 'Closed', icon: <CloseCircleOutlined /> },
};

export const BugReportManagement = () => {
  const { token } = theme.useToken();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: reports = [], isLoading } = useGetBugReportsQuery(
    statusFilter || severityFilter
      ? { status: statusFilter || undefined, severity: severityFilter || undefined }
      : undefined
  );
  const [updateBugReport, { isLoading: isUpdating }] = useUpdateBugReportMutation();
  const [deleteBugReport] = useDeleteBugReportMutation();

  const handleStatusChange = async (report: BugReport, newStatus: BugStatus) => {
    try {
      await updateBugReport({ id: report.id, status: newStatus }).unwrap();
      message.success(`Status updated to ${statusConfig[newStatus].label}`);
    } catch {
      message.error('Failed to update status');
    }
  };

  const handleResolve = async (values: { resolution_notes: string }) => {
    if (!selectedReport) return;
    try {
      await updateBugReport({
        id: selectedReport.id,
        status: 'resolved',
        resolution_notes: values.resolution_notes,
      }).unwrap();
      message.success('Bug report marked as resolved');
      setResolveOpen(false);
      setSelectedReport(null);
      form.resetFields();
    } catch {
      message.error('Failed to resolve bug report');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteBugReport(id).unwrap();
      message.success('Bug report deleted');
    } catch {
      message.error('Failed to delete bug report');
    }
  };

  const openDetail = (report: BugReport) => {
    setSelectedReport(report);
    setDetailOpen(true);
  };

  const openResolve = (report: BugReport) => {
    setSelectedReport(report);
    form.setFieldsValue({ resolution_notes: report.resolution_notes || '' });
    setResolveOpen(true);
  };

  const openCounts = reports.filter((r) => r.status === 'open').length;
  const criticalCount = reports.filter((r) => r.severity === 'critical' && r.status === 'open').length;

  const columns: TableProps<BugReport>['columns'] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      render: (id) => <Text type="secondary">#{id}</Text>,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      render: (title, record) => (
        <Space direction="vertical" size={0}>
          <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => openDetail(record)}>
            {title}
          </Button>
          {record.page_context && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.page_context}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      width: 100,
      render: (severity: BugSeverity) => (
        <Tag color={severityConfig[severity].color}>{severityConfig[severity].label}</Tag>
      ),
      filters: [
        { text: 'Low', value: 'low' },
        { text: 'Medium', value: 'medium' },
        { text: 'High', value: 'high' },
        { text: 'Critical', value: 'critical' },
      ],
      onFilter: (value, record) => record.severity === value,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 140,
      render: (status: BugStatus, record) => (
        <Select
          value={status}
          size="small"
          style={{ width: 130 }}
          onChange={(val) => handleStatusChange(record, val as BugStatus)}
          options={Object.entries(statusConfig).map(([k, v]) => ({
            value: k,
            label: (
              <Space size={4}>
                {v.icon}
                {v.label}
              </Space>
            ),
          }))}
        />
      ),
    },
    {
      title: 'Reported By',
      dataIndex: 'reported_by_name',
      width: 130,
    },
    {
      title: 'Submitted',
      dataIndex: 'created_at',
      width: 120,
      render: (date) => dayjs(date).format('MMM D, YYYY'),
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'GitHub',
      dataIndex: 'github_issue_url',
      width: 80,
      render: (url: string | null, record) =>
        url ? (
          <Tooltip title={`GitHub Issue #${record.github_issue_number}`}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <GithubOutlined style={{ fontSize: 16 }} />
            </a>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="View details">
            <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
          </Tooltip>
          {record.status !== 'resolved' && record.status !== 'closed' && (
            <Tooltip title="Mark resolved">
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => openResolve(record)}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Delete this bug report?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Summary bar */}
      <Space style={{ marginBottom: 16 }} size="large">
        <Badge count={openCounts} showZero color={token.colorPrimary}>
          <Button icon={<BugOutlined />}>Open Reports</Button>
        </Badge>
        {criticalCount > 0 && (
          <Tag color="red" icon={<ExclamationCircleOutlined />}>
            {criticalCount} Critical
          </Tag>
        )}
      </Space>

      {/* Filters */}
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Filter by status"
          allowClear
          style={{ width: 160 }}
          value={statusFilter || undefined}
          onChange={(v) => setStatusFilter(v || '')}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
        <Select
          placeholder="Filter by severity"
          allowClear
          style={{ width: 160 }}
          value={severityFilter || undefined}
          onChange={(v) => setSeverityFilter(v || '')}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical' },
          ]}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={reports}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true }}
        rowClassName={(record) =>
          record.severity === 'critical' && record.status === 'open' ? 'ant-table-row-danger' : ''
        }
      />

      {/* Detail modal */}
      <Modal
        title={
          <Space>
            <BugOutlined />
            Bug Report #{selectedReport?.id}
          </Space>
        }
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={[
          selectedReport &&
            selectedReport.status !== 'resolved' &&
            selectedReport.status !== 'closed' && (
              <Button
                key="resolve"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  setDetailOpen(false);
                  openResolve(selectedReport);
                }}
              >
                Mark Resolved
              </Button>
            ),
          <Button key="close" onClick={() => setDetailOpen(false)}>
            Close
          </Button>,
        ]}
        width={640}
      >
        {selectedReport && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Title">{selectedReport.title}</Descriptions.Item>
            <Descriptions.Item label="Severity">
              <Tag color={severityConfig[selectedReport.severity].color}>
                {severityConfig[selectedReport.severity].label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge
                status={statusConfig[selectedReport.status].color as 'error' | 'processing' | 'success' | 'default'}
                text={statusConfig[selectedReport.status].label}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Page / Feature">
              {selectedReport.page_context || <Text type="secondary">Not specified</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="Reported By">{selectedReport.reported_by_name}</Descriptions.Item>
            <Descriptions.Item label="Submitted">
              {dayjs(selectedReport.created_at).format('MMM D, YYYY h:mm A')}
            </Descriptions.Item>
            <Descriptions.Item label="Description">
              <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {selectedReport.description}
              </Paragraph>
            </Descriptions.Item>
            {selectedReport.steps_to_reproduce && (
              <Descriptions.Item label="Steps to Reproduce">
                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {selectedReport.steps_to_reproduce}
                </Paragraph>
              </Descriptions.Item>
            )}
            {selectedReport.resolution_notes && (
              <Descriptions.Item label="Resolution Notes">
                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {selectedReport.resolution_notes}
                </Paragraph>
              </Descriptions.Item>
            )}
            {selectedReport.resolved_at && (
              <Descriptions.Item label="Resolved At">
                {dayjs(selectedReport.resolved_at).format('MMM D, YYYY h:mm A')}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* Resolve modal */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined />
            Resolve Bug Report
          </Space>
        }
        open={resolveOpen}
        onCancel={() => {
          setResolveOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Mark Resolved"
        okButtonProps={{ loading: isUpdating }}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleResolve}>
          <Form.Item label="Resolution Notes" name="resolution_notes">
            <TextArea
              rows={4}
              placeholder="Describe what was fixed or why this is being closed..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
