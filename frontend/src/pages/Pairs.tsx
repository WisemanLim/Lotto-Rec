import { Fragment, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, type ItemsetQueryResult, type ItemsetRow, type ItemsetsSection, type NetworkSection, type PairRow, type PairsSection } from '../api/client';
import { useRun, useSection } from '../hooks/useRun';
import { usePrefersDark } from '../hooks/usePrefersDark';
import DataTable, { type Column } from '../components/DataTable';
import PValueBadge from '../components/PValueBadge';
import PlotlyChart, { type Trace } from '../components/PlotlyChart';
import RunPicker from '../components/RunPicker';
import Term from '../components/Term';
import { BallRow } from '../components/LottoBall';
import PolicyBanner from '../components/PolicyBanner';
import { Empty, ErrorBox, Field, Loading, PageTitle, Section, btnCls, inputCls } from '../components/States';
import { fmtNum, fmtP } from '../lib/format';
import { ACCENT, INK, OBSERVED, divergingScale, sequentialScale } from '../lib/colors';

type Metric = 'observed' | 'z' | 'lift';
type CorrKey = 'q_bh' | 'q_by' | 'p_holm' | 'p_bonferroni' | 'p_maxT';
const CORR: Array<{ v: CorrKey; label: string; term: string }> = [
  { v: 'q_bh', label: 'BH q', term: 'fdr_bh' },
  { v: 'q_by', label: 'BY q', term: 'fdr_by' },
  { v: 'p_holm', label: 'Holm p', term: 'holm' },
  { v: 'p_bonferroni', label: 'Bonferroni p', term: 'bonferroni' },
  { v: 'p_maxT', label: 'maxT p (FWER)', term: 'maxT' },
];
const NUMS = Array.from({ length: 45 }, (_, i) => i + 1);

