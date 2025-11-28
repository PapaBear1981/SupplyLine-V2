import { Card, List, Typography, Badge, Empty, Skeleton, Tabs } from 'antd';
import { AlertOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import {
    useGetLateOrdersQuery,
    useGetOverdueCalibrationsQuery,
    useGetDueCalibrationsQuery
} from '../services/dashboardApi';
import { useNavigate } from 'react-router-dom';

const { Text, Title } = Typography;

export const AlertsWidget = () => {
    const navigate = useNavigate();

    const { data: lateOrdersData, isLoading: isLoadingOrders } = useGetLateOrdersQuery();
    const { data: overdueCalData, isLoading: isLoadingOverdue } = useGetOverdueCalibrationsQuery();
    const { data: dueCalData, isLoading: isLoadingDue } = useGetDueCalibrationsQuery();

    const lateOrders = lateOrdersData?.orders || [];
    const overdueCalibrations = overdueCalData?.tools || [];
    const dueCalibrations = dueCalData?.tools || [];

    const isLoading = isLoadingOrders || isLoadingOverdue || isLoadingDue;

    const renderAlertItem = (item: any, type: 'order' | 'calibration_overdue' | 'calibration_due') => {
        let title, description, icon, color, link;

        if (type === 'order') {
            title = `Order #${item.order_number} Late`;
            description = `Expected: ${item.expected_delivery_date}`;
            icon = <ClockCircleOutlined />;
            color = 'red';
            link = `/orders/${item.id}`;
        } else if (type === 'calibration_overdue') {
            title = `Tool ${item.tool_number} Overdue`;
            description = `Due: ${item.next_calibration_date}`;
            icon = <WarningOutlined />;
            color = 'red';
            link = `/tools/${item.id}`;
        } else {
            title = `Tool ${item.tool_number} Due Soon`;
            description = `Due: ${item.next_calibration_date}`;
            icon = <WarningOutlined />;
            color = 'orange';
            link = `/tools/${item.id}`;
        }

        return (
            <List.Item
                onClick={() => navigate(link)}
                style={{ cursor: 'pointer' }}
                className="hover:bg-gray-50 transition-colors"
            >
                <List.Item.Meta
                    avatar={<Badge count={<span style={{ color }}>{icon}</span>} style={{ backgroundColor: 'transparent' }} />}
                    title={<Text strong>{title}</Text>}
                    description={description}
                />
            </List.Item>
        );
    };

    const items = [
        {
            key: '1',
            label: (
                <span>
                    Late Orders
                    {lateOrders.length > 0 && <Badge count={lateOrders.length} style={{ marginLeft: 8 }} />}
                </span>
            ),
            children: (
                <List
                    dataSource={lateOrders}
                    renderItem={(item) => renderAlertItem(item, 'order')}
                    locale={{ emptyText: <Empty description="No late orders" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                />
            ),
        },
        {
            key: '2',
            label: (
                <span>
                    Overdue Tools
                    {overdueCalibrations.length > 0 && <Badge count={overdueCalibrations.length} style={{ marginLeft: 8 }} />}
                </span>
            ),
            children: (
                <List
                    dataSource={overdueCalibrations}
                    renderItem={(item) => renderAlertItem(item, 'calibration_overdue')}
                    locale={{ emptyText: <Empty description="No overdue tools" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                />
            ),
        },
        {
            key: '3',
            label: (
                <span>
                    Due Soon
                    {dueCalibrations.length > 0 && <Badge count={dueCalibrations.length} style={{ marginLeft: 8, backgroundColor: '#faad14' }} />}
                </span>
            ),
            children: (
                <List
                    dataSource={dueCalibrations}
                    renderItem={(item) => renderAlertItem(item, 'calibration_due')}
                    locale={{ emptyText: <Empty description="No tools due soon" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                />
            ),
        },
    ];

    return (
        <Card
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertOutlined />
                    <Title level={4} style={{ margin: 0 }}>Alerts</Title>
                </div>
            }
            bordered={false}
            className="shadow-sm h-full"
            bodyStyle={{ padding: '0 24px 24px' }}
        >
            <Skeleton loading={isLoading} active>
                <Tabs defaultActiveKey="1" items={items} />
            </Skeleton>
        </Card>
    );
};
