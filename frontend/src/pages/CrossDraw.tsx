import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type CrossDrawBlock, type CrossDrawRow, type CrossDrawSection } from '../api/client';
import { useRun, useSection } from '../hooks/useRun';
import { usePrefersDark } from '../hooks/usePrefersDark';
import DataTable, { type Column } from '../components/DataTable';
import KpiCard from '../components/KpiCard';
import PValueBadge from '../components/PValueBadge';
import PlotlyChart, { type Trace } from '../components/PlotlyChart';
import RunPicker from '../components/RunPicker';
import Term from '../components/Term';
import { BallRow } from '../components/LottoBall';
import PolicyBanner from '../components/PolicyBanner';
import { Empty, ErrorBox, Loading, PageTitle, Section, inputCls } from '../components/States';
import { fmtNum, fmtP } from '../lib/format';
import { divergingScale, sequentialScale } from '../lib/colors';

type Metric = 'observed' | 'z';
type CorrKey = 'q_bh' | 'q_by' | 'p_holm' | 'p_maxT';
const CORR: Array<{ v: CorrKey; label: string; term: string }> = [
  { v: 'q_bh', label: 'BH q', term: 'fdr_bh' },
  { v: 'q_by', label: 'BY q', term: 'fdr_by' },
  { v: 'p_holm', label: 'Holm p', term: 'holm' },
  { v: 'p_maxT', label: 'maxT p (FWER)', term: 'maxT' },
];
const NUMS = Array.from({ length: 45 }, (_, i) => i + 1);

function CellDetail({ row, alpha }: { row: CrossDrawRow; alpha: number }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <BallRow numbers={[row.prev]} size="sm" /> <span className="text-neutral-500">→</span> <BallRow numbers={[row.next]} size="sm" />
        {row.prev === row.next && <span className="text-xs text-neutral-500">(재출현)</span>}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
        <dt className="text-neutral-500">관측 / 기대(H0)</dt>
        <dd>
          {row.observed} / {fmtNum(row.expected, 2)}
        </dd>
        <dt className="text-neutral-500">
          기대(<Term id="cond_independence_z">주변빈도 조건부</Term>)
        </dt>
        <dd>{fmtNum(row.expected_cond, 2)}</dd>
        <dt className="text-neutral-500">Lift (H0) / 조건부 Lift</dt>
        <dd>
          {fmtNum(row.lift, 3)} / {fmtNum(row.cond_lift, 3)}
        </dd>
        <dt className="text-neutral-500">
          <Term id="cond_independence_z">z</Term>
        </dt>
        <dd>{fmtNum(row.z, 3)}</dd>
        <dt className="text-neutral-500">
          <Term id="p_value">원시 p</Term>
        </dt>
        <dd>
          <PValueBadge p={row.p} q={row.q_bh} alpha={alpha} sig={row.sig_bh} />
        </dd>
        <dt className="text-neutral-500">
          <Term id="holm">Holm</Term> / q <Term id="fdr_bh">BH</Term> / <Term id="fdr_by">BY</Term>
        </dt>
        <dd>
          {fmtP(row.p_holm)} / {fmtP(row.q_bh)} / {fmtP(row.q_by)}
        </dd>
        <dt className="text-neutral-500">
          <Term id="maxT">maxT p (FWER)</Term>
        </dt>
        <dd>
          {fmtP(row.p_maxT)} {row.sig_fwer ? '· 유의' : ''}
        </dd>
      </dl>
    </div>
  );
}