function PairDetail({ row, alpha }: { row: PairRow; alpha: number }) {
  return (
    <div className="space-y-2 text-sm">
      <BallRow numbers={[row.a, row.b]} />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
        <dt className="text-neutral-500">
          <Term id="cooccurrence">관측</Term> / 기대
        </dt>
        <dd>
          {row.observed} / {fmtNum(row.expected, 2)}
        </dd>
        <dt className="text-neutral-500">잔차</dt>
        <dd>{fmtNum(row.residual, 2)}</dd>
        <dt className="text-neutral-500">
          <Term id="calibrated_lift">보정 Lift*</Term>
        </dt>
        <dd>{fmtNum(row.calibrated_lift, 3)}</dd>
        <dt className="text-neutral-500">
          <Term id="z_score">z</Term>
        </dt>
        <dd>{fmtNum(row.z, 3)}</dd>
        <dt className="text-neutral-500">
          <Term id="conditional_prob">P(b|a)</Term> / 영가설
        </dt>
        <dd>
          {fmtNum(row.cond_prob_b_given_a, 4)} / {fmtNum(row.cond_prob_null, 4)}
        </dd>
        <dt className="text-neutral-500">
          <Term id="p_value">원시 p</Term>
        </dt>
        <dd>
          <PValueBadge p={row.p} q={row.q_bh} alpha={alpha} sig={row.sig_bh} />
        </dd>
        <dt className="text-neutral-500">
          <Term id="bonferroni">Bonferroni</Term> / <Term id="holm">Holm</Term>
        </dt>
        <dd>
          {fmtP(row.p_bonferroni)} / {fmtP(row.p_holm)}
        </dd>
        <dt className="text-neutral-500">
          q <Term id="fdr_bh">BH</Term> / <Term id="fdr_by">BY</Term>
        </dt>
        <dd>
          {fmtP(row.q_bh)} / {fmtP(row.q_by)}
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

function NetworkGraph({ net }: { net: NetworkSection }) {
  const dark = usePrefersDark();
  const ink = dark ? INK.dark : INK.light;
  const pos = useMemo(() => {
    const m = new Map<number, [number, number]>();
    NUMS.forEach((n, i) => {
      const th = (2 * Math.PI * i) / 45 - Math.PI / 2;
      m.set(n, [Math.cos(th), Math.sin(th)]);
    });
    return m;
  }, []);
  const edgeTrace = (kind: 'significant' | 'exploratory') => {
    const xs: (number | null)[] = [];
    const ys: (number | null)[] = [];
    net.edges
      .filter((e) => e.kind === kind)
      .forEach((e) => {
        const a = pos.get(e.source)!;
        const b = pos.get(e.target)!;
        xs.push(a[0], b[0], null);
        ys.push(a[1], b[1], null);
      });
    return {
      type: 'scatter' as const,
      mode: 'lines' as const,
      x: xs,
      y: ys,
      name: kind === 'significant' ? '유의 (보정 후)' : '탐색 (상위 |z|)',
      line: { color: kind === 'significant' ? (dark ? ACCENT.dark : ACCENT.light) : ink.muted, width: kind === 'significant' ? 2.5 : 1 },
      opacity: kind === 'significant' ? 1 : 0.6,
      hoverinfo: 'skip' as const,
    };
  };
  const degree = new Map<number, number>();
  net.edges.forEach((e) => {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  });
  return (
    <PlotlyChart
      height={420}
      data={[
        edgeTrace('exploratory'),
        edgeTrace('significant'),
        {
          type: 'scatter',
          mode: 'text+markers',
          x: net.nodes.map((n) => pos.get(n.id)![0]),
          y: net.nodes.map((n) => pos.get(n.id)![1]),
          text: net.nodes.map((n) => String(n.id)),
          textposition: 'middle center',
          textfont: { size: 9, color: '#ffffff' },
          marker: { size: net.nodes.map((n) => 14 + 2 * (degree.get(n.id) ?? 0)), color: dark ? OBSERVED.dark : OBSERVED.light, line: { color: dark ? '#1a1a19' : '#ffffff', width: 2 } },
          customdata: net.nodes.map((n) => [n.frequency, degree.get(n.id) ?? 0, n.degree_sig]),
          hovertemplate: '번호 %{text}<br>출현 %{customdata[0]} · 연결 %{customdata[1]} · 유의 연결 %{customdata[2]}<extra></extra>',
          name: '번호',
        },
      ]}
      layout={{
        xaxis: { visible: false, range: [-1.2, 1.2] },
        yaxis: { visible: false, range: [-1.2, 1.2], scaleanchor: 'x' },
        showlegend: true,
        margin: { l: 8, r: 8, t: 8, b: 8 },
      }}
    />
  );
}

function ItemsetQueryForm({ cohort }: { cohort: 'A' | 'B' | 'ALL' }) {
  const [mode, setMode] = useState<'items' | 'conditional'>('items');
  const [items, setItems] = useState('1, 2, 3');
  const [target, setTarget] = useState('1');
  const [given, setGiven] = useState('2, 3');
  const parse = (s: string) =>
    s
      .split(/[,\s]+/)
      .map((x) => Number(x))
      .filter((x) => Number.isInteger(x) && x >= 1 && x <= 45);
  const m = useMutation({ mutationFn: (body: Parameters<typeof api.analysis.itemsetQuery>[0]) => api.analysis.itemsetQuery(body) });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'items') m.mutate({ items: parse(items), cohort });
    else m.mutate({ target: parse(target), given: parse(given), cohort });
  };
  const r: ItemsetQueryResult | undefined = m.data;
  return (
    <form onSubmit={submit} className="space-y-3">
      <div role="group" className="inline-flex overflow-hidden rounded-md border border-neutral-300 text-xs dark:border-neutral-600">
        <button type="button" onClick={() => setMode('items')} className={`px-2.5 py-1 ${mode === 'items' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : ''}`}>
          집합 공출현
        </button>
        <button type="button" onClick={() => setMode('conditional')} className={`px-2.5 py-1 ${mode === 'conditional' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : ''}`}>
          조건부 P(target | given)
        </button>
      </div>
      {mode === 'items' ? (
        <Field label="번호 집합 (2–6개, 쉼표 구분)">
          <input className={inputCls} value={items} onChange={(e) => setItems(e.target.value)} />
        </Field>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="target 번호">
            <input className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
          <Field label="given 번호">
            <input className={inputCls} value={given} onChange={(e) => setGiven(e.target.value)} />
          </Field>
        </div>
      )}
      <button type="submit" className={btnCls} disabled={m.isPending}>
        {m.isPending ? '조회 중…' : `조회 (군 ${cohort})`}
      </button>
      {m.isError && <ErrorBox error={m.error} />}
      {r?.itemset && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm tabular-nums">
          <dt className="text-neutral-500">집합</dt>
          <dd>
            <BallRow numbers={r.itemset.itemset} size="sm" />
          </dd>
          <dt className="text-neutral-500">관측 / 기대 (T={r.T})</dt>
          <dd>
            {r.itemset.observed} / {fmtNum(r.itemset.expected, 3)}
          </dd>
          <dt className="text-neutral-500">영가설 확률</dt>
          <dd>{r.itemset.null_prob.toExponential(3)}</dd>
          <dt className="text-neutral-500">
            <Term id="calibrated_lift">보정 Lift*</Term>
          </dt>
          <dd>{fmtNum(r.itemset.calibrated_lift, 3)}</dd>
          <dt className="text-neutral-500">p</dt>
          <dd>
            <PValueBadge p={r.itemset.p} sig={false} />
          </dd>
          {r.itemset.power_note && <dd className="col-span-2 text-xs text-amber-800 dark:text-amber-200">{r.itemset.power_note}</dd>}
        </dl>
      )}
      {r?.conditional && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm tabular-nums">
          <dt className="text-neutral-500">
            <Term id="conditional_prob">P(target | given)</Term>
          </dt>
          <dd>
            {fmtNum(r.conditional.cond_prob, 4)} (영가설 {fmtNum(r.conditional.cond_prob_null, 4)})
          </dd>
          <dt className="text-neutral-500">given 출현 / 동시 출현</dt>
          <dd>
            {r.conditional.n_given} / {r.conditional.n_both} (T={r.T})
          </dd>
          <dt className="text-neutral-500">조건부 lift</dt>
          <dd>{fmtNum(r.conditional.conditional_lift, 3)}</dd>
          <dt className="text-neutral-500">p</dt>
          <dd>
            <PValueBadge p={r.conditional.p} sig={false} />
          </dd>
          <dt className="text-neutral-500">합집합 관측 / 기대</dt>
          <dd>
            {r.conditional.union.observed} / {fmtNum(r.conditional.union.expected, 3)} (Lift* {fmtNum(r.conditional.union.calibrated_lift, 3)})
          </dd>
          {r.conditional.union.power_note && <dd className="col-span-2 text-xs text-amber-800 dark:text-amber-200">{r.conditional.union.power_note}</dd>}
        </dl>
      )}
    </form>
  );
}

