import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Experiment, type ExperimentIn, type LineagePoint, type StrategyParamInfo } from '../api/client';
import DataTable, { type Column } from './DataTable';
import PlotlyChart from './PlotlyChart';
import PolicyBanner from './PolicyBanner';
import VerdictBadge from './VerdictBadge';
import Term from './Term';
import { ErrorBox, Field, Loading, Section, btnCls, inputCls } from './States';
import { fmtCI, fmtDate, fmtNum, fmtP, fmtParams, fmtSigned } from '../lib/format';

function ActiveCard({ strategy, exp }: { strategy: string; exp: Experiment | null }) {
  const qc = useQueryClient();
  const deact = useMutation({
    mutationFn: () => api.experiments.deactivate(strategy),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['experiments'] }),
  });
  const mh = exp?.metrics_holdout as Experiment['metrics_holdout'] & { diff_vs_uniform?: { mean: number; ci95: number[] }; verdict?: string; mean_matches?: number };
  return (
    <div className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-700" data-testid="active-card">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="font-semibold">활성 버전</span>
        {exp ? (
          <>
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] text-blue-800 dark:bg-blue-900 dark:text-blue-100">v{exp.iteration}</span>
            <span className="font-mono text-xs text-neutral-500">{exp.experiment_id.slice(0, 8)}</span>
            <button type="button" className="text-xs underline" onClick={() => deact.mutate()} disabled={deact.isPending}>
              비활성화(기본값 사용)
            </button>
          </>
        ) : (
          <span className="text-neutral-500">없음 — 기본 파라미터로 추천 생성</span>
        )}
      </div>
      {exp && (
        <div className="space-y-1 text-xs">
          <div>
            <Term id="strategy_params">파라미터</Term>: {fmtParams(exp.params)}
          </div>
          <div className="tabular-nums">
            <Term id="holdout">홀드아웃</Term> {exp.holdout_from}–{exp.holdout_to}: <Term id="expected_matches">평균 일치</Term> {fmtNum(mh?.mean_matches ?? null, 4)} (기대 0.8) · <Term id="diff_vs_uniform">균등 대비</Term> {fmtSigned(mh?.diff_vs_uniform?.mean ?? null, 4)}{' '}
            <Term id="ci">CI</Term> {fmtCI(mh?.diff_vs_uniform?.ci95 ?? null, 3)}
          </div>
          {mh?.verdict && <VerdictBadge ok={(mh.diff_vs_uniform?.ci95?.[0] ?? -1) > 0} text={mh.verdict} />}
        </div>
      )}
    </div>
  );
}

