import { useState } from 'react';
import type { ComparisonVsUniform, RankKey, StrategyPerf } from '../api/client';
import { usePrefersDark } from '../hooks/usePrefersDark';
import { EXPECTED, strategyColor } from '../lib/colors';
import { fmtCI, fmtNum, fmtP, fmtPct, fmtSigned, fmtWon } from '../lib/format';
import DataTable, { type Column } from './DataTable';
import PValueBadge from './PValueBadge';
import PlotlyChart from './PlotlyChart';
import VerdictBadge from './VerdictBadge';
import Term from './Term';
import { inputCls } from './States';
import { labelOf } from '../lib/labels';

const RANKS: RankKey[] = ['rank1', 'rank2', 'rank3', 'rank4', 'rank5'];
type Row = StrategyPerf & { strategy: string };

export function PerfTable({ strategies, alpha = 0.05 }: { strategies: Record<string, StrategyPerf>; alpha?: number }) {
  const rows: Row[] = Object.entries(strategies).map(([strategy, p]) => ({ strategy, ...p }));
  const cols: Column<Row>[] = [
    { key: 'strategy', label: '전략', render: (r) => labelOf(r.strategy, r) },
    { key: 'n_tickets', label: '티켓', align: 'right' },
    { key: 'n_draws', label: '회차', align: 'right' },
    { key: 'mean_matches', label: <Term id="expected_matches" icon>평균 일치 (기대 0.8)</Term>, align: 'right', render: (r) => `${fmtNum(r.mean_matches, 4)}` },
    { key: 'z', label: <Term id="z_score" icon>z</Term>, align: 'right', render: (r) => fmtNum(r.z, 2) },
    { key: 'p', label: <Term id="p_value" icon>p</Term>, align: 'right', render: (r) => <PValueBadge p={r.p} alpha={alpha} /> },
    { key: 'n_ge3', label: <Term id="ge3" icon>≥3 일치 (기대)</Term>, align: 'right', render: (r) => `${r.n_ge3} (${fmtNum(r.expected_ge3, 1)})` },
    { key: 'p_ge3_binomial', label: <Term id="exact_binomial" icon>≥3 이항 p</Term>, align: 'right', render: (r) => fmtP(r.p_ge3_binomial) },
    { key: 'max_matches', label: <Term id="match_distribution" icon>최대 일치 (영 p)</Term>, align: 'right', render: (r) => `${r.max_matches} (${fmtP(r.p_max_matches_null)})` },
    { key: 'total_prize', label: '당첨금', align: 'right', render: (r) => fmtWon(r.total_prize) },
    { key: 'total_cost', label: '비용', align: 'right', render: (r) => fmtWon(r.total_cost) },
    { key: 'roi', label: <Term id="roi" icon>ROI</Term>, align: 'right', render: (r) => fmtPct(r.roi) },
  ];
  return <DataTable columns={cols} rows={rows} rowKey={(r) => r.strategy} dense csvName="strategy_performance" />;
}

export function ComparisonTable({ comparison }: { comparison: Record<string, ComparisonVsUniform> }) {
  type CRow = ComparisonVsUniform & { strategy: string };
  const rows: CRow[] = Object.entries(comparison).map(([strategy, c]) => ({ strategy, ...c }));
  const cols: Column<CRow>[] = [
    { key: 'strategy', label: '전략', render: (r) => labelOf(r.strategy) },
    { key: 'n_draws', label: '회차', align: 'right' },
    { key: 'mean_diff', label: <Term id="diff_vs_uniform" icon>평균 일치 차이 (vs 균등)</Term>, align: 'right', render: (r) => fmtSigned(r.mean_diff, 4) },
    { key: 'ci95', label: <Term id="ci" icon>95% CI</Term>, align: 'right', sortable: false, render: (r) => fmtCI(r.ci95, 4) },
    { key: 'p_paired_t', label: '대응 t p', align: 'right', render: (r) => (r.p_paired_t != null ? fmtP(r.p_paired_t) : '—') },
    {
      key: 'verdict',
      label: <Term id="verdict" icon>판정</Term>,
      sortable: false,
      render: (r) => <VerdictBadge ok={r.ci95[0] <= 0 && r.ci95[1] >= 0} text={r.verdict} />,
    },
  ];
  return <DataTable columns={cols} rows={rows} rowKey={(r) => r.strategy} dense csvName="comparison_vs_uniform" />;
}