export default function Pairs() {
  const { run } = useRun();
  const dark = usePrefersDark();
  const pairs = useSection<PairsSection>('pairs');
  const net = useSection<NetworkSection>('network');
  const items = useSection<ItemsetsSection>('itemsets');
  const [metric, setMetric] = useState<Metric>('z');
  const [corr, setCorr] = useState<CorrKey>('q_bh');
  const [alphaIn, setAlphaIn] = useState(String(run?.alpha ?? 0.05));
  const [minDelta, setMinDelta] = useState('0');
  const [sel, setSel] = useState<[number, number] | null>(null);
  const alpha = Number(alphaIn) || 0.05;
  const delta = Number(minDelta) || 0;

  const rowMap = useMemo(() => {
    const m = new Map<string, PairRow>();
    pairs.data?.rows.forEach((r) => m.set(`${Math.min(r.a, r.b)}-${Math.max(r.a, r.b)}`, r));
    return m;
  }, [pairs.data]);
  const selected = sel ? rowMap.get(`${Math.min(...sel)}-${Math.max(...sel)}`) : undefined;

  const filtered = useMemo(() => {
    if (!pairs.data) return [];
    return pairs.data.rows.filter((r) => Math.abs(r.calibrated_lift - 1) >= delta);
  }, [pairs.data, delta]);

  const heat = useMemo(() => {
    if (!pairs.data) return null;
    const { matrix, z_matrix } = pairs.data;
    if (metric === 'observed') {
      const z = matrix.map((row, i) => row.map((v, j) => (i === j ? null : v)));
      return { z, colorscale: sequentialScale(dark), zmid: undefined as number | undefined, zmin: undefined as number | undefined, zmax: undefined as number | undefined, title: '공출현' };
    }
    if (metric === 'z') {
      const z = z_matrix.map((row, i) => row.map((v, j) => (i === j ? null : v)));
      const m = Math.max(3, pairs.data.summary.max_abs_z);
      return { z, colorscale: divergingScale(dark), zmid: 0, zmin: -m, zmax: m, title: 'z' };
    }
    const z = matrix.map((row, i) => row.map((v, j) => (i === j ? null : v / pairs.data!.summary.expected)));
    return { z, colorscale: divergingScale(dark), zmid: 1, zmin: 0, zmax: 2, title: 'Lift*' };
  }, [pairs.data, metric, dark]);

  const sigOf = (r: PairRow) => (corr === 'p_maxT' ? r.p_maxT < alpha : corr === 'q_bh' && alpha === (run?.alpha ?? 0.05) ? r.sig_bh : r[corr] < alpha);
  const cols: Column<PairRow>[] = [
    { key: 'pair', label: '쌍', sortValue: (r) => r.a * 100 + r.b, render: (r) => `${r.a}–${r.b}` },
    { key: 'observed', label: <Term id="cooccurrence" icon>관측</Term>, align: 'right' },
    { key: 'expected', label: '기대', align: 'right', render: (r) => fmtNum(r.expected, 2) },
    { key: 'calibrated_lift', label: <Term id="calibrated_lift" icon>Lift*</Term>, align: 'right', render: (r) => fmtNum(r.calibrated_lift, 3) },
    { key: 'z', label: <Term id="z_score" icon>z</Term>, align: 'right', render: (r) => fmtNum(r.z, 2) },
    { key: 'p', label: <Term id="p_value" icon>원시 p</Term>, align: 'right', render: (r) => fmtP(r.p) },
    { key: corr, label: <Term id={CORR.find((c) => c.v === corr)!.term} icon>{CORR.find((c) => c.v === corr)!.label}</Term>, align: 'right', render: (r) => fmtP(r[corr]) },
    { key: 'sig', label: <Term id="exploratory" icon>판정</Term>, sortValue: (r) => (sigOf(r) ? 2 : r.p < 0.05 ? 1 : 0), render: (r) => <PValueBadge p={r.p} alpha={alpha} sig={sigOf(r)} showValue={false} /> },
  ];
  const tripleCols: Column<ItemsetRow>[] = [
    { key: 'itemset', label: <Term id="itemset" icon>3-집합</Term>, sortValue: (r) => r.itemset.join(','), render: (r) => <BallRow numbers={r.itemset} size="sm" /> },
    { key: 'observed', label: '관측', align: 'right' },
    { key: 'expected', label: '기대', align: 'right', render: (r) => fmtNum(r.expected, 2) },
    { key: 'calibrated_lift', label: <Term id="calibrated_lift" icon>Lift*</Term>, align: 'right', render: (r) => fmtNum(r.calibrated_lift, 2) },
    { key: 'cond_prob', label: <Term id="conditional_prob" icon>P(c|a,b)</Term>, align: 'right', render: (r) => `${fmtNum(r.cond_prob, 3)} (영 ${fmtNum(r.cond_prob_null, 3)})` },
    { key: 'p', label: '원시 p', align: 'right', render: (r) => fmtP(r.p) },
    { key: 'q_by', label: <Term id="fdr_by" icon>q (BY)</Term>, align: 'right', render: (r) => <PValueBadge p={r.p} q={r.q_by} alpha={alpha} sig={r.sig_by} /> },
  ];

  return (
    <div className="space-y-4">
      <PageTitle title="조합 연관성" sub="번호쌍 공출현·보정 Lift*·z 히트맵, 다중비교 보정 필터, 네트워크, 3-집합/조건부 탐색" />
      <RunPicker />
      {!run && <Empty>완료된 분석 run 없음</Empty>}
      {pairs.isLoading && <Loading />}
      {pairs.isError && <ErrorBox error={pairs.error} />}
      {pairs.data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['쌍 수 / 기대 공출현', 'cooccurrence', `${pairs.data.summary.n_pairs} / ${fmtNum(pairs.data.summary.expected, 2)}`],
              ['원시 p<0.05 쌍', 'exploratory', `${pairs.data.summary.n_raw_p05} (우연 기대 ${fmtNum(pairs.data.summary.expected_false_positives_raw, 1)})`],
              ['유의 쌍 BH / BY / FWER', 'multiple_testing', `${pairs.data.summary.n_sig_bh} / ${pairs.data.summary.n_sig_by} / ${pairs.data.summary.n_sig_fwer}`],
              ['Genest 통계 MC p', 'genest', fmtP(pairs.data.summary.genest.p_mc)],
            ].map(([k, term, v]) => (
              <div key={k} className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                <div className="text-xs text-neutral-500">
                  <Term id={term} icon>
                    {k}
                  </Term>
                </div>
                <div className="text-lg font-semibold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          <PolicyBanner
            compact
            lines={[
              <Fragment key="policy">
                공정 추첨에서도 쌍 상관은 <Term id="structural_negative_corr">구조적으로 음수</Term>({fmtNum(pairs.data.summary.corr_null, 4)})이며 <Term id="lift_naive">일반 lift</Term> 의 영가설 값은 {fmtNum(pairs.data.summary.naive_lift_null, 3)}입니다. <Term id="calibrated_lift">보정 Lift*</Term> 는 이를 1로 정규화한 값입니다. 990쌍 탐색 시 약 {fmtNum(pairs.data.summary.expected_false_positives_raw, 0)}개의 <Term id="exploratory">우연 후보</Term>(p&lt;0.05)가 정상입니다.
              </Fragment>,
            ]}
          />

          <Section
            title="45×45 히트맵"
            right={
              <div role="group" className="inline-flex overflow-hidden rounded-md border border-neutral-300 text-xs dark:border-neutral-600">
                {(['observed', 'z', 'lift'] as Metric[]).map((mm) => (
                  <button key={mm} type="button" onClick={() => setMetric(mm)} className={`px-2.5 py-1 ${metric === mm ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : ''}`}>
                    {mm === 'observed' ? '공출현' : mm === 'z' ? 'z' : 'Lift*'}
                  </button>
                ))}
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
                        z: heat.z as number[][],
                        x: NUMS,
                        y: NUMS,
                        colorscale: heat.colorscale,
                        zmid: heat.zmid,
                        zmin: heat.zmin,
                        zmax: heat.zmax,
                        xgap: 1,
                        ygap: 1,
                        colorbar: { title: { text: heat.title }, thickness: 10 },
                        hoverongaps: false,
                        hovertemplate: `%{y}–%{x}<br>${heat.title}=%{z:.3f}<extra></extra>`,
                      } as Trace,
                    ]}
                    layout={{ xaxis: { dtick: 5, side: 'bottom', range: [0.5, 45.5], constrain: 'domain' }, yaxis: { dtick: 5, range: [45.5, 0.5], scaleanchor: 'x', constrain: 'domain' }, margin: { l: 36, r: 8, t: 8, b: 32 } }}
                    onClick={(e) => {
                      const pt = e.points?.[0];
                      if (pt && typeof pt.x === 'number' && typeof pt.y === 'number' && pt.x !== pt.y) setSel([pt.y, pt.x]);
                    }}
                  />
                )}
              </div>
              <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
                <h3 className="mb-2 text-sm font-semibold">쌍 상세</h3>
                {selected ? <PairDetail row={selected} alpha={alpha} /> : <p className="text-sm text-neutral-500">히트맵 셀 또는 표 행을 클릭하세요.</p>}
              </div>
            </div>
          </Section>

          <Section
            title="상위 쌍"
            right={
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label>
                  <Term id="multiple_testing">보정법</Term>{' '}
                  <select className={`${inputCls} inline w-auto`} value={corr} onChange={(e) => setCorr(e.target.value as CorrKey)}>
                    {CORR.map((c) => (
                      <option key={c.v} value={c.v}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <Term id="alpha">α</Term> <input className={`${inputCls} inline w-20`} value={alphaIn} onChange={(e) => setAlphaIn(e.target.value)} inputMode="decimal" />
                </label>
                <label>
                  최소 |Lift*−1| <input className={`${inputCls} inline w-20`} value={minDelta} onChange={(e) => setMinDelta(e.target.value)} inputMode="decimal" />
                </label>
              </div>
            }
          >
            <DataTable
              columns={cols}
              rows={filtered}
              rowKey={(r) => `${r.a}-${r.b}`}
              initialSort={{ key: 'z', dir: 'desc' }}
              pageSize={25}
              dense
              onRowClick={(r) => setSel([r.a, r.b])}
              selectedKey={selected ? `${selected.a}-${selected.b}` : null}
              csvName="pairs"
            />
          </Section>
        </>
      )}

      {run && (
        <Section title={<Term id="network" icon>공출현 네트워크</Term>} right={net.data && <span className="text-xs text-neutral-500">기준: α={net.data.criteria.alpha}, δ={net.data.criteria.delta}, 탐색 상위 {net.data.criteria.exploratory_top} · 간선 {net.data.edges.length}</span>}>
          {net.isLoading && <Loading />}
          {net.isError && <ErrorBox error={net.error} />}
          {net.data && <NetworkGraph net={net.data} />}
        </Section>
      )}

      <div className="space-y-4">
        <Section title="집합 / 조건부 탐색기">{run ? <ItemsetQueryForm cohort={run.cohort} /> : <Empty />}</Section>
        <Section title={<Term id="itemset" icon>3-집합 (상위 쌍 확장)</Term>} right={items.data && <span className="text-xs text-neutral-500">후보 {items.data.summary.n_candidates} · 기대 {fmtNum(items.data.summary.expected_count, 2)}회 · 원시 p&lt;0.05 {items.data.summary.n_raw_p05} · 유의(BY) {items.data.summary.n_sig_by}</span>}>
          {items.isLoading && <Loading />}
          {items.isError && <ErrorBox error={items.error} />}
          {items.data && (
            <>
              <DataTable columns={tripleCols} rows={items.data.rows} rowKey={(r) => r.itemset.join('-')} initialSort={{ key: 'observed', dir: 'desc' }} pageSize={15} dense csvName="itemsets" />
              <p className="mt-2 text-xs text-neutral-500">{items.data.summary.note}</p>
              <p className="text-xs text-neutral-500">
                크기별 기대 공출현(T={pairs.data?.summary.T}): {items.data.size_expectations.map((s) => `${s.size}개 ${fmtNum(s.expected, 2)}`).join(' · ')}
              </p>
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
