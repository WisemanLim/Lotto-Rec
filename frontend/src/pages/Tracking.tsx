import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type DrawIn, type ImportReport, type Origin, type Outcome } from '../api/client';
import DataTable, { type Column } from '../components/DataTable';
import ConsistencyPanel from '../components/ConsistencyPanel';
import KpiCard from '../components/KpiCard';
import RecentDrawChips from '../components/RecentDrawChips';
import PolicyBanner from '../components/PolicyBanner';
import Term from '../components/Term';
import { ComparisonTable, CumulativeCurve, PerfTable, StrategyDetail } from '../components/PerformancePanel';
import { labelOf } from '../lib/labels';
import { BallRow } from '../components/LottoBall';
import { Empty, ErrorBox, Field, FormSlot, Loading, PageTitle, Section, btnCls, btnGhostCls, inputCls } from '../components/States';
import { fmtDate, fmtWon } from '../lib/format';

const ORIGINS: Array<{ v: Origin | 'all'; label: string }> = [
  { v: 'user', label: '사용자 (추천+내 번호)' },
  { v: 'backtest', label: 'backtest' },
  { v: 'all', label: '전체' },
];

export function ImportReportView({ r }: { r: ImportReport }) {
  return (
    <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
      <div className="font-medium">적재 리포트 #{r.import_id} · {r.filename}</div>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs md:grid-cols-4">
        <dt className="text-neutral-500">삽입</dt>
        <dd className="tabular-nums">{r.inserted}</dd>
        <dt className="text-neutral-500">중복 제외</dt>
        <dd className="tabular-nums">{r.skipped_duplicate}</dd>
        <dt className="text-neutral-500">충돌</dt>
        <dd className="tabular-nums">{r.conflicts.length}</dd>
        <dt className="text-neutral-500">무효</dt>
        <dd className="tabular-nums">{r.invalid.length}</dd>
        <dt className="text-neutral-500">삽입 회차</dt>
        <dd className="col-span-3 truncate" title={r.inserted_draws.join(', ')}>
          {r.inserted_draws.length ? `${r.inserted_draws[0]}–${r.inserted_draws.at(-1)} (${r.inserted_draws.length})` : '—'}
        </dd>
        <dt className="text-neutral-500">자동 재분석 run</dt>
        <dd className="col-span-3 font-mono">{r.triggered_run_id ?? '없음'}</dd>
      </dl>
      {r.conflicts.length > 0 && <pre className="mt-2 max-h-32 overflow-auto rounded bg-white p-2 text-[11px] dark:bg-neutral-900">{JSON.stringify(r.conflicts, null, 1)}</pre>}
      {r.invalid.length > 0 && <pre className="mt-2 max-h-32 overflow-auto rounded bg-white p-2 text-[11px] dark:bg-neutral-900">{JSON.stringify(r.invalid, null, 1)}</pre>}
    </div>
  );
}

const RANKS = [1, 2, 3, 4, 5] as const;
const AUTO_RANKS = [1, 2, 3] as const; // 총 당첨금 ÷ 당첨게임 수 로 1게임당 당첨금 자동계산
const smallInput = `${inputCls} !px-2 !py-1 !text-xs`;
const panelCls = 'rounded-lg border border-neutral-300 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-800/40';
const panelTitleCls = 'mb-2 border-l-4 border-indigo-500 pl-2 text-sm font-semibold';
const emptyForm = () => ({
  draw_no: '',
  numbers: '',
  bonus: '',
  overwrite: false,
  total1: '',
  total2: '',
  total3: '',
  winners1: '',
  winners2: '',
  winners3: '',
  winners4: '',
  winners5: '',
});
type FormState = ReturnType<typeof emptyForm>;
const won = (n: number | null) => (n == null ? '' : n.toLocaleString('ko-KR'));

function RoField({ label, value }: { label: string; value: number | null }) {
  return (
    <input
      readOnly
      tabIndex={-1}
      aria-label={label}
      value={won(value)}
      placeholder="자동"
      className={`${smallInput} cursor-default bg-neutral-100 text-right tabular-nums dark:bg-neutral-700/50`}
    />
  );
}

