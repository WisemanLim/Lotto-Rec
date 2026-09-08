import type { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}

const TONE = {
  neutral: 'border-neutral-200 dark:border-neutral-700',
  good: 'border-emerald-300 dark:border-emerald-800',
  warn: 'border-amber-300 dark:border-amber-700',
  bad: 'border-red-300 dark:border-red-800',
};

export default function KpiCard({ label, value, sub, tone = 'neutral' }: Props) {
  return (
    <div className={`rounded-lg border bg-white p-4 dark:bg-neutral-900 ${TONE[tone]}`}>
      <div className="text-xs text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{sub}</div>}
    </div>
  );
}
