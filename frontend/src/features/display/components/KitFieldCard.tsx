import dayjs from 'dayjs';
import type { Kit, KitToolCheckout } from '@features/kits/types';
import styles from '../styles/Display.module.scss';

interface KitFieldCardProps {
  kit: Kit;
  checkouts: KitToolCheckout[];
}

const formatLocation = (kit: Kit): string => {
  const cityState = [kit.location_city, kit.location_state].filter(Boolean).join(', ');
  if (cityState) return cityState;
  if (kit.location_address) return kit.location_address;
  if (kit.trailer_number) return `Trailer ${kit.trailer_number}`;
  return 'Location not set';
};

const isOverdue = (c: KitToolCheckout): boolean =>
  !!c.expected_return_date && dayjs(c.expected_return_date).isBefore(dayjs(), 'day');

const STATUS_STYLES: Record<string, string> = {
  active: styles.statusActive,
  deployed: styles.statusDeployed,
  maintenance: styles.statusMaintenance,
  inactive: styles.statusArchived,
  retired: styles.statusArchived,
};

export const KitFieldCard = ({ kit, checkouts }: KitFieldCardProps) => {
  const overdueCount = checkouts.filter(isOverdue).length;
  const statusClass = STATUS_STYLES[kit.status] ?? styles.statusActive;

  return (
    <article className={styles.kitCard}>
      <header className={styles.kitCardHeader}>
        <div className={styles.kitCardTitleRow}>
          <h2 className={styles.kitName}>{kit.name}</h2>
          <span className={`${styles.kitStatus} ${statusClass}`}>{kit.status.replace('_', ' ')}</span>
        </div>
        <div className={styles.kitMeta}>
          {kit.aircraft_type_name && <span className={styles.aircraftType}>{kit.aircraft_type_name}</span>}
          <span className={styles.kitLocation}>{formatLocation(kit)}</span>
          {kit.assigned_user_name ? (
            <span className={styles.kitAssignee}>{kit.assigned_user_name}</span>
          ) : (
            <span className={styles.kitAssigneeUnassigned}>Unassigned</span>
          )}
        </div>
      </header>

      <div className={styles.kitCheckouts}>
        <div className={styles.kitCheckoutsHeader}>
          <span>Tools in Field</span>
          <span className={styles.kitCheckoutsCount}>
            {checkouts.length}
            {overdueCount > 0 && <span className={styles.overdueChip}>{overdueCount} overdue</span>}
          </span>
        </div>

        {checkouts.length === 0 ? (
          <div className={styles.kitCheckoutsEmpty}>No tools currently deployed</div>
        ) : (
          <ul className={styles.checkoutList}>
            {checkouts.slice(0, 6).map((c) => {
              const overdue = isOverdue(c);
              return (
                <li key={c.id} className={`${styles.checkoutRow} ${overdue ? styles.checkoutOverdue : ''}`}>
                  <span className={styles.toolNumber}>{c.tool_number ?? '—'}</span>
                  <span className={styles.toolDescription}>{c.tool_description ?? 'Tool'}</span>
                  <span className={styles.checkoutSince}>
                    {c.checkout_date ? dayjs(c.checkout_date).format('MMM D') : '—'}
                  </span>
                </li>
              );
            })}
            {checkouts.length > 6 && (
              <li className={styles.checkoutMore}>+{checkouts.length - 6} more</li>
            )}
          </ul>
        )}
      </div>
    </article>
  );
};

export default KitFieldCard;
