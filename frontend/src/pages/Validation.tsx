import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type BacktestResult,
  type HomogeneityResult,
  type ReplicationBlock,
  type ReplicationResult,
  type ScoringEntry,
  type ScoringResult,
  type ValidationIn,
  type ValidationMeta,
  type ValidationMetaDetail,
} from '../api/client';
import { isActive } from '../hooks/useRun';
import { usePrefersDark } from '../hooks/usePrefersDark';
import DataTable, { type Column } from '../components/DataTable';
import PlotlyChart from '../components/PlotlyChart';
import PolicyBanner from '../components/PolicyBanner';
import VerdictBadge from '../components/VerdictBadge';
import Term from '../components/Term';
import { ComparisonTable, CumulativeCurve, PerfTable, StrategyDetail } from '../components/PerformancePanel';
import { labelOf } from '../lib/labels';
import { Empty, ErrorBox, Field, Loading, PageTitle, Section, btnCls, inputCls } from '../components/States';
import { fmtCI, fmtDate, fmtNum, fmtP, fmtPct } from '../lib/format';
import { SERIES } from '../lib/colors';
import { STATUS_LABEL } from '../lib/labels';


function useValidationResult<T>(id: string | null, kind: 'meta' | 'backtest' | 'scoring' | 'replication' | 'homogeneity', enabled = true) {
  return useQuery({
    queryKey: ['validation', 'result', id, kind],
    queryFn: () => api.validation.result<T>(id!, kind),
    enabled: !!id && enabled,
    staleTime: 5 * 60_000,
  });
}

function ScoringTable({ scoring }: { scoring: ScoringResult }) {
  type Row = ScoringEntry & { strategy: string };
  const rows: Row[] = Object.entries(scoring)
    .filter(([k, v]) => !k.startsWith('_') && typeof v === 'object')
    .map(([strategy, v]) => ({ strategy, ...(v as ScoringEntry) }));
  const cols: Column<Row>[] = [
    { key: 'strategy', label: '전략', render: (r) => labelOf(r.strategy) },
    { key: 'brier_mean', label: <Term id="brier" icon>Brier (↓ 좋음)</Term>, align: 'right', render: (r) => fmtNum(r.brier_mean, 5) },
    { key: 'brier_diff', label: <Term id="diff_vs_uniform" icon>Brier 차이 vs 균등 [CI]</Term>, align: 'right', sortValue: (r) => r.brier_diff_vs_uniform?.mean, render: (r) => (r.brier_diff_vs_uniform ? `${r.brier_diff_vs_uniform.mean.toExponential(2)} ${fmtCI(r.brier_diff_vs_uniform.ci95, 5)}` : '기준선') },
    { key: 'log_score_mean', label: <Term id="log_score" icon>log score (↑ 좋음)</Term>, align: 'right', render: (r) => fmtNum(r.log_score_mean, 3) },
    { key: 'log_diff', label: <Term id="ci" icon>log 차이 vs 균등 [CI]</Term>, align: 'right', sortValue: (r) => r.log_diff_vs_uniform?.mean, render: (r) => (r.log_diff_vs_uniform ? `${fmtNum(r.log_diff_vs_uniform.mean, 4)} ${fmtCI(r.log_diff_vs_uniform.ci95, 4)}` : '기준선') },
    { key: 'better', label: <Term id="verdict" icon>판정</Term>, sortable: false, render: (r) => (r.brier_diff_vs_uniform ? <VerdictBadge ok={!r.brier_diff_vs_uniform.better && !r.log_diff_vs_uniform?.better} okText="균등 대비 개선 없음" badText="균등 대비 개선" /> : <span className="text-xs text-neutral-500">기준선</span>) },
  ];
  const note = scoring._note;
  return (
    <>
      <DataTable columns={cols} rows={rows} rowKey={(r) => r.strategy} dense csvName="scoring" />
      {typeof note === 'string' && <p className="mt-2 text-xs text-neutral-500">{note}</p>}
    </>
  );
}

