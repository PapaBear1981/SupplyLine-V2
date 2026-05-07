import { useMemo } from 'react';
import {
  useGetKitsQuery,
  useGetActiveKitToolCheckoutsQuery,
} from '@features/kits/services/kitsApi';
import { useActiveWarehouse } from '@features/warehouses/hooks/useActiveWarehouse';
import type { KitToolCheckout } from '@features/kits/types';
import { DisplayClock } from '../components/DisplayClock';
import { DisplayOnCall } from '../components/DisplayOnCall';
import { DisplayAnnouncements } from '../components/DisplayAnnouncements';
import { KitFieldCard } from '../components/KitFieldCard';
import styles from '../styles/Display.module.scss';

const POLL_INTERVAL = 30_000;

export const DisplayPage = () => {
  const { activeWarehouseId, activeWarehouseName } = useActiveWarehouse();

  const { data: kits, isLoading: kitsLoading } = useGetKitsQuery(undefined, {
    pollingInterval: POLL_INTERVAL,
  });

  const { data: checkoutData } = useGetActiveKitToolCheckoutsQuery(
    { warehouse_id: activeWarehouseId ?? undefined },
    { skip: !activeWarehouseId, pollingInterval: POLL_INTERVAL }
  );

  const checkoutsByKit = useMemo(() => {
    const map = new Map<number, KitToolCheckout[]>();
    for (const c of checkoutData?.checkouts ?? []) {
      const list = map.get(c.kit_id) ?? [];
      list.push(c);
      map.set(c.kit_id, list);
    }
    return map;
  }, [checkoutData]);

  const visibleKits = useMemo(() => {
    const list = (kits ?? []).filter(
      (k) => k.status !== 'retired' && k.status !== 'inactive'
    );
    return list.sort((a, b) => {
      const aCount = checkoutsByKit.get(a.id)?.length ?? 0;
      const bCount = checkoutsByKit.get(b.id)?.length ?? 0;
      if (aCount !== bCount) return bCount - aCount;
      return a.name.localeCompare(b.name);
    });
  }, [kits, checkoutsByKit]);

  return (
    <div className={styles.display}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandTitle}>SupplyLine Field Kits</span>
          {activeWarehouseName && (
            <span className={styles.brandSubtitle}>{activeWarehouseName}</span>
          )}
        </div>
        <DisplayAnnouncements />
        <DisplayClock />
      </header>

      <main className={styles.kitsGrid}>
        {!activeWarehouseId ? (
          <div className={styles.emptyState}>
            No active warehouse selected. Sign in as the kiosk user and choose a warehouse.
          </div>
        ) : kitsLoading && visibleKits.length === 0 ? (
          <div className={styles.emptyState}>Loading kits…</div>
        ) : visibleKits.length === 0 ? (
          <div className={styles.emptyState}>No active kits.</div>
        ) : (
          visibleKits.map((kit) => (
            <KitFieldCard
              key={kit.id}
              kit={kit}
              checkouts={checkoutsByKit.get(kit.id) ?? []}
            />
          ))
        )}
      </main>

      <footer className={styles.footer}>
        <DisplayOnCall />
      </footer>
    </div>
  );
};

export default DisplayPage;