export function DrawEntryForms() {
  const qc = useQueryClient();
  const config = useQuery({ queryKey: ['config'], queryFn: api.config });
  const fixed4 = config.data?.lotto_prize_rank4_default ?? 50000;
  const fixed5 = config.data?.lotto_prize_rank5_default ?? 5000;
  const [form, setForm] = useState(emptyForm);
  const [report, setReport] = useState<ImportReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [overwriteFile, setOverwriteFile] = useState(false);
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['data'] });
    void qc.invalidateQueries({ queryKey: ['tracking'] });
    void qc.invalidateQueries({ queryKey: ['analysis'] });
    void qc.invalidateQueries({ queryKey: ['user'] });
  };
  const add = useMutation({
    mutationFn: (b: DrawIn) => api.data.addDraw(b),
    onSuccess: (r) => {
      setReport(r);
      invalidate();
    },
  });
  const upload = useMutation({
    mutationFn: ({ file, overwrite }: { file: File; overwrite: boolean }) => api.data.importFile(file, overwrite),
    onSuccess: (r) => {
      setReport(r);
      invalidate();
    },
  });
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const winnersOf = (r: (typeof RANKS)[number]) => num(form[`winners${r}` as keyof FormState] as string);
  /** 1게임당 당첨금: 1~3등 = 총액 ÷ 당첨게임 수(반올림), 4·5등 = 고정값. */
  const perGame = (r: (typeof RANKS)[number]): number | null => {
    if (r === 4) return fixed4;
    if (r === 5) return fixed5;
    const t = num(form[`total${r}` as keyof FormState] as string);
    const w = winnersOf(r);
    return t != null && w != null && w > 0 ? Math.round(t / w) : null;
  };
  /** 등위별 총 당첨금: 1~3등 = 입력값, 4·5등 = 당첨게임 수 × 고정값. */
  const totalOf = (r: (typeof RANKS)[number]): number | null => {
    if (r >= 4) {
      const w = winnersOf(r);
      return w == null ? null : w * (perGame(r) ?? 0);
    }
    return num(form[`total${r}` as keyof FormState] as string);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nums = form.numbers
      .split(/[,\s]+/)
      .map(Number)
      .filter((n) => Number.isInteger(n));
    add.mutate({
      draw_no: Number(form.draw_no),
      numbers: nums,
      bonus: Number(form.bonus),
      ...Object.fromEntries(RANKS.flatMap((r) => [[`prize${r}`, winnersOf(r) == null && r >= 4 ? null : perGame(r)], [`winners${r}`, winnersOf(r)]])),
      overwrite: form.overwrite,
    });
  };
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const rowLabel = 'text-xs font-medium text-neutral-600 dark:text-neutral-300';
  return (
    <div className="space-y-4">
      <form onSubmit={submit} className={`${panelCls} space-y-3`} aria-label="추첨 결과 직접 입력">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={`${panelTitleCls} !mb-0`}>추첨 결과 직접 입력</h3>
          <RecentDrawChips fixed={{ 4: fixed4, 5: fixed5 }} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="회차">
            <input className={smallInput} type="number" required value={form.draw_no} onChange={set('draw_no')} />
          </Field>
          <div className="col-span-2">
            <Field label="본번호 6개 (쉼표)">
              <input className={smallInput} required value={form.numbers} onChange={set('numbers')} placeholder="1, 2, 3, 4, 5, 6" />
            </Field>
          </div>
          <Field label="보너스">
            <input className={smallInput} type="number" min={1} max={45} required value={form.bonus} onChange={set('bonus')} />
          </Field>
        </div>
        <div role="group" aria-label="등수별 당첨 정보 (선택)" className="overflow-x-auto">
          <div className="grid min-w-[36rem] grid-cols-[7.5rem_repeat(5,minmax(0,1fr))] items-center gap-x-2 gap-y-1.5">
            <span className="text-xs text-neutral-500">순위</span>
            {RANKS.map((r) => (
              <span key={r} className="text-center text-xs font-semibold">
                {r}등
              </span>
            ))}
            <span className={rowLabel}>등위별 총 당첨금 (원)</span>
            {RANKS.map((r) =>
              (AUTO_RANKS as readonly number[]).includes(r) ? (
                <input key={r} className={`${smallInput} text-right`} type="number" min={0} aria-label={`${r}등 등위별 총 당첨금`} value={form[`total${r as 1 | 2 | 3}`]} onChange={set(`total${r as 1 | 2 | 3}`)} />
              ) : (
                <RoField key={r} label={`${r}등 등위별 총 당첨금`} value={totalOf(r)} />
              ),
            )}
            <span className={rowLabel}>당첨게임 수</span>
            {RANKS.map((r) => (
              <input key={r} className={`${smallInput} text-right`} type="number" min={0} aria-label={`${r}등 당첨게임 수`} value={form[`winners${r}`]} onChange={set(`winners${r}`)} />
            ))}
            <span className={rowLabel}>1게임당 당첨금 (원)</span>
            {RANKS.map((r) => (
              <RoField key={r} label={`${r}등 1게임당 당첨금`} value={perGame(r)} />
            ))}
          </div>
        </div>
        <p className="text-[11px] text-neutral-500">
          선택 입력입니다. 1~3등은 <b>총 당첨금 ÷ 당첨게임 수</b>로 1게임당 당첨금이 자동 계산되고, 4·5등은 고정값({fixed4.toLocaleString()}원 · {fixed5.toLocaleString()}원)을 그대로 사용합니다.
        </p>
        <div className="flex flex-nowrap items-center gap-4 whitespace-nowrap">
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.overwrite} onChange={set('overwrite')} /> 동일 회차 존재 시 덮어쓰기
          </label>
          <button type="submit" className={btnCls} disabled={add.isPending}>
            {add.isPending ? '저장 중…' : '결과 입력'}
          </button>
        </div>
        {add.isError && <ErrorBox error={add.error} />}
      </form>
      <form
        className={`${panelCls} space-y-2`}
        aria-label="파일 업로드"
        onSubmit={(e) => {
          e.preventDefault();
          const f = fileRef.current?.files?.[0];
          if (f) upload.mutate({ file: f, overwrite: overwriteFile });
        }}
      >
        <h3 className={panelTitleCls}>파일 업로드 (xlsx/csv, 증분 적재)</h3>
        <div className="flex flex-nowrap items-center gap-4 whitespace-nowrap" role="group" aria-label="파일 업로드 도구">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="block min-w-0 text-sm" aria-label="적재 파일" />
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={overwriteFile} onChange={(e) => setOverwriteFile(e.target.checked)} /> 충돌 회차 덮어쓰기
          </label>
          <button type="submit" className={btnGhostCls} disabled={upload.isPending}>
            {upload.isPending ? '업로드 중…' : '업로드'}
          </button>
          <p className="min-w-0 flex-1 whitespace-normal text-[11px] text-neutral-500">새 회차가 1건 이상 삽입되면 파생 재생성 → 자동 재분석 → 저장된 추천·내 번호와 자동 대조됩니다.</p>
        </div>
        {upload.isError && <ErrorBox error={upload.error} />}
      </form>
      {report && <ImportReportView r={report} />}
    </div>
  );
}