function ReplicationBlockView({ title, b }: { title: string; b: ReplicationBlock }) {
  type Row = ReplicationBlock['detail'][number];
  const cols: Column<Row>[] = [
    { key: 'key', label: '항목', sortValue: (r) => (Array.isArray(r.key) ? r.key.join('-') : r.key), render: (r) => (Array.isArray(r.key) ? r.key.join('–') : r.key) },
    { key: 'z_a', label: <Term id="z_score" icon>z (A)</Term>, align: 'right', render: (r) => fmtNum(r.z_a, 2) },
    { key: 'p_a', label: <Term id="p_value" icon>p (A)</Term>, align: 'right', render: (r) => fmtP(r.p_a) },
    { key: 'z_b', label: 'z (B)', align: 'right', render: (r) => fmtNum(r.z_b, 2) },
    { key: 'p_b', label: 'p (B)', align: 'right', render: (r) => fmtP(r.p_b) },
    { key: 'replicated', label: <Term id="replication" icon>재현</Term>, render: (r) => (r.replicated ? '예' : '아니오') },
  ];
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-300">
        군 A 후보(원시 p&lt;0.05) {b.n_candidates_a_raw}개 (<Term id="fdr_bh">BH</Term> 유의 {b.n_sig_bh_a}) → 군 B 같은 방향 p&lt;0.05 재현 {b.n_replicated_same_dir_p05}개 · <Term id="replication">재현율</Term> {fmtPct(b.replication_rate)} (H0 기대 {fmtPct(b.expected_rate_under_h0)})
      </p>
      <DataTable columns={cols} rows={b.detail} rowKey={(_r, i) => i} pageSize={10} dense initialSort={{ key: 'p_a', dir: 'asc' }} />
    </div>
  );
}

function HomogeneityChart({ h }: { h: HomogeneityResult }) {
  const dark = usePrefersDark();
  const x = Array.from({ length: 45 }, (_, i) => i + 1);
  const ta = h.counts_a.reduce((s, v) => s + v, 0);
  const tb = h.counts_b.reduce((s, v) => s + v, 0);
  const pal = dark ? SERIES.dark : SERIES.light;
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
        <VerdictBadge ok={h.p_adjusted >= 0.05} text={h.verdict} />
        <span className="text-xs text-neutral-500">
          χ²(보정)={fmtNum(h.chi2_adjusted, 2)} df={h.df} <Term id="p_value">p</Term>={fmtP(h.p_adjusted)} · <Term id="pearson_naive">naive χ²</Term>={fmtNum(h.chi2, 2)} p={fmtP(h.p_naive)}
        </span>
      </div>
      <PlotlyChart
        height={260}
        data={[
          { type: 'bar', x, y: h.counts_a.map((v) => v / ta), name: '군 A 비율', marker: { color: pal[0], line: { width: 0 } } },
          { type: 'bar', x, y: h.counts_b.map((v) => v / tb), name: '군 B 비율', marker: { color: pal[1], line: { width: 0 } } },
        ]}
        layout={{ barmode: 'group', xaxis: { title: { text: '번호' }, dtick: 5 }, yaxis: { title: { text: '출현 비율' }, tickformat: '.1%' }, showlegend: true }}
      />
    </>
  );
}

