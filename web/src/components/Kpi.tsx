import clsx from 'clsx';
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkline } from './charts/charts';

export function CountUp({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => new Intl.NumberFormat('es-ES').format(Math.round(v)));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, ease: [0.2, 0.7, 0.2, 1] });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span className={className}>{rounded}</motion.span>;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  spark,
  to,
  accent = false,
  index = 0,
}: {
  label: string;
  value: number;
  hint?: ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  spark?: number[];
  to?: string;
  accent?: boolean;
  index?: number;
}) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.2, 0.7, 0.2, 1] }}
      className={clsx(
        'card card-hover relative h-full overflow-hidden p-4 sm:p-5',
        accent && 'border-brand/30 bg-gradient-to-br from-brand-soft to-surface',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[0.8rem] font-medium text-fg-muted">{label}</span>
        <span className={clsx('grid size-8 place-items-center rounded-lg', accent ? 'bg-brand text-white dark:text-ink' : 'bg-surface-2 text-fg-muted')}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 text-[1.85rem] font-semibold leading-none tracking-tight text-fg sm:text-[2.1rem]">
        <CountUp value={value} className="tabular" />
      </div>
      {hint && <div className="mt-2 text-xs text-fg-subtle">{hint}</div>}
      {spark && spark.length > 1 && <Sparkline values={spark} className="mt-3 opacity-90" />}
    </motion.div>
  );
  return to ? (
    <Link to={to} className="block h-full rounded-[1.125rem] outline-none focus-visible:ring-2 focus-visible:ring-brand">
      {inner}
    </Link>
  ) : (
    inner
  );
}
