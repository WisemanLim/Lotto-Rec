import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type BacktestResult, type RecommendIn, type RecommendResponse, type RecommendTicket } from '../api/client';
import { useRun } from '../hooks/useRun';
import { BallRow } from '../components/LottoBall';
import PolicyBanner from '../components/PolicyBanner';
import VerdictBadge from '../components/VerdictBadge';
import Term from '../components/Term';
import ScorecardView, { ScorecardCompact } from '../components/ScorecardView';
import ExperimentLoop from '../components/ExperimentLoop';
import DataTable, { type Column } from '../components/DataTable';
import { labelOf } from '../lib/labels';
import { ErrorBox, Field, FormSlot, Loading, PageTitle, Section, btnCls, inputCls } from '../components/States';
import { fmtCI, fmtDate, fmtNum, fmtP, fmtParams, fmtSigned } from '../lib/format';
import type { RecommendHistoryItem } from '../api/client';

function BacktestSummary({ strategy }: { strategy: string }) {
  const latest = useQuery({ queryKey: ['validation', 'latest'], queryFn: api.validation.latest, retry: false });
  const id = latest.data?.status === 'done' ? latest.data.validation_id : null;
  const bt = useQuery({
    queryKey: ['validation', 'result', id, 'backtest'],
    queryFn: () => api.validation.result<BacktestResult>(id!, 'backtest'),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
  if (latest.isError || (latest.data && !id)) return <p className="text-xs text-neutral-500">완료된 군 B 검증이 없어 backtest 요약을 표시할 수 없습니다.</p>;
  if (!bt.data) return <Loading text="backtest 요약 로딩…" />;
  const p = bt.data.strategies[strategy];
  const c = bt.data.comparison_vs_uniform[strategy];
  if (!p) return <p className="text-xs text-neutral-500">이 전략은 최근 검증에 포함되지 않았습니다.</p>;
  const ok = c ? c.ci95[0] <= 0 && c.ci95[1] >= 0 : true;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="font-medium">
        {labelOf(strategy, p)} 군 B <Term id="backtest">backtest</Term>
      </span>
      <span className="tabular-nums">
        <Term id="expected_matches">평균 일치</Term> {fmtNum(p.mean_matches, 4)} <span className="text-neutral-500">(기대 0.8)</span> · <Term id="z_score">z</Term>={fmtNum(p.z, 2)} · <Term id="p_value">p</Term>={fmtP(p.p)}
      </span>
      <span className="tabular-nums">
        <Term id="ge3">≥3 일치</Term> {p.n_ge3} <span className="text-neutral-500">(기대 {fmtNum(p.expected_ge3, 1)})</span> · <Term id="roi">ROI</Term> {(p.roi * 100).toFixed(1)}%
      </span>
      {c ? (
        <span className="tabular-nums">
          <Term id="diff_vs_uniform">균등 대비</Term> {fmtSigned(c.mean_diff, 4)} <Term id="ci">CI</Term> {fmtCI(c.ci95, 3)} <VerdictBadge ok={ok} text={c.verdict} />
        </span>
      ) : (
        <VerdictBadge ok text="기준선 (control)" />
      )}
    </div>
  );
}

/** 추천 티켓 → 내 번호 등록 (S4.7). POST /user/tickets 재사용, label = 추천 <전략> #rec_id. */
export function RegisterMyNumber({
  numbers,
  strategy,
  recId,
  targetDrawNo,
  size = 'sm',
}: {
  numbers: number[];
  strategy: string;
  recId: number | string | null | undefined;
  targetDrawNo: number | null | undefined;
  size?: 'sm' | 'xs';
}) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () =>
      api.user.save({
        numbers,
        label: `추천 ${labelOf(strategy)}${recId != null ? ` #${recId}` : ''}`,
        target_draw_no: targetDrawNo ?? null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user'] });
      void qc.invalidateQueries({ queryKey: ['tracking'] });
    },
  });
  const cls = size === 'xs' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs';
  if (m.isSuccess)
    return (
      <span className={`inline-flex items-center gap-1 ${cls} text-emerald-700 dark:text-emerald-300`}>
        내 번호 #{m.data.ticket_id} 등록됨 ·{' '}
        <Link to="/my-numbers" className="underline">
          보기
        </Link>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        className={`rounded border border-blue-600 ${cls} text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950`}
        disabled={m.isPending}
        onClick={() => {
          if (window.confirm(`[${numbers.join(', ')}] 를 내 번호로 등록할까요?\n대상 회차 ${targetDrawNo ?? '다음 회차'} · 성과 추적 대상이 됩니다.`)) m.mutate();
        }}
        aria-label={`내 번호로 등록 ${numbers.join(' ')}`}
      >
        {m.isPending ? '등록 중…' : '내 번호로 등록'}
      </button>
      {m.isError && <span className="text-[11px] text-red-600">{(m.error as Error).message}</span>}
    </span>
  );
}

