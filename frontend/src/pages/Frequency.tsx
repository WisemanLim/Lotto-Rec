import { useState } from 'react';
import type { FrequencyRow, FrequencySection, GlobalSection } from '../api/client';
import { useRun, useSection } from '../hooks/useRun';
import { usePrefersDark } from '../hooks/usePrefersDark';
import DataTable, { type Column } from '../components/DataTable';
import PValueBadge from '../components/PValueBadge';
import PlotlyChart from '../components/PlotlyChart';
import RunPicker from '../components/RunPicker';
import Term from '../components/Term';
import { BallRow } from '../components/LottoBall';
import { Empty, ErrorBox, Loading, PageTitle, Section, inputCls } from '../components/States';
import { fmtNum, fmtP } from '../lib/format';
import { EXPECTED, OBSERVED } from '../lib/colors';
import { FrequencyDeviationChart } from './Overview';

type CorrKey = 'q_bh' | 'q_by' | 'p_holm' | 'p_bonferroni';
const CORR: Array<{ v: CorrKey; label: string; term: string }> = [
  { v: 'q_bh', label: 'BH (FDR) q', term: 'fdr_bh' },
  { v: 'q_by', label: 'BY (FDR) q', term: 'fdr_by' },
  { v: 'p_holm', label: 'Holm p', term: 'holm' },
  { v: 'p_bonferroni', label: 'Bonferroni p', term: 'bonferroni' },
];

function GlobalTests({ g }: { g: GlobalSection }) {
  const dark = usePrefersDark();
  const q = g.order_stat_Q;
  const pos = q.mean_observed.map((_, i) => `${i + 1}번째`);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <table className="w-full text-sm">
        <thead className="text-xs text-neutral-500">
          <tr>
            <th className="text-left">검정</th>
            <th className="text-right">통계량</th>
            <th className="text-right">df</th>
            <th className="text-right">
              <Term id="p_value" icon>점근 p</Term>
            </th>
            <th className="text-right">
              <Term id="mc" icon>MC p</Term>
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          <tr className="border-t dark:border-neutral-800">
            <td>
              <Term id="joe_J">Joe J</Term> (비복원 보정 χ²)
            </td>
            <td className="text-right">{fmtNum(g.joe_J.statistic, 2)}</td>
            <td className="text-right">{g.joe_J.df}</td>
            <td className="text-right">{fmtP(g.joe_J.p_asymptotic)}</td>
            <td className="text-right">{fmtP(g.joe_J.p_mc)}</td>
          </tr>
          <tr className="border-t dark:border-neutral-800">
            <td>
              <Term id="pearson_naive">Pearson χ²</Term> <span className="text-xs text-neutral-500">(naive, 참고용)</span>
            </td>
            <td className="text-right">{fmtNum(g.pearson_x2.statistic, 2)}</td>
            <td className="text-right">{g.pearson_x2.df}</td>
            <td className="text-right">{fmtP(g.pearson_x2.p_naive)}</td>
            <td className="text-right">{fmtP(g.pearson_x2.p_mc)}</td>
          </tr>
          <tr className="border-t dark:border-neutral-800">
            <td>
              <Term id="g_test">G-test</Term> (보정)
            </td>
            <td className="text-right">{fmtNum(g.g_test.statistic, 2)}</td>
            <td className="text-right">{g.g_test.df}</td>
            <td className="text-right">{fmtP(g.g_test.p_asymptotic_adjusted)}</td>
            <td className="text-right">—</td>
          </tr>
          <tr className="border-t dark:border-neutral-800">
            <td>
              <Term id="order_stat_Q">순서통계 Q</Term>
            </td>
            <td className="text-right">{fmtNum(q.statistic, 2)}</td>
            <td className="text-right">{q.df}</td>
            <td className="text-right">{fmtP(q.p_asymptotic)}</td>
            <td className="text-right">{fmtP(q.p_mc)}</td>
          </tr>
          <tr className="border-t dark:border-neutral-800">
            <td>
              최대 |<Term id="z_score">z</Term>| (번호 {g.max_abs_z_single.number})
            </td>
            <td className="text-right">{fmtNum(g.max_abs_z_single.observed, 2)}</td>
            <td className="text-right">—</td>
            <td className="text-right">—</td>
            <td className="text-right">{fmtP(g.max_abs_z_single.p_maxT)} (<Term id="maxT">maxT</Term>)</td>
          </tr>
        </tbody>
      </table>
      <div>
        <h3 className="mb-1 text-sm font-medium">
          자리별(정렬 순서) 평균 — 관측 vs <Term id="null_distribution">영분포</Term>
        </h3>
        <PlotlyChart
          height={240}
          data={[
            { type: 'bar', x: pos, y: q.mean_observed, name: '관측 평균', marker: { color: dark ? OBSERVED.dark : OBSERVED.light } },
            {
              type: 'scatter',
              mode: 'markers',
              x: pos,
              y: q.mean_null,
              name: '영분포 평균',
              marker: { color: dark ? EXPECTED.dark : EXPECTED.light, size: 10, symbol: 'diamond' },
              error_y: { type: 'data', array: q.sd_null_single.map((s) => (1.96 * s) / Math.sqrt(q.T)), visible: true, color: EXPECTED.light },
            },
          ]}
          layout={{ yaxis: { title: { text: '평균 번호' } }, showlegend: true }}
        />
      </div>
    </div>
  );
}

