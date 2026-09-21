import { useQuery } from '@tanstack/react-query';
import { api, type ConsistencyReport, type ConsistencyStrategy, type Origin } from '../api/client';
import DataTable, { type Column } from './DataTable';
import { Empty, ErrorBox, Loading } from './States';
import { fmtNum, fmtP } from '../lib/format';
import { labelOf } from '../lib/labels';

// S8.7/S8.8 추천 정합성 분석 — 추천 티켓 전체 vs 실제 결과 (등수 분포 · 번호 상관 · 번호쌍 상관, BH 보정)
type Row = ConsistencyStrategy & { strategy: string };

const VERDICT: Record<Row['verdict'], { label: string; cls: string }> = {
  consistent: { label: '균등과 일치', cls: 'text-emerald-700 dark:text-emerald-300' },
  deviation: { label: '유의 편차', cls: 'font-semibold text-red-700 dark:text-red-300' },
  insufficient: { label: '표본 부족', cls: 'text-neutral-500' },
};

const cols: Column<Row>[] = [
  { key: 'strategy', label: '전략', render: (r) => labelOf(r.strategy) },
  { key: 'n_tickets', label: '티켓 / 회차', align: 'right', sortValue: (r) => r.n_tickets, render: (r) => `${r.n_tickets.toLocaleString()} / ${r.n_draws}` },
  {
    key: 'rank_dist',
    label: '등수 관측/기대',
    sortable: false,
    render: (r) => (
      <span className="whitespace-nowrap text-xs tabular-nums">
        {r.rank_dist
          .filter((x) => x.rank >= 3 || x.observed > 0)
          .map((x) => `${x.rank}등 ${x.observed}/${fmtNum(x.expected, 1)}`)
          .join(' · ')}
      </span>
    ),
  },
  { key: 'gof', label: '일치수 GOF p', align: 'right', sortValue: (r) => r.match_gof.p, render: (r) => fmtP(r.match_gof.p) },
  {
    key: 'ncorr',
    label: '번호 상관 r̄ (p)',
    align: 'right',
    sortValue: (r) => r.number_corr.mean_r,
    render: (r) => (r.number_corr.mean_r == null ? '—' : `${fmtNum(r.number_corr.mean_r, 3)} (${fmtP(r.number_corr.p)})`),
  },
  {
    key: 'pcorr',
    label: '번호쌍 초과율 (p)',
    align: 'right',
    sortValue: (r) => r.pair_corr.mean_excess_rate,
    render: (r) => (r.pair_corr.mean_excess_rate == null ? '—' : `${fmtNum(r.pair_corr.mean_excess_rate * 100, 3)}%p (${fmtP(r.pair_corr.p)})`),
  },
  { key: 'min_q', label: '최소 q (BH)', align: 'right', sortValue: (r) => r.min_q, render: (r) => fmtP(r.min_q) },
  { key: 'verdict', label: '판정', render: (r) => <span className={VERDICT[r.verdict].cls}>{VERDICT[r.verdict].label}</span> },
];

export function ConsistencyView({ report }: { report: ConsistencyReport }) {
  const rows: Row[] = Object.entries(report.strategies ?? {}).map(([strategy, v]) => ({ strategy, ...v }));
  if (!rows.length) return <Empty>대조된 추천 티켓이 없습니다. 추천 저장 후 새 회차 결과를 입력하면 분석됩니다.</Empty>;
  const fb = report.feedback;
  return (
    <div className="space-y-3">
      <div
        role="status"
        aria-label="추천 정합성 판정"
        className={`rounded-md border p-2 text-sm ${fb.n_deviation ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : 'border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900'}`}
      >
        <p>{fb.summary}</p>
        {fb.actions.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-xs">
            {fb.actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
        {fb.next_experiment.length > 0 && (
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
            다음 실험 제안: {fb.next_experiment.map((n) => `${labelOf(n.strategy)}(튠 구간 끝 ${n.tune_to ?? '최신'}회)`).join(', ')} — 추천 화면 &quot;전략 개선 루프&quot; 탭
          </p>
        )}
      </div>
      <DataTable columns={cols} rows={rows} rowKey={(r) => r.strategy} dense pageSize={20} initialSort={{ key: 'min_q', dir: 'asc' }} csvName="recommend_consistency" />
      <p className="text-[11px] text-neutral-500">
        번호 상관 = 회차별 (번호 추천 빈도 × 당첨 여부) 상관의 회차 평균 t 검정 · 번호쌍 = 추천된 고유 번호쌍 중 두 번호가 모두 당첨된 비율의 기대(1.52%) 대비 초과 · 검정 {report.n_tests}개 BH 보정, α={report.alpha}. {report.policy}
      </p>
    </div>
  );
}

export default function ConsistencyPanel({ origin }: { origin: Origin | 'all' }) {
  const q = useQuery({ queryKey: ['tracking', 'consistency', origin], queryFn: () => api.tracking.consistency(origin) });
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorBox error={q.error} />;
  return q.data ? <ConsistencyView report={q.data} /> : null;
}
