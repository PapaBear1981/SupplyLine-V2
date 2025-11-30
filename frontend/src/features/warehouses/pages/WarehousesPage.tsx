import { useState } from 'react';
import { Typography, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { WarehousesTable } from '../components/WarehousesTable';
import { WarehouseDrawer } from '../components/WarehouseDrawer';
import type { Warehouse } from '../types';
import { useIsMobile } from '@shared/hooks/useIsMobile';
import { MobilePage } from '@shared/components/mobile/MobilePage';

const { Title } = Typography;

export const WarehousesPage = () => {
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const isMobile = useIsMobile();

  const handleView = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setDrawerMode('view');
  };

  const handleEdit = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse);
    setDrawerMode('edit');
  };

  const handleCreate = () => {
    setSelectedWarehouse(null);
    setDrawerMode('create');
  };

  const handleCloseDrawer = () => {
    setDrawerMode(null);
    setSelectedWarehouse(null);
  };

  const table = (
    <WarehousesTable onView={handleView} onEdit={handleEdit} />
  );

  if (isMobile) {
    return (
      <MobilePage
        title="Warehouses"
        subtitle="Check locations, capacities, and contacts while on site"
        actions={[
          {
            key: 'add',
            node: (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Add Warehouse
              </Button>
            ),
          },
        ]}
      >
        {table}

        <WarehouseDrawer
          open={drawerMode !== null}
          mode={drawerMode || 'view'}
          warehouseId={selectedWarehouse?.id}
          onClose={handleCloseDrawer}
          onSuccess={() => setSelectedWarehouse(null)}
        />
      </MobilePage>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Warehouses
        </Title>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Add Warehouse
          </Button>
        </Space>
      </div>

      {table}

      <WarehouseDrawer
        open={drawerMode !== null}
        mode={drawerMode || 'view'}
        warehouseId={selectedWarehouse?.id}
        onClose={handleCloseDrawer}
        onSuccess={() => setSelectedWarehouse(null)}
      />
    </div>
  );
};