export default function Frequency() {
  const { run } = useRun();
  const [role, setRole] = useState<'main' | 'bonus'>('main');
  const [corr, setCorr] = useState<CorrKey>('q_bh');
  const freq = useSection<FrequencySection>(role === 'main' ? 'frequency' : 'frequency_bonus');
  const global = useSection<GlobalSection>('global');
  const alpha = run?.alpha ?? 0.05;

  const sigOf = (r: FrequencyRow) => (corr === 'p_holm' ? r.sig_holm : corr === 'q_bh' ? r.sig_bh : r[corr] < alpha);
  const cols: Column<FrequencyRow>[] = [
    { key: 'number', label: '번호', render: (r) => <BallRow numbers={[r.number]} size="sm" /> },
    { key: 'observed', label: '관측', align: 'right' },
    { key: 'expected', label: '기대', align: 'right', render: (r) => fmtNum(r.expected, 1) },
    { key: 'residual', label: '잔차', align: 'right', render: (r) => fmtNum(r.residual, 1) },
    { key: 'z', label: <Term id="z_score" icon>z</Term>, align: 'right', render: (r) => fmtNum(r.z, 2) },
    { key: 'p', label: <Term id="p_value" icon>원시 p</Term>, align: 'right', render: (r) => fmtP(r.p) },
    { key: corr, label: <Term id={CORR.find((c) => c.v === corr)!.term} icon>{CORR.find((c) => c.v === corr)!.label}</Term>, align: 'right', render: (r) => fmtP(r[corr]) },
    { key: 'sig', label: <Term id="verdict" icon>판정</Term>, sortValue: (r) => (sigOf(r) ? 2 : r.p < 0.05 ? 1 : 0), render: (r) => <PValueBadge p={r.p} q={r[corr]} alpha={alpha} sig={sigOf(r)} showValue={false} /> },
  ];

  return (
    <div className="space-y-4">
      <PageTitle title="번호 빈도" sub="개별 번호 출현수의 기대(T·6/45) 대비 편차, 다중비교 보정, 전역 검정" />
      <div className="flex flex-wrap items-center gap-3">
        <RunPicker />
        <div role="group" aria-label="번호 종류" className="inline-flex overflow-hidden rounded-md border border-neutral-300 text-xs dark:border-neutral-600">
          {(['main', 'bonus'] as const).map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)} className={`px-2.5 py-1 ${role === r ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : ''}`}>
              {r === 'main' ? '본번호' : '보너스'}
            </button>
          ))}
        </div>
        <label className="text-xs">
          <Term id="multiple_testing">보정법</Term>{' '}
          <select className={`${inputCls} inline w-auto`} value={corr} onChange={(e) => setCorr(e.target.value as CorrKey)}>
            {CORR.map((c) => (
              <option key={c.v} value={c.v}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!run && <Empty>완료된 분석 run 없음</Empty>}
      {freq.isLoading && <Loading />}
      {freq.isError && <ErrorBox error={freq.error} />}
      {freq.data && (
        <>
          <Section
            title={`${role === 'main' ? '본번호' : '보너스'} 출현수 (T=${freq.data.T.toLocaleString()})`}
            right={
              <span className="text-xs text-neutral-500">
                기대 {fmtNum(freq.data.expected, 2)} · SD {fmtNum(freq.data.sd, 2)} · <Term id="prediction_interval">PI95</Term> [{freq.data.pi95[0]}, {freq.data.pi95[1]}] · PI99 [{freq.data.pi99[0]}, {freq.data.pi99[1]}] · 유의(<Term id="fdr_bh">BH</Term>) {freq.data.n_sig_bh} · 최대|<Term id="z_score">z</Term>| {fmtNum(freq.data.max_abs_z, 2)} (번호 {freq.data.argmax_number})
              </span>
            }
          >
            <FrequencyDeviationChart freq={freq.data} />
          </Section>
          <Section title="번호별 표">
            <DataTable columns={cols} rows={freq.data.rows} rowKey={(r) => r.number} initialSort={{ key: 'z', dir: 'desc' }} dense csvName={`frequency_${role}`} />
          </Section>
        </>
      )}
      {run && (
        <Section title="전역 검정 (본번호)">
          {global.isLoading && <Loading />}
          {global.isError && <ErrorBox error={global.error} />}
          {global.data && <GlobalTests g={global.data} />}
          {global.data?.pearson_x2.note && <p className="mt-2 text-xs text-neutral-500">{global.data.pearson_x2.note}</p>}
        </Section>
      )}
    </div>
  );
}
