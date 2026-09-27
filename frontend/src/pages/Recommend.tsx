import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type BacktestResult, type RecommendIn, type RecommendResponse, type RecommendTicket, type SequentialIn } from '../api/client';
import { useRun } from '../hooks/useRun';
import LottoBall, { BallRow } from '../components/LottoBall';
import PolicyBanner from '../components/PolicyBanner';
import VerdictBadge from '../components/VerdictBadge';
import Term from '../components/Term';
import ScorecardView, { ScorecardCompact } from '../components/ScorecardView';
import ExperimentLoop from '../components/ExperimentLoop';
import DataTable, { type Column } from '../components/DataTable';
import { labelOf } from '../lib/labels';
import { ErrorBox, Field, FormSlot, Loading, PageTitle, Section, btnCls, inputCls } from '../components/States';
import { fmtCI, fmtDate, fmtNum, fmtP, fmtParams, fmtSigned } from '../lib/format';
import type { AutoRegisterResult, RecommendHistoryItem } from '../api/client';

// S4.13 SEED 값 생성 — 희망 등수 선택지·표시 라벨 (rank_of 와 동일 기준: 1등 6개 … 5등 3개)
const NUMS = Array.from({ length: 45 }, (_, i) => i + 1);
const RANK_OPTIONS = [
  { v: '1', label: '1등 (6개 일치)' },
  { v: '2', label: '2등 (5개+보너스)' },
  { v: '3', label: '3등 (5개 일치)' },
  { v: '4', label: '4등 (4개 일치)' },
  { v: '5', label: '5등 (3개 일치)' },
];
const rankLabel = (rank: number) => RANK_OPTIONS.find((r) => r.v === String(rank))?.label ?? `${rank}등`;

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
  confirm = true,
}: {
  numbers: number[];
  strategy: string;
  recId: number | string | null | undefined;
  targetDrawNo: number | null | undefined;
  size?: 'sm' | 'xs';
  /** false 면 확인 대화상자 없이 즉시 등록 (추천 이력 행, S4.7 v1.7). */
  confirm?: boolean;
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
        {m.data.duplicate ? (
          <>
            <span className="text-amber-700 dark:text-amber-300">★ 중복</span> — 내 번호 #{m.data.ticket_id}
            {(m.data.dup_count ?? 1) > 1 ? ` 에 병합(×${m.data.dup_count})` : ' (다른 회차에 동일 번호 있음)'}
          </>
        ) : (
          <>내 번호 #{m.data.ticket_id} 등록됨</>
        )}{' '}
        ·{' '}
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
          if (!confirm || window.confirm(`[${numbers.join(', ')}] 를 내 번호로 등록할까요?\n대상 회차 ${targetDrawNo ?? '다음 회차'} · 성과 추적 대상이 됩니다.`)) m.mutate();
        }}
        aria-label={`내 번호로 등록 ${numbers.join(' ')}`}
      >
        {m.isPending ? '등록 중…' : '내 번호로 등록'}
      </button>
      {m.isError && <span className="text-[11px] text-red-600">{(m.error as Error).message}</span>}
    </span>
  );
}

