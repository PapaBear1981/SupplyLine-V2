import { Card, Statistic, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useSocket } from '../../../shared/hooks/useSocket';
import { useState, useEffect } from 'react';

const { Title } = Typography;

export const ActiveUsersWidget = () => {
    const socket = useSocket();
    const [activeUsersCount, setActiveUsersCount] = useState<number>(0);

    useEffect(() => {
        if (socket) {
            socket.on('user_online', () => {
                setActiveUsersCount(prev => prev + 1);
            });

            socket.on('user_offline', () => {
                setActiveUsersCount(prev => Math.max(0, prev - 1));
            });

            socket.on('active_users_count', (data: any) => {
                if (data && typeof data.count === 'number') {
                    setActiveUsersCount(data.count);
                }
            });

            return () => {
                socket.off('user_online');
                socket.off('user_offline');
                socket.off('active_users_count');
            };
        }
    }, [socket]);

    return (
        <Card bordered={false} className="shadow-sm h-full" bodyStyle={{ padding: '24px' }}>
            <Statistic
                title={<Title level={4} style={{ margin: 0 }}>Active Users</Title>}
                value={activeUsersCount}
                prefix={<UserOutlined style={{ color: '#52c41a' }} />}
                suffix="Online"
                valueStyle={{ color: '#3f8600' }}
            />
        </Card>
    );
};
