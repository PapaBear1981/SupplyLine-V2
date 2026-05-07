import { useState } from 'react';
import {
  useGetOnCallPersonnelQuery,
  type OnCallEntry,
} from '@features/admin/services/oncallApi';
import styles from '../styles/Display.module.scss';

interface OnCallTileProps {
  label: string;
  accentClass: string;
  entry: OnCallEntry | undefined;
}

const initials = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

const OnCallTile = ({ label, accentClass, entry }: OnCallTileProps) => {
  const user = entry?.user ?? null;
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`${styles.onCallTile} ${accentClass}`}>
      <div className={styles.onCallLabel}>{label}</div>
      {user ? (
        <div className={styles.onCallBody}>
          <div className={styles.onCallAvatar}>
            {user.avatar && !imageError ? (
              <img
                src={user.avatar}
                alt={user.name}
                onError={() => setImageError(true)}
              />
            ) : (
              <span>{initials(user.name)}</span>
            )}
          </div>
          <div className={styles.onCallInfo}>
            <div className={styles.onCallName}>{user.name}</div>
            {user.department && <div className={styles.onCallDept}>{user.department}</div>}
            {user.phone && <div className={styles.onCallPhone}>{user.phone}</div>}
          </div>
        </div>
      ) : (
        <div className={styles.onCallEmpty}>No one assigned</div>
      )}
    </div>
  );
};

export const DisplayOnCall = () => {
  const { data } = useGetOnCallPersonnelQuery(undefined, { pollingInterval: 60_000 });

  return (
    <section className={styles.onCallPanel}>
      <h3 className={styles.panelHeading}>On Call</h3>
      <div className={styles.onCallGrid}>
        <OnCallTile label="Materials" accentClass={styles.onCallMaterials} entry={data?.materials} />
        <OnCallTile label="Maintenance" accentClass={styles.onCallMaintenance} entry={data?.maintenance} />
      </div>
    </section>
  );
};

export default DisplayOnCall;