function NewExperimentForm({ info, defaults, onCreated }: { info: StrategyParamInfo; defaults: { tickets: number; trainEnd: number; seed: number }; onCreated: (e: Experiment) => void }) {
  const [search, setSearch] = useState<'random' | 'coordinate'>('random');
  const [k, setK] = useState('8');
  const [tickets, setTickets] = useState(String(defaults.tickets));
  const [tuneFrom, setTuneFrom] = useState(String(defaults.trainEnd + 1));
  const [tuneTo, setTuneTo] = useState(String(defaults.trainEnd + 120));
  const [holdFrom, setHoldFrom] = useState(String(defaults.trainEnd + 121));
  const [holdTo, setHoldTo] = useState(String(defaults.trainEnd + 240));
  const [seed, setSeed] = useState('');
  const [base, setBase] = useState<Record<string, string>>({});
  useEffect(() => {
    setBase(Object.fromEntries(Object.entries(info.defaults).map(([k2, v]) => [k2, String(v)])));
  }, [info]);
  const m = useMutation({
    mutationFn: (b: ExperimentIn) => api.experiments.create(b),
    onSuccess: (e) => onCreated(e),
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const bp: Record<string, number> = {};
    for (const [kk, v] of Object.entries(base)) if (v !== '') bp[kk] = Number(v);
    m.mutate({
      strategy: info.id,
      search,
      n_candidates: Number(k),
      tickets_per_draw: Number(tickets),
      tune_from: Number(tuneFrom),
      tune_to: Number(tuneTo),
      holdout_from: Number(holdFrom),
      holdout_to: Number(holdTo),
      seed: seed ? Number(seed) : null,
      base_params: Object.keys(bp).length ? bp : null,
      sync: false,
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3" aria-label="새 실험">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="탐색" hint="random: 범위 내 균일 · coordinate: 한 파라미터씩 ±단계">
          <select className={inputCls} value={search} onChange={(e) => setSearch(e.target.value as 'random' | 'coordinate')} aria-label="탐색">
            <option value="random">random</option>
            <option value="coordinate">coordinate</option>
          </select>
        </Field>
        <Field label="후보 수 K" hint="best-of-K 선택 편향은 K 에 따라 커짐">
          <input className={inputCls} type="number" min={1} max={50} value={k} onChange={(e) => setK(e.target.value)} aria-label="후보 수" />
        </Field>
        <Field label="회차당 티켓" hint="기본 .env">
          <input className={inputCls} type="number" min={1} max={50} value={tickets} onChange={(e) => setTickets(e.target.value)} />
        </Field>
        <Field label="seed" hint="빈칸 = 기본 + 세대">
          <input className={inputCls} type="number" value={seed} onChange={(e) => setSeed(e.target.value)} />
        </Field>
        <Field label="튠 구간 B₁ 시작">
          <input className={inputCls} type="number" value={tuneFrom} onChange={(e) => setTuneFrom(e.target.value)} />
        </Field>
        <Field label="튠 구간 B₁ 끝">
          <input className={inputCls} type="number" value={tuneTo} onChange={(e) => setTuneTo(e.target.value)} />
        </Field>
        <Field label="홀드아웃 B₂ 시작">
          <input className={inputCls} type="number" value={holdFrom} onChange={(e) => setHoldFrom(e.target.value)} />
        </Field>
        <Field label="홀드아웃 B₂ 끝">
          <input className={inputCls} type="number" value={holdTo} onChange={(e) => setHoldTo(e.target.value)} />
        </Field>
      </div>
      {Object.keys(info.params).length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
            기준 <Term id="strategy_params">파라미터</Term> (후보 1번, 나머지는 탐색)
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(info.params).map(([name, spec]) => (
              <Field key={name} label={name} hint={`${spec.desc} [${spec.min}–${spec.max}]`}>
                <input
                  className={inputCls}
                  type="number"
                  step={spec.type === 'int' ? 1 : 'any'}
                  min={spec.min}
                  max={spec.max}
                  value={base[name] ?? ''}
                  onChange={(e) => setBase((b) => ({ ...b, [name]: e.target.value }))}
                  aria-label={`기준 ${name}`}
                />
              </Field>
            ))}
          </div>
        </div>
      )}
      <button type="submit" className={btnCls} disabled={m.isPending}>
        {m.isPending ? '실행 요청 중…' : '새 세대 실험 실행'}
      </button>
      {m.isError && <ErrorBox error={m.error} />}
    </form>
  );
}

function LineageChart({ points }: { points: LineagePoint[] }) {
  const xs = points.map((p) => p.iteration);
  const data = useMemo(
    () => [
      { type: 'scatter', mode: 'lines+markers', name: '튠 B₁ 균등 대비', x: xs, y: points.map((p) => p.tune_diff), line: { color: '#9ca3af', dash: 'dot' } },
      {
        type: 'scatter',
        mode: 'lines+markers',
        name: '홀드아웃 B₂ 균등 대비',
        x: xs,
        y: points.map((p) => p.holdout_diff),
        error_y: {
          type: 'data',
          symmetric: false,
          array: points.map((p) => (p.holdout_ci95 && p.holdout_diff != null ? p.holdout_ci95[1] - p.holdout_diff : 0)),
          arrayminus: points.map((p) => (p.holdout_ci95 && p.holdout_diff != null ? p.holdout_diff - p.holdout_ci95[0] : 0)),
        },
        line: { color: '#2563eb' },
      },
      { type: 'scatter', mode: 'lines', name: '홀드아웃 누적 평균 − 0.8', x: xs, y: points.map((p) => (p.cum_holdout_mean != null ? p.cum_holdout_mean - 0.8 : null)), line: { color: '#ea580c' } },
    ],
    [points, xs],
  );
  return (
    <PlotlyChart
      data={data as never}
      height={300}
      layout={{
        xaxis: { title: { text: '세대 (iteration)' }, dtick: 1 },
        yaxis: { title: { text: '평균 일치 차이 (전략 − 균등)' }, zeroline: true },
        shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: '#6b7280', width: 1 } }],
        legend: { orientation: 'h', y: -0.25 },
      }}
    />
  );
}

