import { Card, Button, Row, Col, Typography } from 'antd';
import {
    PlusOutlined,
    BarcodeOutlined,
    SwapOutlined,
    SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

export const QuickActions = () => {
    const navigate = useNavigate();

    const actions = [
        {
            label: 'New Order',
            icon: <PlusOutlined />,
            onClick: () => navigate('/orders/new'),
            type: 'primary' as const,
        },
        {
            label: 'New Request',
            icon: <PlusOutlined />,
            onClick: () => navigate('/requests/new'),
            type: 'default' as const,
        },
        {
            label: 'Scan Item',
            icon: <BarcodeOutlined />,
            onClick: () => navigate('/scanner'),
            type: 'dashed' as const,
        },
        {
            label: 'Transfer',
            icon: <SwapOutlined />,
            onClick: () => navigate('/transfers/new'),
            type: 'default' as const,
        },
        {
            label: 'Search',
            icon: <SearchOutlined />,
            onClick: () => navigate('/search'),
            type: 'default' as const,
        }
    ];

    return (
        <Card title={<Title level={4} style={{ margin: 0 }}>Quick Actions</Title>} bordered={false} className="shadow-sm h-full">
            <Row gutter={[12, 12]}>
                {actions.map((action, index) => (
                    <Col span={12} key={index}>
                        <Button
                            type={action.type}
                            icon={action.icon}
                            block
                            size="large"
                            onClick={action.onClick}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50px' }}
                        >
                            {action.label}
                        </Button>
                    </Col>
                ))}
            </Row>
        </Card>
    );
};
