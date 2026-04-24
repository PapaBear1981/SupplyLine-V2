import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './LoginHero.css';

const TICKER_ITEMS = [
  { label: 'Tool crib', status: 'Online', tone: 'good' as const },
  { label: 'Inventory sync', status: '99.2%', tone: 'good' as const },
  { label: 'Checkouts today', status: '47', tone: 'accent' as const },
  { label: 'Calibration due', status: '3 tools', tone: 'warn' as const },
];

const TICKER_INTERVAL_MS = 3800;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const LoginHero = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % TICKER_ITEMS.length),
      TICKER_INTERVAL_MS
    );
    return () => window.clearInterval(id);
  }, []);

  const current = TICKER_ITEMS[index];

  return (
    <div className="login-hero-inner" aria-hidden="true">
      <div className="login-hero-top">
        <div className="login-brand">
          <span className="login-brand-dot" />
          <span className="login-brand-word">SUPPLYLINE</span>
          <span className="login-brand-chip">MRO</span>
        </div>
      </div>

      <div className="login-hero-center">
        <motion.h1
          className="login-headline"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          Keep the right tool in the right hand at the{' '}
          <span className="login-headline-accent">right time.</span>
        </motion.h1>
        <motion.p
          className="login-subhead"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.22 }}
        >
          Inventory, checkouts, and accountability, built for MRO.
        </motion.p>

        <motion.div
          className="login-ticker"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.34 }}
        >
          <span className="login-ticker-rail" />
          <AnimatePresence initial={false}>
            <motion.div
              key={current.label}
              className="login-ticker-row"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, position: 'absolute' }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <span className={`login-ticker-dot tone-${current.tone}`} />
              <span className="login-ticker-label">{current.label}</span>
              <span className="login-ticker-sep">·</span>
              <span className={`login-ticker-status tone-${current.tone}`}>
                {current.status}
              </span>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="login-hero-foot">
        <span>© {new Date().getFullYear()} SupplyLine</span>
        <span className="login-hero-foot-sep">·</span>
        <span>Flight Deck · build stable</span>
      </div>
    </div>
  );
};