/** 전략 개선 루프 (PRD §E9): 활성 버전 · 새 실험 · 실험 표 · 세대 추이 · 활성화. */
export default function ExperimentLoop({ strategy, tickets, trainEnd, seed }: { strategy: string; tickets: number; trainEnd: number; seed: number }) {
  const qc = useQueryClient();
  const params = useQuery({ queryKey: ['experiments', 'params'], queryFn: api.experiments.strategyParams });
  const list = useQuery({
    queryKey: ['experiments', 'list', strategy],
    queryFn: () => api.experiments.list(strategy, 200),
    refetchInterval: (q) => (q.state.data?.some((e) => e.status === 'running' || e.status === 'pending') ? 2000 : false),
  });
  const active = useQuery({ queryKey: ['experiments', 'active', strategy], queryFn: () => api.experiments.active(strategy) });
  const lineage = useQuery({ queryKey: ['experiments', 'lineage', strategy], queryFn: () => api.experiments.lineage(strategy) });
  const act = useMutation({
    mutationFn: (id: string) => api.experiments.activate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['experiments'] });
      void qc.invalidateQueries({ queryKey: ['recommend'] });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => api.experiments.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['experiments'] }),
  });
  const info = params.data?.strategies.find((s) => s.id === strategy);
  const [selected, setSelected] = useState<Experiment | null>(null);

  const cols: Column<Experiment>[] = [
    { key: 'iteration', label: '세대', align: 'right' },
    { key: 'created_at', label: '생성', render: (r) => fmtDate(r.created_at) },
    { key: 'status', label: '상태', render: (r) => (r.status === 'done' ? '완료' : r.status === 'error' ? `오류` : `${r.status} ${Math.round(r.progress * 100)}%`) },
    { key: 'search', label: '탐색/K', render: (r) => `${r.search}/${r.n_candidates}` },
    { key: 'params', label: <Term id="strategy_params" icon>선택 파라미터</Term>, sortable: false, render: (r) => <span className="text-xs">{fmtParams(r.params)}</span> },
    {
      key: 'tune',
      label: <Term id="diff_vs_uniform" icon>튠 diff</Term>,
      align: 'right',
      sortValue: (r) => (r.metrics_tune as { diff_vs_uniform?: { mean: number } }).diff_vs_uniform?.mean ?? null,
      render: (r) => fmtSigned((r.metrics_tune as { diff_vs_uniform?: { mean: number } }).diff_vs_uniform?.mean ?? null, 4),
    },
    {
      key: 'pbk',
      label: <Term id="best_of_k" icon>best-of-K p</Term>,
      align: 'right',
      sortValue: (r) => (r.h0_benchmark as { p_best_of_k?: number }).p_best_of_k ?? null,
      render: (r) => fmtP((r.h0_benchmark as { p_best_of_k?: number }).p_best_of_k ?? null),
    },
    {
      key: 'hold',
      label: <Term id="holdout" icon>홀드아웃 diff [CI]</Term>,
      align: 'right',
      sortValue: (r) => (r.metrics_holdout as { diff_vs_uniform?: { mean: number } }).diff_vs_uniform?.mean ?? null,
      render: (r) => {
        const d = (r.metrics_holdout as { diff_vs_uniform?: { mean: number; ci95: number[] } }).diff_vs_uniform;
        return d ? `${fmtSigned(d.mean, 4)} ${fmtCI(d.ci95, 3)}` : '—';
      },
    },
    { key: 'opt', label: <Term id="optimism" icon>optimism</Term>, align: 'right', sortValue: (r) => (r.metrics_holdout as { optimism?: number }).optimism ?? null, render: (r) => fmtSigned((r.metrics_holdout as { optimism?: number }).optimism ?? null, 4) },
    {
      key: 'verdict',
      label: <Term id="verdict" icon>판정</Term>,
      sortable: false,
      render: (r) => {
        const mh = r.metrics_holdout as { verdict?: string; diff_vs_uniform?: { ci95: number[] } };
        return mh.verdict ? <VerdictBadge ok={(mh.diff_vs_uniform?.ci95?.[0] ?? -1) > 0} text={mh.verdict} /> : r.error ? <span className="text-xs text-red-600">{r.error}</span> : null;
      },
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (r) => (
        <span className="flex gap-2 text-xs">
          <button type="button" className="underline" onClick={() => setSelected(r)}>
            상세
          </button>
          {r.status === 'done' && !r.is_active && (
            <button type="button" className="text-blue-700 underline dark:text-blue-300" onClick={() => act.mutate(r.experiment_id)} disabled={act.isPending}>
              활성화
            </button>
          )}
          {r.is_active && <span className="text-emerald-700 dark:text-emerald-300">활성</span>}
          {r.status !== 'running' && (
            <button type="button" className="text-red-600 underline" onClick={() => window.confirm('실험을 삭제할까요?') && del.mutate(r.experiment_id)}>
              삭제
            </button>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4" data-testid="experiment-loop">
      <PolicyBanner
        compact
        lines={[
          <Fragment key="l1">
            시뮬레이션: 군 A(1~1,000회) 분석으로 <Term id="strategy_params">전략 파라미터</Term>를 잡고, 군 B 실데이터를 <Term id="holdout">튠(B₁)·홀드아웃(B₂)</Term>으로 나눠 검증합니다. 각 회차 t 의 추천은 t−1 이력만 사용합니다(<Term id="look_ahead">look-ahead</Term> 금지).
          </Fragment>,
          <Fragment key="l2">
            튠에서 최고로 뽑힌 후보는 <Term id="best_of_k">best-of-K 선택 편향</Term>을 받습니다. 홀드아웃에서 <Term id="diff_vs_uniform">균등 대비</Term> 개선이 유지되고, 세대에 걸쳐 <Term id="spearman_trend">유의한 상승 추세</Term>가 있어야만 "유의미한 변화"입니다.
          </Fragment>,
        ]}
      />
      <Section title={`활성 버전 — ${info?.label ?? strategy}`}>
        {active.isLoading && <Loading />}
        {active.data && <ActiveCard strategy={strategy} exp={active.data[strategy] ?? null} />}
      </Section>
      <Section title="새 세대 실험">
        {params.isLoading && <Loading />}
        {params.isError && <ErrorBox error={params.error} />}
        {info && (
          <NewExperimentForm
            info={info}
            defaults={{ tickets, trainEnd, seed }}
            onCreated={() => {
              void qc.invalidateQueries({ queryKey: ['experiments'] });
            }}
          />
        )}
      </Section>
      <Section title={<Term id="holdout" icon>세대별 추이 (홀드아웃 = 진짜 성과)</Term>} right={lineage.data?.trend && <VerdictBadge ok={lineage.data.trend.p >= 0.05 || lineage.data.trend.spearman_rho <= 0} text={`${lineage.data.trend.verdict} (ρ=${fmtNum(lineage.data.trend.spearman_rho, 2)}, p=${fmtP(lineage.data.trend.p)})`} />}>
        {lineage.data && lineage.data.points.length > 0 ? (
          <>
            <LineageChart points={lineage.data.points} />
            <p className="mt-1 text-xs text-neutral-500">
              {lineage.data.note}
              {lineage.data.points.length < 4 && (
                <>
                  {' '}
                  <Term id="spearman_trend">추세 검정</Term>은 세대 4개 이상부터.
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-sm text-neutral-500">완료된 실험이 없습니다. 위에서 첫 세대를 실행하세요.</p>
        )}
      </Section>
      <Section title="실험 목록">
        {list.isLoading && <Loading />}
        {list.isError && <ErrorBox error={list.error} />}
        {list.data && <DataTable columns={cols} rows={list.data} rowKey={(r) => r.experiment_id} dense initialSort={{ key: 'iteration', dir: 'desc' }} csvName={`experiments_${strategy}`} emptyText="실험 없음" />}
      </Section>
      {selected && (
        <Section title={`실험 상세 — v${selected.iteration} ${selected.experiment_id.slice(0, 8)}`} right={<button type="button" className="text-xs underline" onClick={() => setSelected(null)}>닫기</button>}>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <h4 className="mb-1 font-medium">후보 K={selected.candidates.length} (튠 B₁ {selected.tune_from}–{selected.tune_to})</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th>#</th>
                    <th>
                      <Term id="strategy_params" icon>파라미터</Term>
                    </th>
                    <th className="text-right">
                      <Term id="expected_matches" icon>평균 일치</Term>
                    </th>
                    <th className="text-right">
                      <Term id="diff_vs_uniform" icon>균등 대비</Term>
                    </th>
                    <th className="text-right">
                      <Term id="ge3" icon>≥3</Term>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.candidates.map((c) => (
                    <tr key={c.index} className={c.index === (selected.metrics_tune as { best_index?: number }).best_index ? 'font-semibold' : ''}>
                      <td>{c.index}</td>
                      <td>{fmtParams(c.params)}</td>
                      <td className="text-right tabular-nums">{fmtNum(c.mean_matches, 4)}</td>
                      <td className="text-right tabular-nums">{fmtSigned(c.diff_vs_uniform, 4)}</td>
                      <td className="text-right tabular-nums">{c.n_ge3}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 text-xs">
              <h4 className="font-medium text-sm">
                <Term id="best_of_k">best-of-K</Term> <Term id="null_distribution">영분포</Term> (정규근사)
              </h4>
              {(() => {
                const h = selected.h0_benchmark as { expected_best_diff?: number; q95?: number; observed_best_diff?: number | null; percentile_of_observed?: number | null; p_best_of_k?: number | null; note?: string };
                return h.expected_best_diff != null ? (
                  <ul className="list-disc pl-4">
                    <li>K={selected.n_candidates} 후보 중 최고의 우연 기대 diff: {fmtSigned(h.expected_best_diff, 4)} (q95 {fmtSigned(h.q95 ?? null, 4)})</li>
                    <li>관측 최고 diff: {fmtSigned(h.observed_best_diff ?? null, 4)} → 영분포 분위 {h.percentile_of_observed != null ? `${(h.percentile_of_observed * 100).toFixed(1)}%` : '—'}, p={fmtP(h.p_best_of_k ?? null)}</li>
                    <li className="text-neutral-500">{h.note}</li>
                  </ul>
                ) : (
                  <p>—</p>
                );
              })()}
              <h4 className="font-medium text-sm">
                <Term id="holdout">홀드아웃 B₂</Term> {selected.holdout_from}–{selected.holdout_to}
              </h4>
              {(() => {
                const mh = selected.metrics_holdout as { mean_matches?: number; z?: number; p?: number; n_ge3?: number; expected_ge3?: number; diff_vs_uniform?: { mean: number; ci95: number[] }; optimism?: number; verdict?: string };
                return mh.mean_matches != null ? (
                  <ul className="list-disc pl-4 tabular-nums">
                    <li>
                      <Term id="expected_matches">평균 일치</Term> {fmtNum(mh.mean_matches, 4)} (기대 0.8) · <Term id="z_score">z</Term>={fmtNum(mh.z ?? null, 2)} · <Term id="p_value">p</Term>={fmtP(mh.p ?? null)}
                    </li>
                    <li>
                      <Term id="ge3">≥3 일치</Term> {mh.n_ge3} (기대 {fmtNum(mh.expected_ge3 ?? null, 1)})
                    </li>
                    <li>
                      <Term id="diff_vs_uniform">균등 대비</Term> {fmtSigned(mh.diff_vs_uniform?.mean ?? null, 4)} <Term id="ci">CI</Term> {fmtCI(mh.diff_vs_uniform?.ci95 ?? null, 3)} · <Term id="optimism">optimism</Term> {fmtSigned(mh.optimism ?? null, 4)}
                    </li>
                    <li>{mh.verdict}</li>
                  </ul>
                ) : (
                  <p>—</p>
                );
              })()}
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
