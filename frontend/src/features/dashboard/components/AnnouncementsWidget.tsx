import { Card, List, Tag, Typography, Empty, Skeleton } from 'antd';
import { NotificationOutlined } from '@ant-design/icons';
import { useGetAnnouncementsQuery } from '../services/dashboardApi';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

export const AnnouncementsWidget = () => {
    const { data: response, isLoading } = useGetAnnouncementsQuery();
    const announcements = response?.announcements || [];

    const getPriorityColor = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case 'high':
            case 'critical':
                return 'red';
            case 'medium':
                return 'orange';
            default:
                return 'blue';
        }
    };

    return (
        <Card
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <NotificationOutlined />
                    <Title level={4} style={{ margin: 0 }}>Announcements</Title>
                </div>
            }
            bordered={false}
            className="shadow-sm h-full"
        >
            <Skeleton loading={isLoading} active>
                {announcements.length > 0 ? (
                    <List
                        itemLayout="horizontal"
                        dataSource={announcements}
                        renderItem={(item: any) => (
                            <List.Item>
                                <List.Item.Meta
                                    title={
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text strong>{item.title}</Text>
                                            <Tag color={getPriorityColor(item.priority)}>{item.priority}</Tag>
                                        </div>
                                    }
                                    description={
                                        <div>
                                            <div style={{ marginBottom: '4px' }}>{item.content}</div>
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                {dayjs(item.created_at).format('MMM D, YYYY h:mm A')}
                                            </Text>
                                        </div>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                ) : (
                    <Empty description="No active announcements" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
            </Skeleton>
        </Card>
    );
};
