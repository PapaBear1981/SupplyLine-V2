import { useState } from 'react';
import { Tabs, Card, Grid, Skeleton, Tag, List, Space, ProgressBar } from 'antd-mobile';
import {
  ToolOutlined,
  ExperimentOutlined,
  InboxOutlined,
  ShoppingCartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';

import {
  useGetToolInventoryReportQuery,
  useGetCheckoutHistoryReportQuery,
  useGetCalibrationReportQuery,
} from '../../services/reportsApi';
import type { ReportTimeframe } from '../../types';

import './MobileReports.css';

interface MobileReportsProps {
  timeframe: ReportTimeframe;
  dateParams: Record<string, string | ReportTimeframe>;
}

export const MobileReports = ({ timeframe, dateParams }: MobileReportsProps) => {
  const [activeTab, setActiveTab] = useState('tools');

  // Fetch data for all report types
  const { data: inventoryData, isLoading: inventoryLoading } = useGetToolInventoryReportQuery(dateParams);
  const { data: checkoutData, isLoading: checkoutLoading } = useGetCheckoutHistoryReportQuery(dateParams);
  const { data: calibrationData, isLoading: calibrationLoading } = useGetCalibrationReportQuery(dateParams);

  const renderToolsTab = () => {
    if (inventoryLoading) {
      return <Skeleton.Paragraph lineCount={8} animated />;
    }

    if (!inventoryData) {
      return (
        <div className="mobile-reports-empty">
          <p>No inventory data available</p>
        </div>
      );
    }

    return (
      <div className="mobile-reports-content">
        {/* Summary Stats */}
        <div className="mobile-reports-section">
          <h3 className="mobile-reports-section-title">Inventory Summary</h3>
          <Grid columns={2} gap={12}>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-icon" style={{ color: '#1890ff', background: '#e6f7ff' }}>
                  <ToolOutlined />
                </div>
                <div className="stat-value">{inventoryData.summary.total}</div>
                <div className="stat-label">Total Tools</div>
              </Card>
            </Grid.Item>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-icon" style={{ color: '#52c41a', background: '#f6ffed' }}>
                  <CheckCircleOutlined />
                </div>
                <div className="stat-value">{inventoryData.summary.available}</div>
                <div className="stat-label">Available</div>
              </Card>
            </Grid.Item>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-icon" style={{ color: '#faad14', background: '#fffbe6' }}>
                  <ClockCircleOutlined />
                </div>
                <div className="stat-value">{inventoryData.summary.checked_out}</div>
                <div className="stat-label">Checked Out</div>
              </Card>
            </Grid.Item>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-icon" style={{ color: '#ff4d4f', background: '#fff2f0' }}>
                  <WarningOutlined />
                </div>
                <div className="stat-value">{inventoryData.summary.maintenance}</div>
                <div className="stat-label">Maintenance</div>
              </Card>
            </Grid.Item>
          </Grid>
        </div>

        {/* By Category */}
        <div className="mobile-reports-section">
          <h3 className="mobile-reports-section-title">By Category</h3>
          <Card className="mobile-reports-card">
            <List>
              {inventoryData.byCategory.slice(0, 8).map((category, index) => (
                <List.Item
                  key={index}
                  extra={<Tag color="primary">{category.value}</Tag>}
                >
                  {category.name}
                </List.Item>
              ))}
            </List>
          </Card>
        </div>

        {/* By Location */}
        <div className="mobile-reports-section">
          <h3 className="mobile-reports-section-title">By Location</h3>
          <Card className="mobile-reports-card">
            <List>
              {inventoryData.byLocation.slice(0, 8).map((location, index) => (
                <List.Item
                  key={index}
                  extra={<Tag color="default">{location.value}</Tag>}
                >
                  {location.name}
                </List.Item>
              ))}
            </List>
          </Card>
        </div>
      </div>
    );
  };

  const renderChemicalsTab = () => {
    return (
      <div className="mobile-reports-content">
        <div className="mobile-reports-empty">
          <p>Chemical reports data</p>
          <p style={{ fontSize: 13, color: 'var(--adm-color-text-secondary)' }}>
            Timeframe: {timeframe}
          </p>
        </div>
      </div>
    );
  };

  const renderKitsTab = () => {
    return (
      <div className="mobile-reports-content">
        <div className="mobile-reports-empty">
          <p>Kit reports data</p>
          <p style={{ fontSize: 13, color: 'var(--adm-color-text-secondary)' }}>
            Timeframe: {timeframe}
          </p>
        </div>
      </div>
    );
  };

  const renderOrdersTab = () => {
    if (checkoutLoading) {
      return <Skeleton.Paragraph lineCount={8} animated />;
    }

    if (!checkoutData) {
      return (
        <div className="mobile-reports-empty">
          <p>No checkout data available</p>
        </div>
      );
    }

    return (
      <div className="mobile-reports-content">
        {/* Summary Stats */}
        <div className="mobile-reports-section">
          <h3 className="mobile-reports-section-title">Checkout Summary</h3>
          <Grid columns={2} gap={12}>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-icon" style={{ color: '#1890ff', background: '#e6f7ff' }}>
                  <ShoppingCartOutlined />
                </div>
                <div className="stat-value">{checkoutData.stats.totalCheckouts}</div>
                <div className="stat-label">Total Checkouts</div>
              </Card>
            </Grid.Item>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-icon" style={{ color: '#52c41a', background: '#f6ffed' }}>
                  <CheckCircleOutlined />
                </div>
                <div className="stat-value">{checkoutData.stats.returnedCheckouts}</div>
                <div className="stat-label">Returned</div>
              </Card>
            </Grid.Item>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-icon" style={{ color: '#faad14', background: '#fffbe6' }}>
                  <ClockCircleOutlined />
                </div>
                <div className="stat-value">{checkoutData.stats.currentlyCheckedOut}</div>
                <div className="stat-label">Currently Out</div>
              </Card>
            </Grid.Item>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-value">{checkoutData.stats.averageDuration.toFixed(1)}</div>
                <div className="stat-label">Avg Days</div>
              </Card>
            </Grid.Item>
          </Grid>
        </div>

        {/* Recent Checkouts */}
        <div className="mobile-reports-section">
          <h3 className="mobile-reports-section-title">Recent Checkouts</h3>
          <Card className="mobile-reports-card">
            <List>
              {checkoutData.checkouts.slice(0, 10).map((checkout, index) => (
                <List.Item
                  key={index}
                  description={
                    <Space direction="vertical" style={{ '--gap': '4px' }}>
                      <span style={{ fontSize: 13, color: 'var(--adm-color-text-secondary)' }}>
                        {checkout.user_name} • {checkout.department}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--adm-color-text-secondary)' }}>
                        {new Date(checkout.checkout_date).toLocaleDateString()}
                        {checkout.return_date && ` - ${new Date(checkout.return_date).toLocaleDateString()}`}
                      </span>
                    </Space>
                  }
                  extra={
                    checkout.return_date ? (
                      <Tag color="success">Returned</Tag>
                    ) : (
                      <Tag color="warning">Active</Tag>
                    )
                  }
                >
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {checkout.tool_number}
                  </div>
                </List.Item>
              ))}
            </List>
          </Card>
        </div>
      </div>
    );
  };

  const renderCalibrationTab = () => {
    if (calibrationLoading) {
      return <Skeleton.Paragraph lineCount={8} animated />;
    }

    if (!calibrationData) {
      return (
        <div className="mobile-reports-empty">
          <p>No calibration data available</p>
        </div>
      );
    }

    const total = calibrationData.summary.total || 1;
    const currentPercent = Math.round((calibrationData.summary.current / total) * 100);
    const dueSoonPercent = Math.round((calibrationData.summary.dueSoon / total) * 100);
    const overduePercent = Math.round((calibrationData.summary.overdue / total) * 100);

    return (
      <div className="mobile-reports-content">
        {/* Summary Stats */}
        <div className="mobile-reports-section">
          <h3 className="mobile-reports-section-title">Calibration Status</h3>
          <Grid columns={2} gap={12}>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-value">{calibrationData.summary.total}</div>
                <div className="stat-label">Requiring Calibration</div>
              </Card>
            </Grid.Item>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-icon" style={{ color: '#52c41a', background: '#f6ffed' }}>
                  <CheckCircleOutlined />
                </div>
                <div className="stat-value">{calibrationData.summary.current}</div>
                <div className="stat-label">Current</div>
              </Card>
            </Grid.Item>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-icon" style={{ color: '#faad14', background: '#fffbe6' }}>
                  <ClockCircleOutlined />
                </div>
                <div className="stat-value">{calibrationData.summary.dueSoon}</div>
                <div className="stat-label">Due Soon</div>
              </Card>
            </Grid.Item>
            <Grid.Item>
              <Card className="mobile-reports-stat-card">
                <div className="stat-icon" style={{ color: '#ff4d4f', background: '#fff2f0' }}>
                  <WarningOutlined />
                </div>
                <div className="stat-value">{calibrationData.summary.overdue}</div>
                <div className="stat-label">Overdue</div>
              </Card>
            </Grid.Item>
          </Grid>
        </div>

        {/* Progress Bars */}
        <div className="mobile-reports-section">
          <h3 className="mobile-reports-section-title">Status Distribution</h3>
          <Card className="mobile-reports-card">
            <div className="calibration-progress">
              <div className="progress-item">
                <div className="progress-header">
                  <span>Current</span>
                  <span className="progress-value" style={{ color: '#52c41a' }}>
                    {calibrationData.summary.current} ({currentPercent}%)
                  </span>
                </div>
                <ProgressBar percent={currentPercent} style={{ '--fill-color': '#52c41a' }} />
              </div>
              <div className="progress-item">
                <div className="progress-header">
                  <span>Due Soon</span>
                  <span className="progress-value" style={{ color: '#faad14' }}>
                    {calibrationData.summary.dueSoon} ({dueSoonPercent}%)
                  </span>
                </div>
                <ProgressBar percent={dueSoonPercent} style={{ '--fill-color': '#faad14' }} />
              </div>
              <div className="progress-item">
                <div className="progress-header">
                  <span>Overdue</span>
                  <span className="progress-value" style={{ color: '#ff4d4f' }}>
                    {calibrationData.summary.overdue} ({overduePercent}%)
                  </span>
                </div>
                <ProgressBar percent={overduePercent} style={{ '--fill-color': '#ff4d4f' }} />
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Items */}
        <div className="mobile-reports-section">
          <h3 className="mobile-reports-section-title">Calibration Items</h3>
          <Card className="mobile-reports-card">
            <List>
              {calibrationData.tools.slice(0, 10).map((tool, index) => {
                const daysUntilDue = tool.days_until_due || 0;
                let statusTag;
                if (daysUntilDue < 0) {
                  statusTag = <Tag color="danger">{Math.abs(daysUntilDue)} days overdue</Tag>;
                } else if (daysUntilDue <= 14) {
                  statusTag = <Tag color="warning">{daysUntilDue} days</Tag>;
                } else {
                  statusTag = <Tag color="success">{daysUntilDue} days</Tag>;
                }

                return (
                  <List.Item
                    key={index}
                    description={
                      <Space direction="vertical" style={{ '--gap': '4px' }}>
                        <span style={{ fontSize: 13, color: 'var(--adm-color-text-secondary)' }}>
                          {tool.serial_number}
                        </span>
                        {tool.calibration_due_date && (
                          <span style={{ fontSize: 12, color: 'var(--adm-color-text-secondary)' }}>
                            Due: {new Date(tool.calibration_due_date).toLocaleDateString()}
                          </span>
                        )}
                      </Space>
                    }
                    extra={statusTag}
                  >
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {tool.tool_number}
                    </div>
                  </List.Item>
                );
              })}
            </List>
          </Card>
        </div>
      </div>
    );
  };

  const tabs = [
    {
      key: 'tools',
      title: (
        <div className="mobile-reports-tab">
          <ToolOutlined style={{ fontSize: 18 }} />
          <span>Tools</span>
        </div>
      ),
      content: renderToolsTab(),
    },
    {
      key: 'chemicals',
      title: (
        <div className="mobile-reports-tab">
          <ExperimentOutlined style={{ fontSize: 18 }} />
          <span>Chemicals</span>
        </div>
      ),
      content: renderChemicalsTab(),
    },
    {
      key: 'kits',
      title: (
        <div className="mobile-reports-tab">
          <InboxOutlined style={{ fontSize: 18 }} />
          <span>Kits</span>
        </div>
      ),
      content: renderKitsTab(),
    },
    {
      key: 'orders',
      title: (
        <div className="mobile-reports-tab">
          <ShoppingCartOutlined style={{ fontSize: 18 }} />
          <span>Orders</span>
        </div>
      ),
      content: renderOrdersTab(),
    },
    {
      key: 'calibration',
      title: (
        <div className="mobile-reports-tab">
          <ClockCircleOutlined style={{ fontSize: 18 }} />
          <span>Calibration</span>
        </div>
      ),
      content: renderCalibrationTab(),
    },
  ];

  return (
    <div className="mobile-reports">
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {tabs.map((tab) => (
          <Tabs.Tab key={tab.key} title={tab.title}>
            {tab.content}
          </Tabs.Tab>
        ))}
      </Tabs>
    </div>
  );
};