export default function CrossDraw() {
  const { run } = useRun();
  const dark = usePrefersDark();
  const q = useSection<CrossDrawSection>('cross_draw');
  const config = useQuery({ queryKey: ['config'], queryFn: api.config });
  const envLag = config.data?.lotto_cross_draw_lag;
  const [lagSel, setLagSel] = useState<'window' | number>('window');
  const [metric, setMetric] = useState<Metric>('z');
  const [corr, setCorr] = useState<CorrKey>('q_bh');
  const [sel, setSel] = useState<[number, number] | null>(null);
  const alpha = run?.alpha ?? 0.05;
  const d = q.data;

  const block: CrossDrawBlock | undefined = useMemo(() => {
    if (!d) return undefined;
    if (lagSel === 'window') return d.window;
    return d.lags.find((l) => l.lag === lagSel);
  }, [d, lagSel]);

  const rowMap = useMemo(() => {
    const m = new Map<string, CrossDrawRow>();
    block?.rows.forEach((r) => m.set(`${r.prev}-${r.next}`, r));
    return m;
  }, [block]);
  const selected = sel ? rowMap.get(`${sel[0]}-${sel[1]}`) : undefined;

  const heat = useMemo(() => {
    if (!block) return null;
    if (metric === 'observed') return { z: block.matrix, colorscale: sequentialScale(dark), zmid: undefined as number | undefined, zmin: undefined as number | undefined, zmax: undefined as number | undefined, title: '관측' };
    const m = Math.max(3, block.summary.max_abs_z);
    return { z: block.z_matrix, colorscale: divergingScale(dark), zmid: 0, zmin: -m, zmax: m, title: 'z' };
  }, [block, metric, dark]);

  const sigOf = (r: CrossDrawRow) => (corr === 'p_maxT' ? (r.p_maxT ?? 1) < alpha : corr === 'q_bh' ? r.sig_bh : r[corr] < alpha);
  const cols: Column<CrossDrawRow>[] = [
    { key: 'cell', label: '전 → 후', sortValue: (r) => r.prev * 100 + r.next, render: (r) => `${r.prev} → ${r.next}${r.prev === r.next ? ' (재출현)' : ''}` },
    { key: 'observed', label: <Term id="cross_draw" icon>관측</Term>, align: 'right' },
    { key: 'expected_cond', label: <Term id="cond_independence_z" icon>기대(조건부)</Term>, align: 'right', render: (r) => fmtNum(r.expected_cond, 2) },
    { key: 'cond_lift', label: '조건부 Lift', align: 'right', render: (r) => fmtNum(r.cond_lift, 3) },
    { key: 'z', label: <Term id="z_score" icon>z</Term>, align: 'right', render: (r) => fmtNum(r.z, 2) },
    { key: 'p', label: <Term id="p_value" icon>원시 p</Term>, align: 'right', render: (r) => fmtP(r.p) },
    { key: corr, label: <Term id={CORR.find((c) => c.v === corr)!.term} icon>{CORR.find((c) => c.v === corr)!.label}</Term>, align: 'right', render: (r) => fmtP(r[corr]) },
    { key: 'sig', label: <Term id="exploratory" icon>판정</Term>, sortValue: (r) => (sigOf(r) ? 2 : r.p < 0.05 ? 1 : 0), render: (r) => <PValueBadge p={r.p} alpha={alpha} sig={sigOf(r)} showValue={false} /> },
  ];

  return (
    <div className="space-y-4">
      <PageTitle title="회차간 연관성" sub="전회차 번호 i → 후회차 번호 j 의 교차 공출현 (lag 1..L 개별 + 창 합산), 조건부 독립성 z 히트맵, maxT 판정" />
      <RunPicker />
      {!run && <Empty>완료된 분석 run 없음</Empty>}
      {q.isLoading && <Loading />}
      {q.isError && <ErrorBox error={q.error} />}
      {d && block && (
        <>
          {envLag != null && envLag !== d.max_lag && (
            <p role="note" aria-label="간격 설정 불일치" className="rounded-md border border-sky-300 bg-sky-50 p-3 text-xs text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
              이 run 은 간격 <b>L={d.max_lag}</b> 로 계산되었고, 현재 <code>.env.local</code> 의 <code>LOTTO_CROSS_DRAW_LAG</code> 는 <b>{envLag}</b> 입니다. 간격은 run 생성 시점에 고정되므로 설정/실행에서 새 분석 run 을 만들거나 <code>make reanalyze</code> 를 실행하면 반영됩니다.
            </p>
          )}
          {d.alerts.length > 0 ? (
            <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <b>회차간 의존성 경보 ({d.alerts.length})</b>
              <ul className="list-disc pl-5">
                {d.alerts.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">회차간 의존성 경보 없음.</p>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label={<Term id="cross_draw_lag" icon>간격 · 쌍 수</Term>} value={`1..${d.coverage.effective_max_lag}`} sub={<>{envLag != null ? `설정 L=${envLag} · ` : ''}창 {block === d.window ? '' : `(lag ${lagSel}) `}쌍 {block.summary.n_pairs.toLocaleString()} · 셀 {block.summary.n_cells.toLocaleString()} · 기대(H0) {fmtNum(block.summary.expected, 2)}</>} />
            <KpiCard label={<Term id="maxT" icon>최대 |z| 셀 · maxT p</Term>} value={fmtP(block.summary.max_cell_p_maxT)} sub={`${block.summary.max_cell[0]} → ${block.summary.max_cell[1]} · z=${fmtNum(block.summary.max_abs_z, 2)}`} tone={(block.summary.max_cell_p_maxT ?? 1) < alpha ? 'warn' : 'neutral'} />
            <KpiCard label={<Term id="multiple_testing" icon>유의 셀 BH / BY / FWER</Term>} value={`${block.summary.n_sig_bh} / ${block.summary.n_sig_by} / ${block.summary.n_sig_fwer ?? '—'}`} sub={<>원시 p&lt;0.05 {block.summary.n_raw_p05} (<Term id="exploratory">우연 기대</Term> {fmtNum(block.summary.expected_false_positives_raw, 0)})</>} tone={block.summary.n_sig_bh > 0 ? 'warn' : 'neutral'} />
            <KpiCard label={<Term id="overlap" icon>재출현 (대각 합)</Term>} value={block.summary.repeat.observed.toLocaleString()} sub={`기대(조건부) ${fmtNum(block.summary.repeat.expected_cond, 1)} · z=${fmtNum(block.summary.repeat.z, 2)}`} />
          </div>
          {d.any_lag && (
            <p className="text-xs text-neutral-500">
              전 lag 최대: lag {d.any_lag.lag} 셀 {d.any_lag.cell[0]} → {d.any_lag.cell[1]} z={fmtNum(d.any_lag.max_abs_z, 2)} · maxT p {fmtP(d.any_lag.p_maxT)} ({d.any_lag.n_tests.toLocaleString()} 검정 가족)
            </p>
          )}
          <PolicyBanner
            compact
            lines={[
              <Fragment key="policy">
                <Term id="cross_draw">회차간 교차</Term>는 앞·뒤 회차가 <Term id="null_hypothesis">독립</Term>이라는 가정에서 모든 셀 확률이 (6/45)² = {fmtNum(d.p_cell * 100, 2)}% 로 같습니다. 통계량은 <Term id="cond_independence_z">주변빈도 조건부 독립성 z</Term> 로, 자주 나온 번호의 셀이 부풀려지지 않습니다. {d.N * d.N}셀 탐색 시 약 {fmtNum(d.window.summary.expected_false_positives_raw, 0)}개의 <Term id="exploratory">우연 후보</Term>(p&lt;0.05)가 정상입니다.
              </Fragment>,
              <Fragment key="edge">
                <Term id="cross_draw_lag">경계 처리</Term>: {d.coverage.note} 앞 {d.coverage.n_draws_partial_head}회차({d.coverage.partial_head.map((h) => h.draw_no).join(', ')})·뒤 {d.coverage.n_draws_partial_tail}회차({d.coverage.partial_tail.map((h) => h.draw_no).join(', ')})는 간격 내 일부 쌍만 참여합니다.
              </Fragment>,
            ]}
          />

          <Section
            title="45×45 히트맵 (행 = 전회차 번호, 열 = 후회차 번호)"
            right={
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label>
                  <Term id="cross_draw_lag">lag</Term>{' '}
                  <select aria-label="lag 선택" className={`${inputCls} inline w-auto`} value={String(lagSel)} onChange={(e) => setLagSel(e.target.value === 'window' ? 'window' : Number(e.target.value))}>
                    <option value="window">창 1..{d.coverage.effective_max_lag} 합산</option>
                    {d.lags.map((l) => (
                      <option key={l.lag} value={l.lag}>
                        lag {l.lag} ({l.draw_pairs.first[0]}→{l.draw_pairs.first[1]} … {l.draw_pairs.last[0]}→{l.draw_pairs.last[1]})
                      </option>
                    ))}
                  </select>
                </label>
                <div role="group" className="inline-flex overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-600">
                  {(['observed', 'z'] as Metric[]).map((mm) => (
                    <button key={mm} type="button" onClick={() => setMetric(mm)} className={`px-2.5 py-1 ${metric === mm ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : ''}`}>
                      {mm === 'observed' ? '관측' : 'z'}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                {heat && (
                  <PlotlyChart
                    height={520}
                    data={[
                      {
                        type: 'heatmap',
                        z: heat.z,
                        x: NUMS,
                        y: NUMS,
                        colorscale: heat.colorscale,
                        zmid: heat.zmid,
                        zmin: heat.zmin,
                        zmax: heat.zmax,
                        xgap: 1,
                        ygap: 1,
                        colorbar: { title: { text: heat.title }, thickness: 10 },
                        hovertemplate: `전 %{y} → 후 %{x}<br>${heat.title}=%{z:.3f}<extra></extra>`,
                      } as Trace,
                    ]}
                    layout={{ xaxis: { title: { text: '후회차 번호' }, dtick: 5, side: 'bottom', range: [0.5, 45.5], constrain: 'domain' }, yaxis: { title: { text: '전회차 번호' }, dtick: 5, range: [45.5, 0.5], scaleanchor: 'x', constrain: 'domain' }, margin: { l: 48, r: 8, t: 8, b: 40 } }}
                    onClick={(e) => {
                      const pt = e.points?.[0];
                      if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') setSel([pt.y, pt.x]);
                    }}
                  />
                )}
              </div>
              <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
                <h3 className="mb-2 text-sm font-semibold">셀 상세</h3>
                {selected ? <CellDetail row={selected} alpha={alpha} /> : <p className="text-sm text-neutral-500">{sel && block !== d.window ? `lag ${lagSel} 표에는 상위 ${block.rows.length}셀만 저장됩니다. 창(합산)에서는 전체 셀을 볼 수 있습니다.` : '히트맵 셀 또는 표 행을 클릭하세요.'}</p>}
              </div>
            </div>
          </Section>

          <Section
            title={block === d.window ? '상위 셀 (창 합산, 전체 2,025셀)' : `상위 셀 (lag ${lagSel}, |z| 상위 ${block.rows.length})`}
            right={
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
            }
          >
            <DataTable columns={cols} rows={block.rows} rowKey={(r) => `${r.prev}-${r.next}`} initialSort={{ key: 'z', dir: 'desc' }} pageSize={25} dense onRowClick={(r) => setSel([r.prev, r.next])} selectedKey={selected ? `${selected.prev}-${selected.next}` : null} csvName={`cross_draw_${lagSel}`} />
          </Section>

          <Section title="lag 별 요약">
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-1 pr-3">lag</th>
                    <th className="py-1 pr-3">쌍 수</th>
                    <th className="py-1 pr-3">기대(H0)</th>
                    <th className="py-1 pr-3">최대 |z| 셀</th>
                    <th className="py-1 pr-3">maxT p</th>
                    <th className="py-1 pr-3">유의 BH / FWER</th>
                    <th className="py-1 pr-3">원시 p&lt;0.05</th>
                    <th className="py-1 pr-3">재출현 관측 / 기대(조건부) · z</th>
                  </tr>
                </thead>
                <tbody>
                  {[...d.lags.map((l) => ({ lag: l.lag, summary: l.summary })), { lag: 0, summary: d.window.summary }].map((l) => (
                    <tr key={l.lag} className="border-t border-neutral-200 dark:border-neutral-700">
                      <td className="py-1 pr-3">{l.lag === 0 ? `창 1..${d.coverage.effective_max_lag}` : l.lag}</td>
                      <td className="py-1 pr-3">{l.summary.n_pairs.toLocaleString()}</td>
                      <td className="py-1 pr-3">{fmtNum(l.summary.expected, 2)}</td>
                      <td className="py-1 pr-3">
                        {l.summary.max_cell[0]} → {l.summary.max_cell[1]} (z={fmtNum(l.summary.max_abs_z, 2)})
                      </td>
                      <td className="py-1 pr-3">{fmtP(l.summary.max_cell_p_maxT)}</td>
                      <td className="py-1 pr-3">
                        {l.summary.n_sig_bh} / {l.summary.n_sig_fwer ?? '—'}
                      </td>
                      <td className="py-1 pr-3">{l.summary.n_raw_p05}</td>
                      <td className="py-1 pr-3">
                        {l.summary.repeat.observed} / {fmtNum(l.summary.repeat.expected_cond, 1)} · {fmtNum(l.summary.repeat.z, 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-neutral-500">{d.note}</p>
          </Section>
        </>
      )}
    </div>
  );
}
