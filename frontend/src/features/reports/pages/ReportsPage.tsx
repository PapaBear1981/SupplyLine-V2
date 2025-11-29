import { useState } from 'react';
import { Card, Tabs, Space, DatePicker, Select, Button, Dropdown, message } from 'antd';
import {
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  SettingOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import type { RangePickerProps } from 'antd/es/date-picker';

import { ToolReports } from '../components/ToolReports';
import { ChemicalReports } from '../components/ChemicalReports';
import { KitReports } from '../components/KitReports';
import { OrderReports } from '../components/OrderReports';
import { AdminReports } from '../components/AdminReports';
import type { ReportTimeframe, ExportFormat } from '../types';

import styles from './ReportsPage.module.scss';

const { RangePicker } = DatePicker;

const timeframeOptions = [
  { value: 'day', label: 'Last 24 Hours' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
  { value: 'quarter', label: 'Last 90 Days' },
  { value: 'year', label: 'Last Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState('tools');
  const [timeframe, setTimeframe] = useState<ReportTimeframe>('month');
  const [customDateRange, setCustomDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);
  const [isExporting, setIsExporting] = useState(false);

  // Keep track of current report data for exports
  const [currentReportData, setCurrentReportData] = useState<unknown>(null);
  const [currentReportType, setCurrentReportType] = useState<string>('');

  const handleTimeframeChange = (value: string) => {
    if (value === 'custom') {
      setTimeframe('month');
    } else {
      setTimeframe(value as ReportTimeframe);
      setCustomDateRange([null, null]);
    }
  };

  const handleDateRangeChange: RangePickerProps['onChange'] = (dates) => {
    setCustomDateRange(dates as [Dayjs | null, Dayjs | null]);
  };

  const getDateParams = (): Record<string, string> => {
    if (customDateRange[0] && customDateRange[1]) {
      return {
        start_date: customDateRange[0].format('YYYY-MM-DD'),
        end_date: customDateRange[1].format('YYYY-MM-DD'),
      };
    }
    return { timeframe: timeframe };
  };

  const handleExport = async (format: ExportFormat) => {
    if (!currentReportData || !currentReportType) {
      message.warning('No report data available to export');
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch(`/api/reports/export/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          report_type: currentReportType,
          report_data: currentReportData,
          timeframe,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentReportType}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      message.success(`Report exported as ${format.toUpperCase()}`);
    } catch {
      message.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const exportMenuItems = [
    {
      key: 'pdf',
      icon: <FilePdfOutlined />,
      label: 'Export as PDF',
      onClick: () => handleExport('pdf'),
    },
    {
      key: 'excel',
      icon: <FileExcelOutlined />,
      label: 'Export as Excel',
      onClick: () => handleExport('excel'),
    },
  ];

  const tabItems = [
    {
      key: 'tools',
      label: (
        <span>
          <ToolOutlined />
          Tools
        </span>
      ),
      children: (
        <ToolReports
          timeframe={timeframe}
          dateParams={getDateParams()}
          onReportDataChange={(data, type) => {
            setCurrentReportData(data);
            setCurrentReportType(type);
          }}
        />
      ),
    },
    {
      key: 'chemicals',
      label: (
        <span>
          <ExperimentOutlined />
          Chemicals
        </span>
      ),
      children: (
        <ChemicalReports
          timeframe={timeframe}
          dateParams={getDateParams()}
          onReportDataChange={(data, type) => {
            setCurrentReportData(data);
            setCurrentReportType(type);
          }}
        />
      ),
    },
    {
      key: 'kits',
      label: (
        <span>
          <InboxOutlined />
          Kits
        </span>
      ),
      children: (
        <KitReports
          timeframe={timeframe}
          dateParams={getDateParams()}
          onReportDataChange={(data, type) => {
            setCurrentReportData(data);
            setCurrentReportType(type);
          }}
        />
      ),
    },
    {
      key: 'orders',
      label: (
        <span>
          <ShoppingCartOutlined />
          Orders & Requests
        </span>
      ),
      children: (
        <OrderReports
          timeframe={timeframe}
          dateParams={getDateParams()}
          onReportDataChange={(data, type) => {
            setCurrentReportData(data);
            setCurrentReportType(type);
          }}
        />
      ),
    },
    {
      key: 'admin',
      label: (
        <span>
          <SettingOutlined />
          Admin
        </span>
      ),
      children: (
        <AdminReports
          timeframe={timeframe}
          dateParams={getDateParams()}
          onReportDataChange={(data, type) => {
            setCurrentReportData(data);
            setCurrentReportType(type);
          }}
        />
      ),
    },
  ];

  return (
    <div className={styles.reportsPage}>
      <Card className={styles.headerCard}>
        <div className={styles.header}>
          <h1>Reports & Analytics</h1>
          <Space size="middle">
            <Select
              value={customDateRange[0] ? 'custom' : timeframe}
              onChange={handleTimeframeChange}
              options={timeframeOptions}
              style={{ width: 160 }}
            />
            <RangePicker
              value={customDateRange}
              onChange={handleDateRangeChange}
              allowClear
              disabled={!(customDateRange[0] || customDateRange[1])}
            />
            <Dropdown
              menu={{ items: exportMenuItems }}
              placement="bottomRight"
            >
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                loading={isExporting}
              >
                Export
              </Button>
            </Dropdown>
          </Space>
        </div>
      </Card>

      <Card className={styles.contentCard}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
          className={styles.reportTabs}
        />
      </Card>
    </div>
  );
}

export default ReportsPage;