function TicketCard({ t, alpha, strategy, targetDrawNo }: { t: RecommendTicket; alpha: number; strategy: string; targetDrawNo: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900 ${open ? 'md:col-span-2 xl:col-span-3' : ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <BallRow numbers={t.ticket} />
        <span className="flex items-center gap-2">
          <RegisterMyNumber numbers={t.ticket} strategy={strategy} recId={t.rec_id} targetDrawNo={targetDrawNo} />
          {t.rec_id != null && <span className="text-[11px] text-neutral-400">#{t.rec_id}</span>}
        </span>
      </div>
      <ScorecardCompact sc={t.scorecard} />
      <div className="mt-2">
        <button type="button" className="text-xs text-blue-700 underline dark:text-blue-300" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? '접기' : '전체 스코어카드 보기'}
        </button>
        {open && (
          <div className="mt-2">
            <ScorecardView sc={t.scorecard} alpha={alpha} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Recommend() {
  const qc = useQueryClient();
  const { run } = useRun();
  const config = useQuery({ queryKey: ['config'], queryFn: api.config });
  const [tab, setTab] = useState<'generate' | 'loop'>('generate');
  const strategies = useQuery({ queryKey: ['recommend', 'strategies'], queryFn: api.recommend.strategies });
  // 추천 이력 필터 (S4.6) — 전략·대상 회차·batch, 표시 개수(전체 = 10000)
  const [hStrategy, setHStrategy] = useState('');
  const [hTarget, setHTarget] = useState('');
  const [hBatch, setHBatch] = useState('');
  const [hLimit, setHLimit] = useState<number>(20);
  const [hOrigin, setHOrigin] = useState<'user' | 'backtest' | 'all'>('user');
  const hFilter = {
    origin: hOrigin,
    strategy: hStrategy || undefined,
    target_draw_no: hTarget ? Number(hTarget) : undefined,
    batch_id: hBatch || undefined,
  };
  const history = useQuery({
    queryKey: ['recommend', 'history', hFilter, hLimit],
    queryFn: () => api.recommend.history({ ...hFilter, limit: hLimit }),
  });
  const historySummary = useQuery({
    queryKey: ['recommend', 'history-summary', hFilter],
    queryFn: () => api.recommend.historySummary(hFilter),
  });
  const [strategy, setStrategy] = useState('hybrid');
  const [count, setCount] = useState('');
  const [seed, setSeed] = useState('');
  const [maxShared, setMaxShared] = useState('');
  const [includeControl, setIncludeControl] = useState(true);
  const [save, setSave] = useState(true);
  useEffect(() => {
    if (config.data && count === '') setCount(String(config.data.lotto_number_recommendation_count));
  }, [config.data, count]);
  const m = useMutation({
    mutationFn: (b: RecommendIn) => api.recommend.create(b),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recommend', 'history'] });
      void qc.invalidateQueries({ queryKey: ['tracking'] });
    },
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    m.mutate({
      strategy,
      count: count ? Number(count) : null,
      seed: seed ? Number(seed) : null,
      max_shared: maxShared ? Number(maxShared) : null,
      include_control: includeControl,
      save,
    });
  };
  const res: RecommendResponse | undefined = m.data;
  const alpha = run?.alpha ?? 0.05;

  const histCols: Column<RecommendHistoryItem>[] = [
    { key: 'rec_id', label: '#', align: 'right' },
    { key: 'created_at', label: '생성', render: (r) => fmtDate(r.created_at) },
    { key: 'strategy', label: '전략', render: (r) => labelOf(r.strategy) },
    {
      key: 'origin',
      label: '출처',
      render: (r) => (
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${r.origin === 'backtest' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
          {r.origin === 'backtest' ? '검증 replay' : '사용자'}
        </span>
      ),
    },
    { key: 'ticket', label: '티켓', sortable: false, render: (r) => <BallRow numbers={r.ticket} size="sm" /> },
    { key: 'target_draw_no', label: '대상 회차', align: 'right' },
    { key: 'seed', label: 'seed', align: 'right' },
    { key: 'batch_id', label: 'batch', render: (r) => <span className="font-mono text-xs">{r.batch_id.slice(0, 8)}</span> },
    {
      key: 'register',
      label: '내 번호',
      sortable: false,
      render: (r) => <RegisterMyNumber numbers={r.ticket} strategy={r.strategy} recId={r.rec_id} targetDrawNo={r.target_draw_no} size="xs" />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        title="추천"
        sub={
          <>
            <Term id="weighted_sampling">가중 비복원 표본추출</Term>로 티켓 생성 — <Term id="uniform_control">균등 기준선(control)</Term>과 동시 생성, 저장 즉시 성과 추적 대상
          </>
        }
      />
      <PolicyBanner compact lines={res?.policy ? [res.policy] : ['추천번호는 균등 무작위와 동일한 당첨확률을 가지며, 차이는 군 B 검증·성과 추적 리포트로 확인한다.']} />
      <div role="tablist" aria-label="추천 탭" className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700">
        {(
          [
            ['generate', '추천 생성'],
            ['loop', '전략 개선 루프 (시뮬레이션)'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px rounded-t px-3 py-2 text-sm ${tab === id ? 'border border-b-white border-neutral-200 bg-white font-semibold dark:border-neutral-700 dark:border-b-neutral-900 dark:bg-neutral-900' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'loop' && (
        <ExperimentLoop
          strategy={strategy}
          tickets={config.data?.lotto_number_recommendation_count ?? 10}
          trainEnd={config.data?.lotto_train_end_draw ?? 1000}
          seed={config.data?.lotto_random_seed ?? 0}
        />
      )}
      {tab === 'loop' && (
        <Section title="전략 선택 (실험 대상)">
          <div className="flex flex-wrap gap-2">
            {strategies.data?.map((s) => (
              <button key={s.id} type="button" aria-pressed={strategy === s.id} onClick={() => setStrategy(s.id)} className={`rounded border px-2 py-1 text-xs ${strategy === s.id ? 'border-blue-600 bg-blue-50 dark:bg-blue-950' : 'border-neutral-300 dark:border-neutral-600'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </Section>
      )}
      <div hidden={tab !== 'generate'} className="space-y-4">
      <Section title="전략 선택">
        {strategies.isLoading && <Loading />}
        {strategies.isError && <ErrorBox error={strategies.error} />}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {strategies.data?.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStrategy(s.id)}
              aria-pressed={strategy === s.id}
              className={`rounded-lg border p-3 text-left text-sm ${strategy === s.id ? 'border-blue-600 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800'}`}
            >
              <div className="font-semibold">{s.label}</div>
              <div className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">{s.basis}</div>
              <div className="mt-1 text-xs text-neutral-500">기대: {s.expectation}</div>
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-4 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="추천 개수" hint={`기본 ${config.data?.lotto_number_recommendation_count ?? '—'} (.env)`}>
            <input className={inputCls} type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field label="seed" hint={`빈칸 = 기본 ${config.data?.lotto_random_seed ?? ''}`}>
            <input className={inputCls} type="number" value={seed} onChange={(e) => setSeed(e.target.value)} />
          </Field>
          <Field label="티켓 간 최대 공유 번호" hint="0–6, 빈칸 = 제한 없음">
            <input className={inputCls} type="number" min={0} max={6} value={maxShared} onChange={(e) => setMaxShared(e.target.value)} />
          </Field>
          <FormSlot>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeControl} onChange={(e) => setIncludeControl(e.target.checked)} /> <Term id="uniform_control">균등 기준선</Term> 동시 생성
            </label>
          </FormSlot>
          <FormSlot>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> 저장 (성과 추적)
            </label>
          </FormSlot>
          <FormSlot>
            <button type="submit" className={btnCls} disabled={m.isPending}>
              {m.isPending ? '생성 중…' : '추천 생성'}
            </button>
          </FormSlot>
        </form>
        {m.isError && <ErrorBox error={m.error} />}
      </Section>

      <Section title={<Term id="backtest" icon>선택 전략의 군 B backtest 요약</Term>}>
        <BacktestSummary strategy={strategy} />
      </Section>

      {res && (
        <Section
          title={`추천 결과 — 대상 ${res.target_draw_no}회`}
          right={
            <span className="text-xs text-neutral-500">
              batch {res.batch_id.slice(0, 8)} · seed {res.seed} · 이력 T={res.history_T} · run {res.run_id?.slice(0, 8) ?? '—'}
            </span>
          }
        >
          <div className="space-y-5">
            {res.sets.map((set) => (
              <div key={set.strategy}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{set.label}</h3>
                  {set.is_control && <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[11px] dark:bg-neutral-700">control</span>}
                  <span className="text-xs text-neutral-500">
                    {set.basis} · 기대: {set.expectation} · {set.tickets.length}장
                  </span>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs" data-testid="set-basis">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
                    <Term id="strategy_params">파라미터</Term>: {fmtParams(set.params_used)}
                  </span>
                  {set.experiment ? (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                      활성 실험 v{set.experiment.iteration} · <Term id="holdout">홀드아웃</Term> 균등 대비 {fmtSigned(set.experiment.holdout?.mean ?? null, 4)} · {set.experiment.verdict ?? ''}
                    </span>
                  ) : (
                    <span className="text-neutral-500">활성 실험 없음(기본 파라미터) — "전략 개선 루프" 탭에서 실험·활성화</span>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {set.tickets.map((t, i) => (
                    <TicketCard key={t.rec_id ?? i} t={t} alpha={alpha} strategy={set.strategy} targetDrawNo={res.target_draw_no} />
                  ))}
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-700" data-testid="analysis-basis">
              <div className="mb-1 font-semibold text-sm">분석 근거 (군 A → 추천)</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>군 A run: <span className="font-mono">{res.analysis_basis.run_id_a?.slice(0, 8) ?? '없음'}</span></span>
                <span>이력 T={res.analysis_basis.history_T} (군 A 경계 {res.analysis_basis.train_end_draw})</span>
                <span>
                  <Term id="winners_model">당첨자수 모형</Term> {res.analysis_basis.winners_model_used ? '사용' : '미사용'}
                </span>
              </div>
              <div className="mt-1">
                상위 |<Term id="z_score">z</Term>| 번호:{' '}
                {res.analysis_basis.top_abs_z_numbers.map((n) => (
                  <span key={n.number} className="mr-2 tabular-nums">
                    {n.number}({fmtSigned(n.z, 2)})
                  </span>
                ))}
              </div>
              <div className="mt-1">
                상위 <Term id="calibrated_lift">Lift*</Term> 쌍:{' '}
                {res.analysis_basis.top_lift_pairs.map((p) => (
                  <span key={`${p.a}-${p.b}`} className="mr-2 tabular-nums">
                    {p.a}–{p.b}({fmtNum(p.lift, 2)})
                  </span>
                ))}
              </div>
              <p className="mt-1 text-neutral-500">{res.analysis_basis.cohort_note}</p>
            </div>
            <PolicyBanner compact lines={[res.policy]} />
          </div>
        </Section>
      )}

      <Section
        title="추천 이력 (저장된 티켓)"
        right={
          historySummary.data && (
            <span className="text-xs text-neutral-500 tabular-nums">
              필터 {historySummary.data.total_filtered.toLocaleString()} / {hOrigin === 'user' ? '사용자 생성' : hOrigin === 'backtest' ? '검증 replay' : '전체'}{' '}
              {historySummary.data.total_all.toLocaleString()}장
              {historySummary.data.by_origin?.backtest != null && hOrigin === 'user' && ` · 검증 replay ${historySummary.data.by_origin.backtest.toLocaleString()}장 별도`}
            </span>
          )
        }
      >
        <div className="mb-3 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-6" role="group" aria-label="추천 이력 필터">
          <Field label="출처" hint="검증 replay 티켓은 시뮬레이션">
            <select className={inputCls} value={hOrigin} onChange={(e) => setHOrigin(e.target.value as 'user' | 'backtest' | 'all')} aria-label="출처 필터">
              <option value="user">사용자 생성{historySummary.data?.by_origin?.user != null ? ` (${historySummary.data.by_origin.user})` : ''}</option>
              <option value="backtest">검증 replay{historySummary.data?.by_origin?.backtest != null ? ` (${historySummary.data.by_origin.backtest})` : ''}</option>
              <option value="all">전체</option>
            </select>
          </Field>
          <Field label="전략">
            <select className={inputCls} value={hStrategy} onChange={(e) => setHStrategy(e.target.value)} aria-label="전략 필터">
              <option value="">전체</option>
              {strategies.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {historySummary.data?.by_strategy[s.id] != null ? ` (${historySummary.data.by_strategy[s.id]})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="대상 회차">
            <select className={inputCls} value={hTarget} onChange={(e) => setHTarget(e.target.value)} aria-label="대상 회차 필터">
              <option value="">전체</option>
              {historySummary.data?.target_draws.map((d) => (
                <option key={d} value={d}>
                  {d}회
                </option>
              ))}
            </select>
          </Field>
          <Field label="batch">
            <select className={inputCls} value={hBatch} onChange={(e) => setHBatch(e.target.value)} aria-label="batch 필터">
              <option value="">전체</option>
              {historySummary.data?.batches.map((b) => (
                <option key={b.batch_id} value={b.batch_id}>
                  {b.batch_id.slice(0, 8)} · {b.target_draw_no}회 · {b.count}장 · {fmtDate(b.created_at)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="표시 개수">
            <select className={inputCls} value={hLimit} onChange={(e) => setHLimit(Number(e.target.value))} aria-label="표시 개수">
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={50000}>전체</option>
            </select>
          </Field>
          <FormSlot>
            <button
              type="button"
              className={`${btnCls} bg-neutral-600 hover:bg-neutral-700`}
              onClick={() => {
                setHStrategy('');
                setHTarget('');
                setHBatch('');
                setHLimit(20);
                setHOrigin('user');
              }}
            >
              필터 초기화
            </button>
          </FormSlot>
        </div>
        {history.isLoading && <Loading />}
        {history.isError && <ErrorBox error={history.error} />}
        {history.data && (
          <DataTable
            columns={histCols}
            rows={history.data}
            rowKey={(r) => r.rec_id}
            dense
            pageSize={200}
            initialSort={{ key: 'rec_id', dir: 'desc' }}
            csvName="recommend_history"
            emptyText="조건에 맞는 저장된 티켓이 없습니다."
          />
        )}
        {history.data && historySummary.data && history.data.length < historySummary.data.total_filtered && (
          <p className="mt-1 text-xs text-neutral-500">
            {history.data.length.toLocaleString()}장 표시 중 (필터 결과 {historySummary.data.total_filtered.toLocaleString()}장) — 표시 개수를 &quot;전체&quot;로 바꾸면 모두 볼 수 있습니다.
          </p>
        )}
      </Section>
      </div>
    </div>
  );
}