export default function Tracking() {
  const qc = useQueryClient();
  const [origin, setOrigin] = useState<Origin | 'all'>('user');
  const summary = useQuery({
    queryKey: ['tracking', 'summary', origin],
    queryFn: () => api.tracking.summary(origin === 'all' ? undefined : origin),
  });
  const pending = useQuery({ queryKey: ['tracking', 'pending'], queryFn: api.tracking.pending });
  // 티켓 단위 결과 필터 (S8.6) — origin 토글과 연동
  const [oDraw, setODraw] = useState('');
  const [oStrategy, setOStrategy] = useState('');
  const [oSource, setOSource] = useState<'' | 'recommendation' | 'user'>('');
  const [oLimit, setOLimit] = useState<number>(200); // 20|50|100|200|500|50000(전체)
  const oFilter = {
    origin: origin === 'all' ? ('all' as const) : origin,
    draw_no: oDraw ? Number(oDraw) : undefined,
    strategy: oStrategy || undefined,
    source: oSource || undefined,
  };
  const outcomes = useQuery({
    queryKey: ['tracking', 'outcomes', oFilter, oLimit],
    queryFn: () => api.tracking.outcomes({ ...oFilter, limit: oLimit }),
  });
  const outcomesSummary = useQuery({
    queryKey: ['tracking', 'outcomes-summary', oFilter],
    queryFn: () => api.tracking.outcomesSummary(oFilter),
  });
  const evaluate = useMutation({
    mutationFn: (d: number) => api.tracking.evaluate(d),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tracking'] }),
  });
  const [evalDraw, setEvalDraw] = useState('');
  const d = summary.data;
  const has = d && Object.keys(d.strategies).length > 0;

  const outCols: Column<Outcome>[] = [
    { key: 'draw_no', label: '회차', align: 'right' },
    { key: 'strategy', label: '전략', render: (r) => labelOf(r.strategy) },
    { key: 'origin', label: '출처', render: (r) => `${r.origin}/${r.source}` },
    { key: 'ticket', label: '티켓', sortable: false, render: (r) => <BallRow numbers={r.ticket} size="sm" pastWins={r.past_wins} /> },
    { key: 'main_matches', label: '일치', align: 'right' },
    { key: 'bonus_match', label: '보너스', render: (r) => (r.bonus_match ? '○' : '—') },
    { key: 'rank', label: <Term id="rank_rules" icon>등수</Term>, align: 'right', render: (r) => (r.rank ? `${r.rank}등` : '낙첨') },
    { key: 'prize_amount', label: '당첨금', align: 'right', render: (r) => fmtWon(r.prize_amount) },
    { key: 'evaluated_at', label: '대조 시각', render: (r) => fmtDate(r.evaluated_at) },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        title="성과 추적"
        sub={
          <>
            저장된 추천·내 번호를 이후 회차 결과와 자동 대조 — 전략별 누적 성과 vs <Term id="uniform_control">균등 영분포</Term>
          </>
        }
      />
      <div role="group" aria-label="출처" className="inline-flex overflow-hidden rounded-md border border-neutral-300 text-xs dark:border-neutral-600">
        {ORIGINS.map((o) => (
          <button key={o.v} type="button" onClick={() => setOrigin(o.v)} className={`px-2.5 py-1 ${origin === o.v ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : ''}`}>
            {o.label}
          </button>
        ))}
      </div>
      {summary.isLoading && <Loading />}
      {summary.isError && <ErrorBox error={summary.error} />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="대조된 결과 수" value={d.n_outcomes.toLocaleString()} />
            <KpiCard label="DB 최신 회차" value={d.pending.max_draw_in_db ?? '—'} />
            <KpiCard label="대기 추천 티켓" value={d.pending.recommendations} sub={d.pending.target_draws.length ? `대상 ${d.pending.target_draws.join(', ')}회` : '없음'} />
            <KpiCard label="대기 내 번호" value={d.pending.user_tickets} />
          </div>
          <PolicyBanner compact lines={[d.policy]} />
          {!has && <Empty>이 출처에 대조된 결과가 없습니다. 추천 저장 또는 내 번호 저장 후 새 회차 결과를 입력하면 자동 대조됩니다.</Empty>}
          {has && (
            <>
              <Section title="전략별 누적 성과">
                <PerfTable strategies={d.strategies} />
              </Section>
              <Section title="누적 기대 vs 실제">
                <CumulativeCurve strategies={d.strategies} />
              </Section>
              <Section
                title={
                  <>
                    <Term id="match_distribution" icon>일치수 분포</Term> · <Term id="rank_rules" icon>등수별 적중</Term> (전략 선택)
                  </>
                }
              >
                <StrategyDetail strategies={d.strategies} />
              </Section>
              {Object.keys(d.comparison_vs_uniform).length > 0 && (
                <Section title={<Term id="diff_vs_uniform" icon>균등(control) 대비 차이</Term>}>
                  <ComparisonTable comparison={d.comparison_vs_uniform} />
                </Section>
              )}
            </>
          )}
        </>
      )}
      <Section title="추천 정합성 분석">
        <ConsistencyPanel origin={origin} />
      </Section>
      <Section
        title="미추첨 대기 티켓"
        right={
          <form
            className="flex items-center gap-1 text-xs"
            onSubmit={(e) => {
              e.preventDefault();
              if (evalDraw) evaluate.mutate(Number(evalDraw));
            }}
          >
            <input className={`${inputCls} w-24`} type="number" placeholder="회차" value={evalDraw} onChange={(e) => setEvalDraw(e.target.value)} aria-label="수동 대조 회차" />
            <button type="submit" className={btnGhostCls} disabled={evaluate.isPending}>
              수동 대조
            </button>
          </form>
        }
      >
        {pending.data && (
          <p className="text-sm">
            DB 최신 {pending.data.max_draw_in_db ?? '—'}회 · 대기 추천 {pending.data.recommendations}장 · 대기 내 번호 {pending.data.user_tickets}장 · 대상 회차 {pending.data.target_draws.length ? pending.data.target_draws.join(', ') : '없음'}
          </p>
        )}
        {evaluate.isError && <ErrorBox error={evaluate.error} />}
        {evaluate.isSuccess && <p className="text-xs text-emerald-700 dark:text-emerald-300">대조 완료.</p>}
      </Section>
      {/* v1.19 (S8.6-1): 설정/실행의 결과 입력·업로드(S1.6·S1.7)와 기능이 중복되어 화면에서 숨김 — 복원 시 아래 주석 해제
      <Section title="추첨 결과 입력 / 업로드">
        <DrawEntryForms />
      </Section>
      */}
      <Section
        title="티켓 단위 결과"
        right={
          outcomesSummary.data && (
            <span className="text-xs text-neutral-500 tabular-nums">
              필터 {outcomesSummary.data.total_filtered.toLocaleString()} / {origin === 'all' ? '전체' : origin === 'user' ? '사용자' : '검증 replay'}{' '}
              {outcomesSummary.data.total_all.toLocaleString()}건
            </span>
          )
        }
      >
        <div className="mb-3 grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-5" role="group" aria-label="티켓 결과 필터">
          <Field label="회차" hint="대조된 회차만">
            <select className={inputCls} value={oDraw} onChange={(e) => setODraw(e.target.value)} aria-label="회차 필터">
              <option value="">전체</option>
              {outcomesSummary.data?.draw_nos.map((d) => (
                <option key={d} value={d}>
                  {d}회
                </option>
              ))}
            </select>
          </Field>
          <Field label="전략">
            <select className={inputCls} value={oStrategy} onChange={(e) => setOStrategy(e.target.value)} aria-label="전략 필터">
              <option value="">전체</option>
              {Object.entries(outcomesSummary.data?.strategies ?? {}).map(([k, n]) => (
                <option key={k} value={k}>
                  {labelOf(k)} ({n})
                </option>
              ))}
            </select>
          </Field>
          <Field label="출처" hint="추천 티켓 / 내 번호">
            <select className={inputCls} value={oSource} onChange={(e) => setOSource(e.target.value as '' | 'recommendation' | 'user')} aria-label="출처 필터">
              <option value="">전체</option>
              <option value="recommendation">추천{outcomesSummary.data?.by_source?.recommendation != null ? ` (${outcomesSummary.data.by_source.recommendation})` : ''}</option>
              <option value="user">내 번호{outcomesSummary.data?.by_source?.user != null ? ` (${outcomesSummary.data.by_source.user})` : ''}</option>
            </select>
          </Field>
          <Field label="표시 개수" hint="전체 = 최대 50,000">
            <select className={inputCls} value={oLimit} onChange={(e) => setOLimit(Number(e.target.value))} aria-label="표시 개수">
              {[20, 50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={50000}>전체</option>
            </select>
          </Field>
          <FormSlot>
            <button
              type="button"
              className={`${btnCls} bg-neutral-600 hover:bg-neutral-700`}
              onClick={() => {
                setODraw('');
                setOStrategy('');
                setOSource('');
                setOLimit(200);
              }}
            >
              필터 초기화
            </button>
          </FormSlot>
        </div>
        {outcomes.isLoading && <Loading />}
        {outcomes.isError && <ErrorBox error={outcomes.error} />}
        {outcomes.data && (
          <DataTable columns={outCols} rows={outcomes.data} rowKey={(r) => r.outcome_id} pageSize={200} dense initialSort={{ key: 'draw_no', dir: 'desc' }} csvName="outcomes" emptyText="조건에 맞는 결과가 없습니다." />
        )}
        {outcomes.data && outcomesSummary.data && outcomes.data.length < outcomesSummary.data.total_filtered && (
          <p className="mt-1 text-xs text-neutral-500">
            {outcomes.data.length.toLocaleString()}건 표시 중 (필터 결과 {outcomesSummary.data.total_filtered.toLocaleString()}건) — 표시 개수를 &quot;전체&quot;로 바꾸면 모두 볼 수 있습니다.
          </p>
        )}
      </Section>
    </div>
  );
}
