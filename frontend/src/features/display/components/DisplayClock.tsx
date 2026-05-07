import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import styles from '../styles/Display.module.scss';

export const DisplayClock = () => {
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    const id = window.setInterval(() => setNow(dayjs()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={styles.clock}>
      <div className={styles.clockTime}>{now.format('h:mm')}<span className={styles.clockSeconds}>:{now.format('ss')}</span> <span className={styles.clockAmPm}>{now.format('A')}</span></div>
      <div className={styles.clockDate}>{now.format('dddd, MMMM D, YYYY')}</div>
    </div>
  );
};

export default DisplayClock;