function NewValidationForm({ onCreated }: { onCreated: (v: ValidationMeta) => void }) {
  const qc = useQueryClient();
  const config = useQuery({ queryKey: ['config'], queryFn: api.config });
  const strategies = useQuery({ queryKey: ['recommend', 'strategies'], queryFn: api.recommend.strategies });
  const summary = useQuery({ queryKey: ['data', 'summary'], queryFn: api.data.summary });
  const [sel, setSel] = useState<string[] | null>(null);
  const [tpd, setTpd] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [seed, setSeed] = useState('');
  const [insert, setInsert] = useState(false);
  const chosen = sel ?? strategies.data?.map((s) => s.id) ?? [];
  const m = useMutation({
    mutationFn: (body: ValidationIn) => api.validation.create(body),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: ['validation'] });
      onCreated(v);
    },
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    m.mutate({
      strategies: chosen.length ? chosen : null,
      tickets_per_draw: tpd ? Number(tpd) : (config.data?.lotto_number_recommendation_count ?? null),
      from_draw: from ? Number(from) : null,
      to_draw: to ? Number(to) : null,
      seed: seed ? Number(seed) : null,
      insert_draws: insert,
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <div className="mb-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">전략 (다중 선택)</div>
        <div className="flex flex-wrap gap-2">
          {strategies.data?.map((s) => (
            <label key={s.id} className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-600">
              <input type="checkbox" checked={chosen.includes(s.id)} onChange={(e) => setSel(e.target.checked ? [...chosen, s.id] : chosen.filter((x) => x !== s.id))} />
              {s.label}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="회차당 티켓 수" hint={`기본 ${config.data?.lotto_number_recommendation_count ?? '—'} (.env LOTTO_NUMBER_RECOMMENDATION_COUNT)`}>
          <input className={inputCls} type="number" min={1} max={50} value={tpd} onChange={(e) => setTpd(e.target.value)} placeholder={String(config.data?.lotto_number_recommendation_count ?? '')} />
        </Field>
        <Field label="시작 회차" hint={`기본 군 B 시작 ${(summary.data?.train_end_draw ?? 0) + 1}`}>
          <input className={inputCls} type="number" min={2} value={from} onChange={(e) => setFrom(e.target.value)} placeholder={String((summary.data?.train_end_draw ?? 0) + 1)} />
        </Field>
        <Field label="종료 회차" hint={`기본 최신 ${summary.data?.max_draw ?? ''}`}>
          <input className={inputCls} type="number" value={to} onChange={(e) => setTo(e.target.value)} placeholder={String(summary.data?.max_draw ?? '')} />
        </Field>
        <Field label="seed" hint={`기본 ${config.data?.lotto_random_seed ?? ''}`}>
          <input className={inputCls} type="number" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder={String(config.data?.lotto_random_seed ?? '')} />
        </Field>
      </div>
      <label className="inline-flex items-center gap-2 text-xs">
        <input type="checkbox" checked={insert} onChange={(e) => setInsert(e.target.checked)} /> 군 B 회차를 성과 추적(<Term id="backtest">backtest</Term> origin)에 삽입
      </label>
      <div>
        <button type="submit" className={btnCls} disabled={m.isPending}>
          {m.isPending ? '요청 중…' : '새 검증 실행'}
        </button>
      </div>
      {m.isError && <ErrorBox error={m.error} />}
    </form>
  );
}

export default function Validation() {
  const runs = useQuery({
    queryKey: ['validation', 'runs'],
    queryFn: () => api.validation.runs(50),
    refetchInterval: (q) => (q.state.data?.some((r) => isActive(r.status)) ? 2000 : 30_000),
  });
  const [selId, setSelId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const list = [...(runs.data ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const current = (selId ? list.find((v) => v.validation_id === selId) : undefined) ?? list.find((v) => v.status === 'done') ?? list[0];
  const id = current?.validation_id ?? null;
  const done = current?.status === 'done';
  const meta = useValidationResult<ValidationMetaDetail>(id, 'meta', done);
  const backtest = useValidationResult<BacktestResult>(id, 'backtest', done);
  const scoring = useValidationResult<ScoringResult>(id, 'scoring', done);
  const replication = useValidationResult<ReplicationResult>(id, 'replication', done);
  const homogeneity = useValidationResult<HomogeneityResult>(id, 'homogeneity', done);

  return (
    <div className="space-y-4">
      <PageTitle
        title="검증 (A→B)"
        sub={
          <>
            <Term id="cohort">군 A</Term> 에서 찾은 신호의 군 B <Term id="replication">재현성</Term>, 전략별 <Term id="look_ahead">look-ahead</Term> 금지 <Term id="backtest">backtest</Term>, 스코어링 규칙, 군 <Term id="homogeneity">동질성</Term>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="검증 run 선택" className={`${inputCls} w-auto max-w-[32rem]`} value={id ?? ''} onChange={(e) => setSelId(e.target.value || null)}>
          {list.length === 0 && <option value="">검증 run 없음</option>}
          {list.map((v) => (
            <option key={v.validation_id} value={v.validation_id}>
              {fmtDate(v.created_at)} · {STATUS_LABEL[v.status] ?? v.status} · 회차당 {String(v.params?.tickets_per_draw ?? '—')}장 · {String(v.params?.from_draw ?? '')}회~ · seed {String(v.params?.seed ?? '')}
            </option>
          ))}
        </select>
        <button type="button" className={btnCls} onClick={() => setShowForm((s) => !s)}>
          {showForm ? '폼 닫기' : '새 검증 실행'}
        </button>
      </div>
      {showForm && (
        <Section title="새 검증 실행">
          <NewValidationForm
            onCreated={(v) => {
              setSelId(v.validation_id);
              setShowForm(false);
            }}
          />
        </Section>
      )}
      {runs.isLoading && <Loading />}
      {runs.isError && <ErrorBox error={runs.error} />}
      {!runs.isLoading && !current && <Empty>검증 run 이 없습니다. "새 검증 실행"으로 시작하세요.</Empty>}
      {current && !done && (
        <div className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-700">
          상태: {STATUS_LABEL[current.status] ?? current.status} · {current.stage ?? ''}
          <progress className="ml-2 h-2 w-48 align-middle" max={1} value={current.progress} />
          <span className="ml-1 tabular-nums">{Math.round(current.progress * 100)}%</span>
          {current.error && <ErrorBox error={current.error} />}
        </div>
      )}
      {done && (
        <>
          {meta.data && (
            <Section title="run 메타데이터">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-4">
                <dt className="text-neutral-500">군 B 회차</dt>
                <dd className="tabular-nums">
                  {meta.data.from_draw}–{meta.data.to_draw} ({meta.data.n_draws_b}회)
                </dd>
                <dt className="text-neutral-500">회차당 티켓</dt>
                <dd>{meta.data.tickets_per_draw}</dd>
                <dt className="text-neutral-500">seed</dt>
                <dd>{meta.data.seed}</dd>
                <dt className="text-neutral-500">군 A run</dt>
                <dd className="truncate font-mono text-xs" title={meta.data.run_id_a ?? ''}>
                  {meta.data.run_id_a?.slice(0, 8) ?? '—'}
                </dd>
                <dt className="text-neutral-500">전략</dt>
                <dd className="col-span-3">{meta.data.strategies.map((s) => labelOf(s)).join(', ')}</dd>
                <dt className="text-neutral-500">
                  <Term id="winners_model">당첨자수 모형</Term>
                </dt>
                <dd>{meta.data.winners_model_used ? '사용' : '미사용'}</dd>
                <dt className="text-neutral-500">추적 삽입 회차</dt>
                <dd>{meta.data.inserted_b_draws}</dd>
              </dl>
              <PolicyBanner compact lines={[meta.data.policy]} />
            </Section>
          )}
          <Section title={<Term id="backtest" icon>전략별 backtest</Term>}>
            {backtest.isLoading && <Loading />}
            {backtest.isError && <ErrorBox error={backtest.error} />}
            {backtest.data && (
              <div className="space-y-4">
                <PerfTable strategies={backtest.data.strategies} />
                <h3 className="text-sm font-semibold">누적 일치수 — 실제 vs 기대</h3>
                <CumulativeCurve strategies={backtest.data.strategies} />
                <h3 className="text-sm font-semibold">
                  <Term id="match_distribution" icon>일치수 분포</Term> vs <Term id="hypergeom">하이퍼지오메트릭</Term> 기대
                </h3>
                <StrategyDetail strategies={backtest.data.strategies} />
                <h3 className="text-sm font-semibold">
                  <Term id="uniform_control" icon>균등 기준선 대비 (대응 비교)</Term>
                </h3>
                <ComparisonTable comparison={backtest.data.comparison_vs_uniform} />
              </div>
            )}
          </Section>
          <Section title={<Term id="brier" icon>스코어링 규칙 (Brier / log)</Term>}>
            {scoring.isLoading && <Loading />}
            {scoring.isError && <ErrorBox error={scoring.error} />}
            {scoring.data && <ScoringTable scoring={scoring.data} />}
          </Section>
          <Section title={<Term id="replication" icon>재현성 (군 A 후보 → 군 B)</Term>}>
            {replication.isLoading && <Loading />}
            {replication.isError && <ErrorBox error={replication.error} />}
            {replication.data && (
              <div className="space-y-4">
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  T_A={replication.data.T_a} · T_B={replication.data.T_b} · 쌍 <Term id="calibrated_lift">Lift*</Term> 상관 r={fmtNum(replication.data.pair_lift_corr_a_b.r, 3)} (p {fmtP(replication.data.pair_lift_corr_a_b.p)}) · 번호 <Term id="z_score">z</Term> 상관 r={fmtNum(replication.data.number_z_corr_a_b.r, 3)} (p {fmtP(replication.data.number_z_corr_a_b.p)}) — 기대 0
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ReplicationBlockView title="번호" b={replication.data.numbers} />
                  <ReplicationBlockView title="번호쌍" b={replication.data.pairs} />
                </div>
                <p className="text-xs text-neutral-500">{replication.data.note}</p>
              </div>
            )}
          </Section>
          <Section title={<Term id="homogeneity" icon>군 A vs B 동질성</Term>}>
            {homogeneity.isLoading && <Loading />}
            {homogeneity.isError && <ErrorBox error={homogeneity.error} />}
            {homogeneity.data && <HomogeneityChart h={homogeneity.data} />}
          </Section>
        </>
      )}
      <PolicyBanner compact />
    </div>
  );
}
