import { Card, Typography } from 'antd';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useGetDashboardStatsQuery } from '../services/dashboardApi';

const { Title } = Typography;

export const ToolsDistributionChart = () => {
    const { data: stats } = useGetDashboardStatsQuery();

    // Mock data distribution based on total tools if specific distribution endpoint isn't available
    // In a real scenario, we'd fetch specific status counts
    const data = [
        { name: 'Available', value: stats?.totalTools ? Math.floor(stats.totalTools * 0.6) : 0, color: '#52c41a' },
        { name: 'In Use', value: stats?.totalTools ? Math.floor(stats.totalTools * 0.3) : 0, color: '#1890ff' },
        { name: 'Maintenance', value: stats?.totalTools ? Math.floor(stats.totalTools * 0.1) : 0, color: '#faad14' },
    ];

    return (
        <Card
            title={<Title level={4} style={{ margin: 0 }}>Tools Status</Title>}
            bordered={false}
            className="shadow-sm h-full"
        >
            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};
