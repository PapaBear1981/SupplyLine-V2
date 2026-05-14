import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Divider,
  Radio,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { RadioChangeEvent } from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import {
  CloudUploadOutlined,
  DownloadOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  downloadTemplate,
  isBulkImportResponse,
  useBulkImportChemicalsMutation,
  useBulkImportToolsMutation,
  type BulkImportResponse,
  type BulkImportType,
} from '../services/bulkImportApi';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

export const BulkImports = () => {
  const [importType, setImportType] = useState<BulkImportType>('chemicals');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [createMissingParts, setCreateMissingParts] = useState(false);
  const [result, setResult] = useState<BulkImportResponse | null>(null);

  const [importChemicals, { isLoading: chemLoading }] = useBulkImportChemicalsMutation();
  const [importTools, { isLoading: toolLoading }] = useBulkImportToolsMutation();
  const isLoading = chemLoading || toolLoading;

  const isChemicals = importType === 'chemicals';

  const draggerProps: UploadProps = useMemo(
    () => ({
      multiple: false,
      maxCount: 1,
      accept: '.csv,text/csv',
      // Returning false prevents auto-upload — we drive the request manually.
      beforeUpload: (file) => {
        setFileList([file as unknown as UploadFile]);
        return false;
      },
      onRemove: () => {
        setFileList([]);
      },
      fileList,
    }),
    [fileList],
  );

  const handleTypeChange = (e: RadioChangeEvent) => {
    setImportType(e.target.value as BulkImportType);
    setResult(null);
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate(importType);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown error';
      message.error(`Failed to download template: ${detail}`);
    }
  };

  const handleImport = async () => {
    const file = fileList[0]?.originFileObj ?? (fileList[0] as unknown as File | undefined);
    if (!file) {
      message.warning('Select a CSV file before importing.');
      return;
    }

    try {
      const req = {
        file,
        skipDuplicates,
        ...(isChemicals ? { createMissingParts } : {}),
      };
      const response = isChemicals
        ? await importChemicals(req).unwrap()
        : await importTools(req).unwrap();
      setResult(response);

      if (response.success_count > 0 && response.error_count === 0) {
        message.success(response.message);
      } else if (response.success_count > 0 && response.error_count > 0) {
        message.warning(response.message);
      } else {
        message.error(response.message);
      }
    } catch (err) {
      // When every row failed the backend responds with HTTP 400 but still
      // sends the full structured result. RTK Query's unwrap() throws on
      // 400, so surface that body as a normal result to keep the per-row
      // error table visible.
      const data = err && typeof err === 'object' && 'data' in err
        ? (err as { data?: unknown }).data
        : undefined;
      if (isBulkImportResponse(data)) {
        setResult(data);
        message.error(data.message);
        return;
      }
      const detail =
        data && typeof data === 'object'
          ? ((data as { error?: string; message?: string }).error ??
            (data as { error?: string; message?: string }).message)
          : undefined;
      message.error(detail ?? 'Import failed. Check the server logs.');
    }
  };

  return (
    <div>
      <Title level={4} style={{ marginTop: 0 }}>
        Bulk Import
      </Title>
      <Paragraph type="secondary">
        Upload a CSV file to bulk import tools or chemicals. Download a template to see the expected
        columns.
      </Paragraph>

      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>Import type</Text>
            <div style={{ marginTop: 8 }}>
              <Radio.Group value={importType} onChange={handleTypeChange} optionType="button" buttonStyle="solid">
                <Radio.Button value="chemicals">Chemicals</Radio.Button>
                <Radio.Button value="tools">Tools</Radio.Button>
              </Radio.Group>
            </div>
          </div>

          <Dragger {...draggerProps} style={{ padding: 16 }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag a CSV file to this area</p>
            <p className="ant-upload-hint">
              One file at a time. Use the template below if you're unsure of the column order.
            </p>
          </Dragger>

          <Space wrap>
            <Checkbox checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)}>
              Skip duplicates (recommended)
            </Checkbox>

            {isChemicals && (
              <Checkbox
                checked={createMissingParts}
                onChange={(e) => setCreateMissingParts(e.target.checked)}
              >
                Add new part numbers to the master chemical list
              </Checkbox>
            )}
          </Space>

          {isChemicals && (
            <Alert
              type={createMissingParts ? 'warning' : 'info'}
              showIcon
              message={
                createMissingParts
                  ? 'Any part number on the CSV that is not on the master chemical list will be ADDED to it, using the description/manufacturer/category from the row.'
                  : 'Chemical lots can only be imported for part numbers that already exist on the master chemical list. Rows referencing unknown parts will be rejected.'
              }
            />
          )}

          <Space>
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              onClick={handleImport}
              loading={isLoading}
              disabled={fileList.length === 0}
            >
              Import
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
              Download {isChemicals ? 'chemical' : 'tool'} template
            </Button>
          </Space>
        </Space>
      </Card>

      {result && (
        <Card style={{ marginTop: 16 }} title="Import results">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap>
              <Tag color="green">{result.success_count} imported</Tag>
              <Tag color="orange">{result.skipped_count} skipped</Tag>
              <Tag color={result.error_count > 0 ? 'red' : 'default'}>
                {result.error_count} errors
              </Tag>
              {result.created_master_parts && result.created_master_parts.length > 0 && (
                <Tag color="blue">
                  {result.created_master_parts.length} new master part(s) created
                </Tag>
              )}
            </Space>

            <Text>{result.message}</Text>

            {result.created_master_parts && result.created_master_parts.length > 0 && (
              <div>
                <Divider style={{ margin: '8px 0' }} />
                <Text strong>New master chemical parts:</Text>
                <div style={{ marginTop: 4 }}>
                  {result.created_master_parts.map((pn) => (
                    <Tag key={pn} color="blue" style={{ marginBottom: 4 }}>
                      {pn}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <>
                <Divider style={{ margin: '8px 0' }} />
                <Text strong>Errors</Text>
                <Table
                  size="small"
                  rowKey={(row) => `${row.row}-${row.error}`}
                  dataSource={result.errors}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  columns={[
                    { title: 'Row', dataIndex: 'row', width: 80 },
                    { title: 'Error', dataIndex: 'error' },
                  ]}
                />
              </>
            )}

            {result.skipped_items.length > 0 && (
              <>
                <Divider style={{ margin: '8px 0' }} />
                <Text strong>Skipped</Text>
                <Table
                  size="small"
                  rowKey={(row) => `${row.row}-${row.reason}`}
                  dataSource={result.skipped_items}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  columns={[
                    { title: 'Row', dataIndex: 'row', width: 80 },
                    { title: 'Reason', dataIndex: 'reason' },
                  ]}
                />
              </>
            )}
          </Space>
        </Card>
      )}
    </div>
  );
};
