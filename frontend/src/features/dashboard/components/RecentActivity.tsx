import { Card, List, Typography, Skeleton, Avatar } from 'antd';
import { HistoryOutlined, ShoppingCartOutlined, FileTextOutlined } from '@ant-design/icons';
import { useGetRecentOrdersQuery, useGetRecentRequestsQuery } from '../services/dashboardApi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;

export const RecentActivity = () => {
    const { data: recentOrdersData, isLoading: isLoadingOrders } = useGetRecentOrdersQuery();
    const { data: recentRequestsData, isLoading: isLoadingRequests } = useGetRecentRequestsQuery();

    const orders = recentOrdersData?.orders || [];
    const requests = recentRequestsData?.requests || [];

    const isLoading = isLoadingOrders || isLoadingRequests;

    // Combine and sort activities
    const activities = [
        ...orders.map((o: any) => ({
            type: 'order',
            id: o.id,
            title: `Order #${o.order_number} Created`,
            description: `${o.vendor_name} - ${o.status}`,
            timestamp: o.created_at,
            user: o.created_by_name,
        })),
        ...requests.map((r: any) => ({
            type: 'request',
            id: r.id,
            title: `Request #${r.id} Submitted`,
            description: `${r.status} - ${r.priority}`,
            timestamp: r.created_at,
            user: r.requester_name,
        })),
    ].sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf())
        .slice(0, 10); // Show top 10

    return (
        <Card
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HistoryOutlined />
                    <Title level={4} style={{ margin: 0 }}>Recent Activity</Title>
                </div>
            }
            bordered={false}
            className="shadow-sm h-full"
        >
            <Skeleton loading={isLoading} active avatar>
                <List
                    itemLayout="horizontal"
                    dataSource={activities}
                    renderItem={(item) => (
                        <List.Item>
                            <List.Item.Meta
                                avatar={
                                    <Avatar
                                        icon={item.type === 'order' ? <ShoppingCartOutlined /> : <FileTextOutlined />}
                                        style={{ backgroundColor: item.type === 'order' ? '#1890ff' : '#52c41a' }}
                                    />
                                }
                                title={
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text strong>{item.title}</Text>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>{dayjs(item.timestamp).fromNow()}</Text>
                                    </div>
                                }
                                description={
                                    <div>
                                        <div>{item.description}</div>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>by {item.user}</Text>
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />
            </Skeleton>
        </Card>
    );
};