/** S4.10 자동 등록 결과 요약. */
function AutoRegisterSummary({ r }: { r: AutoRegisterResult }) {
  return (
    <div className="mb-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs dark:border-emerald-800 dark:bg-emerald-950/40" role="status" aria-label="자동 등록 결과">
      <div className="mb-1 font-medium text-emerald-800 dark:text-emerald-200">
        내 번호로 자동 등록 — 대상 {r.target_draw_no}회 · {r.rounds.toLocaleString()}회 반복(1..{r.pool} 중 {r.pick}개) · seed {r.seed} · 선택 위치{' '}
        <span className="font-semibold tabular-nums">{r.selected.join(', ')}</span> · 등록 {r.total_registered}장 / ★ 중복 병합 {r.total_merged}장
        {r.exclude_numbers.length > 0 && <> · 제외 번호 [{r.exclude_numbers.join(', ')}]</>} ·{' '}
        <Link to="/my-numbers" className="underline">
          내 번호 보기
        </Link>
      </div>
      <ul className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
        {r.strategies.map((s) => (
          <li key={s.strategy} className="text-neutral-700 dark:text-neutral-300">
            <span className="font-medium">{s.label}</span> ({s.batch_id.slice(0, 8)} · {s.n_tickets}장): 등록 {s.registered.length}
            {s.merged_duplicates.length > 0 && ` · ★ 중복 병합 ${s.merged_duplicates.length}`}
            {s.missing_positions.length > 0 && ` · 없는 위치 ${s.missing_positions.join(',')}`}
            {s.excluded_positions.length > 0 && ` · 제외됨 ${s.excluded_positions.length}(#${s.excluded_positions.map((t) => t.position).join(',#')})`}
            {s.registered.length > 0 && (
              <span className="ml-1 text-neutral-500">{s.registered.map((t) => `#${t.position}[${t.ticket.join(' ')}]`).join(' ')}</span>
            )}
          </li>
        ))}
        {r.strategies.length === 0 && <li className="text-neutral-500">대상 회차의 사용자 생성 추천 이력이 없습니다. 먼저 추천을 생성(저장)하세요.</li>}
      </ul>
      <p className="mt-1 text-neutral-500">{r.policy}</p>
    </div>
  );
}