export function CumulativeCurve({ strategies, height = 320 }: { strategies: Record<string, StrategyPerf>; height?: number }) {
  const dark = usePrefersDark();
  const entries = Object.entries(strategies);
  const first = entries[0]?.[1];
  return (
    <PlotlyChart
      height={height}
      data={[
        ...entries.map(([s, p]) => ({
          type: 'scatter' as const,
          mode: 'lines' as const,
          x: p.curve.map((c) => c.draw_no),
          y: p.curve.map((c) => c.cum_matches),
          name: labelOf(s, p),
          line: { color: strategyColor(s, dark), width: s === 'uniform' ? 2.5 : 1.5 },
          hovertemplate: `${labelOf(s, p)}<br>%{x}회: 누적 %{y}<extra></extra>`,
        })),
        ...(first
          ? [
              {
                type: 'scatter' as const,
                mode: 'lines' as const,
                x: first.curve.map((c) => c.draw_no),
                y: first.curve.map((c) => c.cum_expected),
                name: '기대 (균등 영분포)',
                line: { color: dark ? EXPECTED.dark : EXPECTED.light, width: 2, dash: 'dash' as const },
                hovertemplate: '%{x}회: 기대 %{y:.1f}<extra></extra>',
              },
            ]
          : []),
      ]}
      layout={{ xaxis: { title: { text: '회차' } }, yaxis: { title: { text: '누적 일치수' } }, hovermode: 'x unified', showlegend: true, legend: { y: -0.25 } }}
    />
  );
}

export function StrategySelect({ strategies, value, onChange }: { strategies: Record<string, StrategyPerf>; value: string; onChange: (s: string) => void }) {
  return (
    <select aria-label="전략 선택" className={`${inputCls} w-auto`} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(strategies).map(([s, p]) => (
        <option key={s} value={s}>
          {labelOf(s, p)}
        </option>
      ))}
    </select>
  );
}

export function MatchHistogram({ perf, strategy, height = 260 }: { perf: StrategyPerf; strategy: string; height?: number }) {
  const dark = usePrefersDark();
  const x = perf.match_hist.map((_, i) => `${i}개`);
  return (
    <PlotlyChart
      height={height}
      data={[
        { type: 'bar', x, y: perf.match_hist, name: '관측', marker: { color: strategyColor(strategy, dark), line: { width: 0 } } },
        { type: 'bar', x, y: perf.match_hist_expected, name: '기대 (하이퍼지오메트릭)', marker: { color: dark ? EXPECTED.dark : EXPECTED.light, line: { width: 0 } } },
      ]}
      layout={{ barmode: 'group', xaxis: { title: { text: '본번호 일치수' } }, yaxis: { title: { text: '티켓 수' }, type: 'log' }, showlegend: true }}
    />
  );
}

export function RankTable({ perf }: { perf: StrategyPerf }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-neutral-500">
        <tr>
          <th className="text-left">
            <Term id="rank_rules" icon>등수</Term>
          </th>
          <th className="text-right">적중</th>
          <th className="text-right">기대</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {RANKS.map((r, i) => (
          <tr key={r} className="border-t border-neutral-100 dark:border-neutral-800">
            <td>{i + 1}등</td>
            <td className="text-right">{perf.rank_counts[r]}</td>
            <td className="text-right">{fmtNum(perf.rank_expected[r], perf.rank_expected[r] < 0.01 ? 4 : 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 전략 선택 + 히스토그램 + 등수표 묶음. */
export function StrategyDetail({ strategies }: { strategies: Record<string, StrategyPerf> }) {
  const keys = Object.keys(strategies);
  const [sel, setSel] = useState(keys[0] ?? '');
  const cur = strategies[sel] ?? strategies[keys[0]];
  const curKey = strategies[sel] ? sel : keys[0];
  if (!cur) return null;
  return (
    <div className="space-y-3">
      <StrategySelect strategies={strategies} value={curKey} onChange={setSel} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MatchHistogram perf={cur} strategy={curKey} />
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium">
            <Term id="rank_rules" icon>등수별 적중 vs 기대</Term>
          </h3>
          <RankTable perf={cur} />
        </div>
      </div>
    </div>
  );
}
