import { useEffect, useMemo } from 'react';
import { Select, Space, Tooltip, Typography, message } from 'antd';
import { HomeOutlined, WarningOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { useActiveWarehouse } from '../../hooks/useActiveWarehouse';
import { useGetWarehousesQuery } from '../../services/warehousesApi';
import { setActiveWarehouse as setLocalActiveWarehouse } from '../../slices/activeWarehouseSlice';

const { Text } = Typography;

/**
 * Header dropdown for switching the user's active warehouse.
 *
 * Writes via POST /api/me/active-warehouse which re-issues the JWT so
 * downstream requests immediately carry the new warehouse claim. Tool
 * and chemical list queries are invalidated automatically so they refresh
 * for the new scope.
 */
export const ActiveWarehouseSelect = () => {
  const dispatch = useAppDispatch();
  const { activeWarehouseId, setActiveWarehouse, isChanging } =
    useActiveWarehouse();
  const user = useAppSelector((s) => s.auth.user);

  const { data } = useGetWarehousesQuery({ include_inactive: false, per_page: 200 });

  const options = useMemo(
    () =>
      (data?.warehouses || []).map((w) => ({
        label: w.name,
        value: w.id,
      })),
    [data]
  );

  // If the backend user has an active warehouse but the slice hasn't
  // synced yet (fresh login), hydrate it from the user object.
  useEffect(() => {
    if (
      user?.active_warehouse_id &&
      activeWarehouseId !== user.active_warehouse_id
    ) {
      dispatch(
        setLocalActiveWarehouse({
          id: user.active_warehouse_id ?? null,
          name: user.active_warehouse_name ?? null,
        })
      );
    }
  }, [user?.active_warehouse_id, user?.active_warehouse_name, activeWarehouseId, dispatch]);

  const handleChange = async (value: number) => {
    try {
      const chosen = data?.warehouses.find((w) => w.id === value);
      await setActiveWarehouse(value, chosen?.name ?? null);
      if (chosen) {
        message.success(`Active warehouse: ${chosen.name}`);
      }
    } catch (err: unknown) {
      const e = err as { data?: { error?: string } };
      message.error(e.data?.error || 'Failed to set active warehouse');
    }
  };

  const missingSelection = !activeWarehouseId;

  return (
    <Space size={4}>
      <HomeOutlined />
      <Tooltip
        title={
          missingSelection
            ? 'Pick your active warehouse to enable checkouts and chemical issues.'
            : 'Active warehouse — scopes your check-ins/outs and default inventory view.'
        }
      >
        <Select
          style={{ minWidth: 200 }}
          size="small"
          value={activeWarehouseId ?? undefined}
          options={options}
          onChange={handleChange}
          placeholder={
            <Space size={4}>
              <WarningOutlined style={{ color: '#faad14' }} />
              <Text>Pick a warehouse</Text>
            </Space>
          }
          loading={isChanging}
          status={missingSelection ? 'warning' : undefined}
          showSearch
          optionFilterProp="label"
        />
      </Tooltip>
    </Space>
  );
};