function TicketCard({ t, alpha, strategy, targetDrawNo }: { t: RecommendTicket; alpha: number; strategy: string; targetDrawNo: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900 ${open ? 'md:col-span-2 xl:col-span-3' : ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <BallRow numbers={t.ticket} pastWins={t.past_wins} />
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

function RecommendResultSection({ res, alpha, titlePrefix = '추천 결과' }: { res: RecommendResponse; alpha: number; titlePrefix?: string }) {
  return (
    <Section
      title={`${titlePrefix} — 대상 ${res.target_draw_no}회`}
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
  );
}

// v1.19: 해당 회차에 저장된 사용자 생성 추천 장수 (초기화·자동 등록 버튼 활성 판단)
function useUpcomingCount(d: number | null) {
  return useQuery({
    queryKey: ['recommend', 'history-summary', 'upcoming', d],
    queryFn: () => api.recommend.historySummary({ origin: 'user', target_draw_no: d as number }),
    enabled: d !== null,
    select: (x) => x.total_filtered,
  });
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
  // v1.19 방어: 초기화·자동 등록은 결과가 입력되지 않은 진행 예정 회차에서만 (최신 결과 회차 + 1 이상, 저장된 사용자 추천이 있을 때)
  const dataSummary = useQuery({ queryKey: ['data', 'summary'], queryFn: api.data.summary });
  const latestResult = typeof dataSummary.data?.max_draw === 'number' ? dataSummary.data.max_draw : null;
  const nextDraw = latestResult === null ? null : latestResult + 1;
  const autoDraw = hTarget ? Number(hTarget) : nextDraw; // 자동 등록 대상 회차
  const nextCount = useUpcomingCount(nextDraw);
  const autoCount = useUpcomingCount(autoDraw);
  const resetBlock =
    nextDraw === null ? '회차 정보를 불러오는 중입니다' : nextCount.data === 0 ? `진행 예정 ${nextDraw}회에 저장된 추천이 없습니다` : null;
  const autoBlock =
    autoDraw === null || latestResult === null
      ? '회차 정보를 불러오는 중입니다'
      : autoDraw <= latestResult
        ? `${autoDraw}회는 결과가 입력된 회차입니다 — 진행 예정 회차에서만 자동 등록할 수 있습니다`
        : autoCount.data === 0
          ? `${autoDraw}회에 저장된 추천이 없습니다`
          : null;
  // S4.10 내 번호로 자동 등록 — 1..P 중 5개 무작위 추출을 대상 회차 수만큼 반복 → 빈도 상위 5 위치 → 전략별 최신 batch 티켓 등록
  // v1.28 제외 번호 — 선택된 번호가 포함된 (전략, 위치) 조합은 등록하지 않는다(화면 상태만, 저장 없음)
  const [excludeNumbers, setExcludeNumbers] = useState<number[]>([]);
  const toggleExclude = (n: number) => setExcludeNumbers((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)));
  const autoReg = useMutation({
    mutationFn: () =>
      api.recommend.autoRegister({
        target_draw_no: hTarget ? Number(hTarget) : undefined,
        exclude_numbers: excludeNumbers.length ? excludeNumbers : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user'] });
      void qc.invalidateQueries({ queryKey: ['tracking'] });
    },
  });
  // S4.12 추천 초기화 — 현재 회차(최신 회차 + 1)의 사용자 생성 추천 삭제
  const resetRec = useMutation({
    mutationFn: () => api.recommend.reset(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recommend'] });
      void qc.invalidateQueries({ queryKey: ['user'] });
      void qc.invalidateQueries({ queryKey: ['tracking'] });
    },
  });
  const [strategy, setStrategy] = useState('hybrid');
  const [count, setCount] = useState('');
  const [seed, setSeed] = useState('');
  const [maxShared, setMaxShared] = useState('');
  const [includeControl, setIncludeControl] = useState(true);
  const [save, setSave] = useState(true);
  // S4.13 SEED 값 생성 — 대상 회차 직전 실제 회차 1등 번호 기준 무작위 탐색(백그라운드 폴링), 중지 가능
  const [targetRank, setTargetRank] = useState('1');
  const [seedJobId, setSeedJobId] = useState<string | null>(null);
  const seedJob = useQuery({
    queryKey: ['recommend', 'seed-search', seedJobId],
    queryFn: () => api.recommend.seedSearchStatus(seedJobId as string),
    enabled: seedJobId !== null,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== 'running' ? false : 400),
  });
  // S4.13 v1.26 — 'seed 신규' 체크박스(기본 해제): 체크했을 때만 '추천 생성'/'추천 생성(순차)' 클릭이
  // SEED 탐색을 (재)시작해 완료를 기다린다. 해제 상태(기본)면 탐색을 강제하지 않고 현재 seed 값으로 즉시 생성한다
  // (v1.24 의 "매번 무조건 새 SEED 탐색" 문제 방지). 대기 중 'SEED 생성 중지'를 누르면 예약을 취소하지 않고
  // 현재 seed 입력값(탐색 시작 전 값)으로 생성한다 — 오류로 끝난 경우만 안전하게 취소.
  const [seedNew, setSeedNew] = useState(false);
  const [pendingAction, setPendingAction] = useState<'single' | 'sequential' | null>(null);
  useEffect(() => {
    if (!seedJob.data) return;
    if (seedJob.data.status === 'done' && seedJob.data.seed != null) {
      setSeed(String(seedJob.data.seed));
      if (pendingAction === 'single') {
        m.mutate({
          strategy,
          count: count ? Number(count) : null,
          seed: seedJob.data.seed,
          max_shared: maxShared ? Number(maxShared) : null,
          include_control: includeControl,
          save,
          exclude_numbers: excludeNumbers.length ? excludeNumbers : undefined,
        });
      } else if (pendingAction === 'sequential') {
        seq.mutate({ count: count ? Number(count) : null, seed: seedJob.data.seed, max_shared: maxShared ? Number(maxShared) : null, save, exclude_numbers: excludeNumbers.length ? excludeNumbers : undefined });
      }
      setPendingAction(null);
    } else if (seedJob.data.status === 'stopped') {
      // 중지(사용자 또는 상한 도달) 시 예약된 생성을 취소하지 않고 기존 seed 입력값으로 진행한다 (v1.26)
      if (pendingAction === 'single') {
        m.mutate({
          strategy,
          count: count ? Number(count) : null,
          seed: seed ? Number(seed) : null,
          max_shared: maxShared ? Number(maxShared) : null,
          include_control: includeControl,
          save,
          exclude_numbers: excludeNumbers.length ? excludeNumbers : undefined,
        });
      } else if (pendingAction === 'sequential') {
        seq.mutate({ count: count ? Number(count) : null, seed: seed ? Number(seed) : null, max_shared: maxShared ? Number(maxShared) : null, save, exclude_numbers: excludeNumbers.length ? excludeNumbers : undefined });
      }
      setPendingAction(null);
    } else if (seedJob.data.status === 'error') {
      setPendingAction(null); // 탐색 자체가 실패한 경우는 안전하게 예약 취소(생성하지 않음)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedJob.data?.status, seedJob.data?.seed]);
  const seedSearchStart = useMutation({
    mutationFn: () => api.recommend.seedSearchStart({ target_rank: Number(targetRank) }),
    onSuccess: (job) => setSeedJobId(job.job_id),
  });
  const seedSearchStop = useMutation({ mutationFn: () => api.recommend.seedSearchStop(seedJobId as string) });
  const seedRunning = seedJob.data?.status === 'running';
  const seedDone = seedJob.data?.status === 'done';
  useEffect(() => {
    if (config.data && count === '') setCount(String(config.data.lotto_number_recommendation_count));
  }, [config.data, count]);
  const invalidateAfterRecommend = () => {
    void qc.invalidateQueries({ queryKey: ['recommend', 'history'] });
    void qc.invalidateQueries({ queryKey: ['tracking'] });
    void qc.invalidateQueries({ queryKey: ['user'] }); // S5.7: 다음 회차 추천 저장 → 내 번호 현재 대상 회차 전환
  };
  const m = useMutation({
    mutationFn: (b: RecommendIn) => api.recommend.create(b),
    onSuccess: invalidateAfterRecommend,
  });
  // S4.11 추천 생성(순차) — 전략 선택의 모든 전략을 순서대로 같은 옵션으로 생성 (전략별 batch, control 미포함)
  const seq = useMutation({
    mutationFn: (b: SequentialIn) => api.recommend.sequential(b),
    onSuccess: invalidateAfterRecommend,
  });
  // SEED 탐색이 이미 완료돼 있으면 그 값으로 바로 생성(체크박스 무관). 그렇지 않을 때 'seed 신규'가
  // 체크돼 있어야만 탐색을 (재)시작하고 완료되는 즉시 자동으로 이어서 생성하도록 예약한다. 해제(기본)면
  // 탐색을 강제하지 않고 이 함수가 false 를 반환해 호출자가 현재 seed 값으로 바로 생성한다 (v1.26).
  const startSeedSearchIfNeeded = (action: 'single' | 'sequential') => {
    if (seedDone || !seedNew) return false;
    setPendingAction(action);
    if (!seedRunning) seedSearchStart.mutate();
    return true;
  };
  const runSequential = () => {
    m.reset();
    if (startSeedSearchIfNeeded('sequential')) return;
    seq.mutate({
      count: count ? Number(count) : null,
      seed: seed ? Number(seed) : null,
      max_shared: maxShared ? Number(maxShared) : null,
      save,
      exclude_numbers: excludeNumbers.length ? excludeNumbers : undefined,
    });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    seq.reset();
    if (startSeedSearchIfNeeded('single')) return;
    m.mutate({
      strategy,
      count: count ? Number(count) : null,
      seed: seed ? Number(seed) : null,
      max_shared: maxShared ? Number(maxShared) : null,
      include_control: includeControl,
      save,
      exclude_numbers: excludeNumbers.length ? excludeNumbers : undefined,
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
    { key: 'ticket', label: '티켓', sortable: false, render: (r) => <BallRow numbers={r.ticket} size="sm" pastWins={r.past_wins} /> },
    { key: 'target_draw_no', label: '대상 회차', align: 'right' },
    { key: 'seed', label: 'seed', align: 'right' },
    { key: 'batch_id', label: 'batch', render: (r) => <span className="font-mono text-xs">{r.batch_id.slice(0, 8)}</span> },
    {
      key: 'register',
      label: '내 번호',
      sortable: false,
      render: (r) => <RegisterMyNumber numbers={r.ticket} strategy={r.strategy} recId={r.rec_id} targetDrawNo={r.target_draw_no} size="xs" confirm={false} />,
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
          {/* v1.29(S4.14) 제외 번호 — 마지막 전략 카드 우측 빈 공간에 배치, '추천 생성'·'추천 생성(순차)'·'내 번호로 자동 등록' 공통 적용 */}
          <div className="lg:col-span-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                제외 번호 <span className="font-normal text-neutral-500">('추천 생성'·'추천 생성(순차)'·'내 번호로 자동 등록' 시 이 번호가 포함된 조합은 생성·등록하지 않습니다)</span>
              </span>
              {excludeNumbers.length > 0 && (
                <span className="text-xs text-neutral-600 dark:text-neutral-300">
                  선택 {excludeNumbers.length}개: {excludeNumbers.join(', ')}
                  <button type="button" className="ml-2 underline" onClick={() => setExcludeNumbers([])}>
                    지우기
                  </button>
                </span>
              )}
            </div>
            <div className="grid grid-cols-9 gap-1.5 sm:grid-cols-15" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(2rem, 1fr))' }} role="group" aria-label="제외 번호 선택">
              {NUMS.map((n) => (
                <LottoBall key={n} n={n} size="sm" onClick={() => toggleExclude(n)} selected={excludeNumbers.includes(n)} />
              ))}
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-start gap-x-2 gap-y-3">
          <Field className="shrink-0" label="추천 개수" hint={`기본 ${config.data?.lotto_number_recommendation_count ?? '—'} (.env)`}>
            <input className={`${inputCls} !w-16`} type="number" min={1} max={200} value={count} onChange={(e) => setCount(e.target.value)} />
          </Field>
          <Field className="shrink-0" label="seed" hint={`빈칸 = 기본 ${config.data?.lotto_random_seed ?? ''}`}>
            <input className={`${inputCls} !w-28`} type="number" value={seed} onChange={(e) => setSeed(e.target.value)} />
          </Field>
          <Field className="shrink-0" label="희망 등수" hint="SEED 값 생성의 목표">
            <select aria-label="희망 등수" className={`${inputCls} !w-40`} value={targetRank} onChange={(e) => setTargetRank(e.target.value)}>
              {RANK_OPTIONS.map((r) => (
                <option key={r.v} value={r.v}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <FormSlot className="shrink-0">
            <button
              type="button"
              className={`${btnCls} shrink-0 whitespace-nowrap !px-2 ${seedRunning ? 'bg-red-700 hover:bg-red-800' : 'bg-indigo-700 hover:bg-indigo-800'}`}
              disabled={seedSearchStart.isPending || seedSearchStop.isPending}
              title="대상 회차 직전 실제 회차의 1등 번호(보너스 제외)를 기준으로, 전략·번호를 무작위 반복 생성해 희망 등수와 같아지는 시행 횟수를 seed 로 채웁니다"
              onClick={() => (seedRunning ? seedSearchStop.mutate() : seedSearchStart.mutate())}
            >
              {seedRunning ? 'SEED 생성 중지' : 'SEED 값 생성'}
            </button>
            <label className="ml-2 inline-flex items-center gap-1.5 whitespace-nowrap text-sm" title="체크 시 '추천 생성'·'추천 생성(순차)' 클릭이 SEED 탐색을 자동으로 시작·대기했다가 그 seed 로 생성합니다. 해제(기본)하면 탐색을 강제하지 않고 현재 seed 값으로 바로 생성합니다.">
              <input type="checkbox" checked={seedNew} onChange={(e) => setSeedNew(e.target.checked)} /> seed 신규
            </label>
          </FormSlot>
          <Field className="shrink-0" label="티켓 간 최대 공유 번호" hint="0–6, 빈칸 = 제한 없음">
            <input className={`${inputCls} !w-16`} type="number" min={0} max={6} value={maxShared} onChange={(e) => setMaxShared(e.target.value)} />
          </Field>
          <FormSlot className="shrink-0">
            <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
              <input type="checkbox" checked={includeControl} onChange={(e) => setIncludeControl(e.target.checked)} /> <Term id="uniform_control">균등 기준선</Term> 동시 생성
            </label>
          </FormSlot>
          <FormSlot className="shrink-0">
            <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> 저장 (성과 추적)
            </label>
          </FormSlot>
          <FormSlot className="ml-auto shrink-0">
            <span className="inline-flex flex-nowrap items-center gap-2 whitespace-nowrap" data-testid="recommend-buttons">
              <button type="submit" className={btnCls} disabled={m.isPending || seq.isPending || pendingAction !== null} title={pendingAction === 'single' ? 'SEED 탐색이 완료되는 즉시 이 설정으로 추천을 생성합니다' : undefined}>
                {pendingAction === 'single' ? 'SEED 대기 중…' : m.isPending ? '생성 중…' : '추천 생성'}
              </button>
              <button
                type="button"
                className={`${btnCls} bg-emerald-700 hover:bg-emerald-800`}
                disabled={m.isPending || seq.isPending || pendingAction !== null || !strategies.data?.length}
                title={
                  pendingAction === 'sequential'
                    ? 'SEED 탐색이 완료되는 즉시 이 설정으로 순차 생성을 시작합니다'
                    : `전략 선택의 ${strategies.data?.length ?? 0}개 전략을 순서대로 같은 옵션(개수·seed·최대 공유·저장)으로 생성합니다. 전략마다 별도 batch, 균등 기준선은 'uniform' 전략이 담당`
                }
                onClick={runSequential}
              >
                {pendingAction === 'sequential' ? 'SEED 대기 중…' : seq.isPending ? `순차 생성 중… (${strategies.data?.length ?? 0}전략)` : '추천 생성(순차)'}
              </button>
            </span>
          </FormSlot>
        </form>
        {seedSearchStart.isError && <ErrorBox error={seedSearchStart.error} />}
        {seedJob.data && (
          <p className="mt-2 text-xs" role="status" aria-label="SEED 탐색 상태">
            {seedJob.data.status === 'running' && (
              <span className="text-indigo-700 dark:text-indigo-300">
                SEED 탐색 중 — {seedJob.data.iterations.toLocaleString()}회 시도 (목표 {rankLabel(seedJob.data.target_rank)}, 대상 {seedJob.data.target_draw_no}회 vs 직전 {seedJob.data.compare_draw_no}회 실제 결과) ·{' '}
                {seedJob.data.elapsed_seconds.toFixed(1)}s 경과
                {pendingAction && <> — 완료되면 자동으로 {pendingAction === 'single' ? '추천을' : '순차 생성을'} 시작합니다</>}
              </span>
            )}
            {seedJob.data.status === 'done' && (
              <span className="text-emerald-700 dark:text-emerald-300">
                SEED 값 생성 완료 — {seedJob.data.iterations.toLocaleString()}회 만에 {rankLabel(seedJob.data.target_rank)} 달성({labelOf(seedJob.data.matched_strategy ?? '')}) → seed 에{' '}
                {seedJob.data.seed} 를 입력했습니다{seedJob.data.env_updated && <> · 다음에도 기본값으로 쓰이도록 .env.local 에 저장했습니다</>}
              </span>
            )}
            {seedJob.data.status === 'stopped' && (
              <span className="text-neutral-600 dark:text-neutral-300">
                SEED 탐색을{' '}
                {seedJob.data.stop_reason === 'max_iterations' ? `상한(${seedJob.data.max_iterations.toLocaleString()}회)에 닿아 자동 중지` : '중지'}
                했습니다 — {seedJob.data.iterations.toLocaleString()}회 시도 후 일치 없음
              </span>
            )}
            {seedJob.data.status === 'error' && <span className="text-red-700 dark:text-red-300">SEED 탐색 오류: {seedJob.data.error}</span>}
          </p>
        )}
        {m.isError && <ErrorBox error={m.error} />}
        {seq.isError && <ErrorBox error={seq.error} />}
      </Section>

      <Section title={<Term id="backtest" icon>선택 전략의 군 B backtest 요약</Term>}>
        <BacktestSummary strategy={strategy} />
      </Section>

      {res && <RecommendResultSection res={res} alpha={alpha} />}
      {seq.data && (
        <>
          <div role="status" aria-label="순차 생성 요약" className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
            순차 생성 완료 — {seq.data.results.length}전략 · {seq.data.total_tickets}장 · 대상 {seq.data.target_draw_no ?? '—'}회 · sequence {seq.data.sequence_id.slice(0, 8)}
            {seq.data.failed.length > 0 && (
              <span className="ml-2 text-amber-800 dark:text-amber-200">
                실패 {seq.data.failed.length}: {seq.data.failed.map((f) => `${labelOf(f.strategy)} (${f.error})`).join(', ')}
              </span>
            )}
          </div>
          {seq.data.results.map((r, idx) => (
            <RecommendResultSection key={r.batch_id} res={r} alpha={alpha} titlePrefix={`순차 ${idx + 1}/${seq.data!.results.length} · ${r.sets[0]?.label ?? labelOf(r.sets[0]?.strategy ?? '')}`} />
          ))}
        </>
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
        <div className="mb-3 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]" role="group" aria-label="추천 이력 필터">
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
          <FormSlot className="whitespace-nowrap">
            <button
              type="button"
              className={`${btnCls} shrink-0 !px-2 bg-neutral-600 hover:bg-neutral-700`}
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
            <button
              type="button"
              className={`${btnCls} shrink-0 !px-2 bg-emerald-700 hover:bg-emerald-800`}
              title={autoBlock ?? '1..P 중 5개 무작위 추출 × 대상 회차 수 → 빈도 상위 5 위치의 전략별 최신 티켓 등록 (진행 예정 회차만)'}
              disabled={autoReg.isPending || autoBlock !== null}
              onClick={() => {
                const d = hTarget ? `${hTarget}회` : '최신 회차 + 1';
                const excl = excludeNumbers.length ? `\n제외 번호 [${excludeNumbers.join(', ')}] 가 포함된 조합은 등록하지 않습니다.` : '';
                if (window.confirm(`대상 회차 ${d} 의 전략별 최신 추천 티켓 중 무작위 빈도 상위 5개 위치를 내 번호로 등록할까요?\n이미 등록된 번호는 새 행 없이 ★ 중복(×n)으로 병합됩니다.${excl}`))
                  autoReg.mutate();
              }}
            >
              {autoReg.isPending ? '등록 중…' : '내 번호로 자동 등록'}
            </button>
            <button
              type="button"
              className={`${btnCls} shrink-0 !px-2 bg-red-700 hover:bg-red-800`}
              title={resetBlock ?? '진행 예정 회차(최신 회차 + 1)에 저장된 사용자 생성 추천 티켓을 모두 삭제 (결과가 입력된 이전 회차·검증 replay 는 유지)'}
              disabled={resetRec.isPending || resetBlock !== null}
              onClick={() => {
                if (window.confirm('현재 회차(최신 회차 + 1)에 저장된 추천 티켓을 모두 삭제할까요?\n검증 replay 와 다른 회차 추천은 유지되며, 되돌릴 수 없습니다.'))
                  resetRec.mutate();
              }}
            >
              {resetRec.isPending ? '초기화 중…' : '추천 초기화'}
            </button>
          </FormSlot>
        </div>
        {resetRec.isError && <ErrorBox error={resetRec.error} />}
        {resetRec.data && (
          <p className="mb-2 text-xs text-red-800 dark:text-red-200" role="status" aria-label="추천 초기화 결과">
            {resetRec.data.target_draw_no}회 추천 {resetRec.data.deleted_recommendations.toLocaleString()}장을 초기화했습니다.
          </p>
        )}
        {autoReg.isError && <ErrorBox error={autoReg.error} />}
        {autoReg.data && <AutoRegisterSummary r={autoReg.data} />}
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
