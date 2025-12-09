import { useState, useCallback } from 'react';
import { Card, Space, Button, Typography, Statistic, Row, Col, Tag, Empty } from 'antd';
import {
  HomeOutlined,
  LeftOutlined,
  RightOutlined,
  ToolOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { Warehouse } from '@features/warehouses/types';
import { ROUTES } from '@shared/constants/routes';
import styles from '../styles/Dashboard.module.scss';

const { Text, Title } = Typography;

interface WarehouseVitalsCardProps {
  warehouses: Warehouse[];
  loading?: boolean;
}

export const WarehouseVitalsCard = ({ warehouses, loading = false }: WarehouseVitalsCardProps) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeWarehouses = warehouses.filter((w) => w.is_active);
  const currentWarehouse = activeWarehouses[currentIndex];

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? activeWarehouses.length - 1 : prev - 1));
  }, [activeWarehouses.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === activeWarehouses.length - 1 ? 0 : prev + 1));
  }, [activeWarehouses.length]);

  const handleNavigateToWarehouse = useCallback(() => {
    if (currentWarehouse) {
      navigate(`${ROUTES.WAREHOUSES}/${currentWarehouse.id}`);
    }
  }, [currentWarehouse, navigate]);

  const formatLocation = (warehouse: Warehouse) => {
    const parts = [warehouse.city, warehouse.state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  if (!loading && activeWarehouses.length === 0) {
    return (
      <Card
        className={`${styles.sectionCard} ${styles.chartCard}`}
        title={
          <span className={styles.sectionTitle}>
            <HomeOutlined />
            Warehouse Vitals
          </span>
        }
      >
        <Empty description="No active warehouses" />
      </Card>
    );
  }

  return (
    <Card
      className={`${styles.sectionCard} ${styles.chartCard}`}
      title={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span className={styles.sectionTitle}>
            <HomeOutlined />
            Warehouse Vitals
          </span>
          {activeWarehouses.length > 1 && (
            <Space size="small">
              <Button
                type="text"
                size="small"
                icon={<LeftOutlined />}
                onClick={handlePrevious}
                disabled={loading}
              />
              <Text type="secondary" style={{ fontSize: 12, minWidth: 40, textAlign: 'center' }}>
                {currentIndex + 1} / {activeWarehouses.length}
              </Text>
              <Button
                type="text"
                size="small"
                icon={<RightOutlined />}
                onClick={handleNext}
                disabled={loading}
              />
            </Space>
          )}
        </Space>
      }
      loading={loading}
    >
      {currentWarehouse && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Warehouse Header */}
          <div
            style={{
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '1px solid var(--border-color, #f0f0f0)',
              cursor: 'pointer',
            }}
            onClick={handleNavigateToWarehouse}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space align="center">
                <Title level={5} style={{ margin: 0 }}>
                  {currentWarehouse.name}
                </Title>
                <Tag color={currentWarehouse.warehouse_type === 'main' ? 'blue' : 'green'}>
                  {currentWarehouse.warehouse_type === 'main' ? 'Main' : 'Satellite'}
                </Tag>
              </Space>
              {formatLocation(currentWarehouse) && (
                <Space size={4}>
                  <EnvironmentOutlined style={{ color: 'var(--text-secondary)', fontSize: 12 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatLocation(currentWarehouse)}
                  </Text>
                </Space>
              )}
            </Space>
          </div>

          {/* Stats Grid */}
          <Row gutter={[16, 16]} style={{ flex: 1 }}>
            <Col span={8}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 8px',
                  borderRadius: 8,
                  background: 'rgba(24, 144, 255, 0.06)',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`${ROUTES.TOOLS}?warehouse_id=${currentWarehouse.id}`)}
              >
                <ToolOutlined style={{ fontSize: 24, color: '#1890ff', marginBottom: 8 }} />
                <Statistic
                  value={currentWarehouse.tools_count ?? 0}
                  valueStyle={{ fontSize: 20, fontWeight: 600 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tools
                </Text>
              </div>
            </Col>
            <Col span={8}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 8px',
                  borderRadius: 8,
                  background: 'rgba(82, 196, 26, 0.06)',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`${ROUTES.CHEMICALS}?warehouse_id=${currentWarehouse.id}`)}
              >
                <ExperimentOutlined style={{ fontSize: 24, color: '#52c41a', marginBottom: 8 }} />
                <Statistic
                  value={currentWarehouse.chemicals_count ?? 0}
                  valueStyle={{ fontSize: 20, fontWeight: 600 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Chemicals
                </Text>
              </div>
            </Col>
            <Col span={8}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px 8px',
                  borderRadius: 8,
                  background: 'rgba(114, 46, 209, 0.06)',
                }}
              >
                <AppstoreOutlined style={{ fontSize: 24, color: '#722ed1', marginBottom: 8 }} />
                <Statistic
                  value={currentWarehouse.expendables_count ?? 0}
                  valueStyle={{ fontSize: 20, fontWeight: 600 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Expendables
                </Text>
              </div>
            </Col>
          </Row>

          {/* Contact Info */}
          {currentWarehouse.contact_person && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--border-color, #f0f0f0)',
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                Contact: {currentWarehouse.contact_person}
                {currentWarehouse.contact_phone && ` | ${currentWarehouse.contact_phone}`}
              </Text>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
