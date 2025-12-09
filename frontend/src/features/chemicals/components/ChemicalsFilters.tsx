import { Select, Checkbox, Space, Card } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { useGetWarehousesQuery } from '@features/warehouses/services/warehousesApi';
import type { ChemicalStatus } from '../types';

interface ChemicalsFiltersProps {
  category: string | undefined;
  status: ChemicalStatus | undefined;
  warehouseId: number | undefined;
  showArchived: boolean;
  onCategoryChange: (value: string | undefined) => void;
  onStatusChange: (value: ChemicalStatus | undefined) => void;
  onWarehouseChange: (value: number | undefined) => void;
  onShowArchivedChange: (checked: boolean) => void;
}

export const ChemicalsFilters = ({
  category,
  status,
  warehouseId,
  showArchived,
  onCategoryChange,
  onStatusChange,
  onWarehouseChange,
  onShowArchivedChange,
}: ChemicalsFiltersProps) => {
  const { data: warehousesData } = useGetWarehousesQuery({
    page: 1,
    per_page: 1000,
  });

  const categoryOptions = [
    { label: 'All Categories', value: undefined },
    { label: 'Adhesive', value: 'Adhesive' },
    { label: 'Cleaner', value: 'Cleaner' },
    { label: 'Coating', value: 'Coating' },
    { label: 'Lubricant', value: 'Lubricant' },
    { label: 'Paint', value: 'Paint' },
    { label: 'Sealant', value: 'Sealant' },
    { label: 'Solvent', value: 'Solvent' },
    { label: 'Other', value: 'Other' },
  ];

  const statusOptions = [
    { label: 'All Statuses', value: undefined },
    { label: 'Available', value: 'available' as ChemicalStatus },
    { label: 'Low Stock', value: 'low_stock' as ChemicalStatus },
    { label: 'Out of Stock', value: 'out_of_stock' as ChemicalStatus },
    { label: 'Expired', value: 'expired' as ChemicalStatus },
  ];

  const warehouseOptions = [
    { label: 'All Warehouses', value: undefined },
    ...(warehousesData?.warehouses.map((warehouse) => ({
      label: warehouse.name,
      value: warehouse.id,
    })) || []),
  ];

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space wrap align="center" size="middle">
        <Space align="center" size={8}>
          <FilterOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontWeight: 500 }}>Filters:</span>
        </Space>

        <Select
          placeholder="Category"
          value={category}
          onChange={onCategoryChange}
          options={categoryOptions}
          style={{ minWidth: 150 }}
          allowClear
        />

        <Select
          placeholder="Status"
          value={status}
          onChange={onStatusChange}
          options={statusOptions}
          style={{ minWidth: 150 }}
          allowClear
        />

        <Select
          placeholder="Warehouse"
          value={warehouseId}
          onChange={onWarehouseChange}
          options={warehouseOptions}
          style={{ minWidth: 180 }}
          allowClear
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />

        <Checkbox checked={showArchived} onChange={(e) => onShowArchivedChange(e.target.checked)}>
          Show Archived
        </Checkbox>
      </Space>
    </Card>
  );
};
