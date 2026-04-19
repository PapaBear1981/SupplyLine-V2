import { useMemo } from 'react';
import { Alert, Modal, Select, Space, message } from 'antd';
import { useAppSelector } from '@app/hooks';
import { useActiveWarehouse } from '../../hooks/useActiveWarehouse';
import { useGetWarehousesQuery } from '../../services/warehousesApi';

/**
 * Blocking modal shown on first login when the user has no active warehouse.
 *
 * Admins bypass the gate — the backend allows cross-warehouse writes for
 * admins, and forcing the picker on every admin login would be noisy.
 */
export const RequireActiveWarehouseGate = () => {
  const user = useAppSelector((s) => s.auth.user);
  const { activeWarehouseId, setActiveWarehouse, isChanging } =
    useActiveWarehouse();

  const { data } = useGetWarehousesQuery(
    { include_inactive: false, per_page: 200 },
    { skip: !user || Boolean(user.is_admin) }
  );

  const options = useMemo(
    () =>
      (data?.warehouses || []).map((w) => ({
        label: w.name,
        value: w.id,
      })),
    [data]
  );

  if (!user) return null;
  if (user.is_admin) return null;
  if (activeWarehouseId) return null;
  // If the backend already has a warehouse on the user profile, we don't
  // need to prompt — the header dropdown or the next API call will hydrate.
  if (user.active_warehouse_id) return null;

  const handleSelect = async (value: number) => {
    try {
      const chosen = data?.warehouses.find((w) => w.id === value);
      await setActiveWarehouse(value, chosen?.name ?? null);
      message.success(`Working in ${chosen?.name}`);
    } catch (err: unknown) {
      const e = err as { data?: { error?: string } };
      message.error(e.data?.error || 'Failed to set active warehouse');
    }
  };

  return (
    <Modal
      open
      closable={false}
      maskClosable={false}
      keyboard={false}
      title="Pick your active warehouse"
      footer={null}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Which warehouse are you working in today?"
          description="Check-ins, check-outs, and chemical issues are scoped to this warehouse. You can change it anytime from the header."
        />
        <Select
          autoFocus
          style={{ width: '100%' }}
          size="large"
          placeholder="Select warehouse"
          options={options}
          onChange={handleSelect}
          loading={isChanging}
          showSearch
          optionFilterProp="label"
        />
      </Space>
    </Modal>
  );
};
