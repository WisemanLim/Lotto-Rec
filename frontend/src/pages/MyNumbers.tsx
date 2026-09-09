import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type TicketIn, type UserTicket } from '../api/client';
import { useRun } from '../hooks/useRun';
import LottoBall, { BallRow } from '../components/LottoBall';
import PolicyBanner from '../components/PolicyBanner';
import ScorecardView from '../components/ScorecardView';
import Term from '../components/Term';
import { Empty, ErrorBox, Field, FormSlot, Loading, PageTitle, Section, btnCls, btnDangerCls, btnGhostCls, inputCls } from '../components/States';
import { fmtDate, fmtNum, fmtP, fmtWon } from '../lib/format';
import { pickPositions, type LotteryPick } from '../lib/lottery';

const NUMS = Array.from({ length: 45 }, (_, i) => i + 1);

export default function MyNumbers() {
  const qc = useQueryClient();
  const { run } = useRun();
  const [picked, setPicked] = useState<number[]>([]);
  const [bonus, setBonus] = useState<number | null>(null);
  const [bonusMode, setBonusMode] = useState(false);
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('');
  const summary = useQuery({ queryKey: ['data', 'summary'], queryFn: api.data.summary });
  const tickets = useQuery({ queryKey: ['user', 'tickets'], queryFn: () => api.user.tickets(200) });
  const evaluate = useMutation({ mutationFn: (b: TicketIn) => api.user.evaluate(b) });
  const save = useMutation({
    mutationFn: (b: TicketIn) => api.user.save(b),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user'] });
      void qc.invalidateQueries({ queryKey: ['tracking'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.user.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['user'] });
      void qc.invalidateQueries({ queryKey: ['tracking'] });
    },
  });

  const toggle = (n: number) => {
    if (bonusMode) {
      if (picked.includes(n)) return;
      setBonus((b) => (b === n ? null : n));
      return;
    }
    if (n === bonus) return;
    setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length < 6 ? [...p, n].sort((a, b) => a - b) : p));
  };
  const ready = picked.length === 6;
  const body: TicketIn = { numbers: picked, bonus };
  const nextDraw = (summary.data?.max_draw ?? 0) + 1;
  // S5.5 등록된 번호로 추첨 시도 — 1..N(저장 개수) 무작위 빈도 규칙, 화면 상태만(DB 저장 없음)
  const [lottery, setLottery] = useState<{ pick: LotteryPick; ids: Set<number> } | null>(null);
  const tryLottery = () => {
    const list = tickets.data ?? [];
    const pick = pickPositions(list.length, 5, nextDraw);
    setLottery({ pick, ids: new Set(pick.selected.map((pos) => list[pos - 1].ticket_id)) });
  };

  return (
    <div className="space-y-4">
      <PageTitle title="내 번호" sub="6개(+보너스) 입력 → 통계 스코어카드 → 저장 후 이후 회차와 자동 대조" />
      <PolicyBanner compact lines={['모든 조합의 당첨확률은 동일(1/8,145,060)합니다. 스코어카드는 설명·검정용이며 특이성은 당첨확률과 무관합니다.']} />
      <Section
        title="번호 선택"
        right={
          <div className="flex items-center gap-2 text-xs">
            <button type="button" className={`${btnGhostCls} ${bonusMode ? 'bg-neutral-200 dark:bg-neutral-700' : ''}`} onClick={() => setBonusMode((b) => !b)} aria-pressed={bonusMode}>
              {bonusMode ? '보너스 선택 중' : '보너스 선택'}
            </button>
            <button
              type="button"
              className={btnGhostCls}
              onClick={() => {
                setPicked([]);
                setBonus(null);
                evaluate.reset();
              }}
            >
              초기화
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-9 gap-1.5 sm:grid-cols-15" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(2.25rem, 1fr))' }}>
          {NUMS.map((n) => (
            <LottoBall key={n} n={n} size="md" onClick={() => toggle(n)} selected={picked.includes(n) || bonus === n} dim={!picked.includes(n) && bonus !== n && (bonusMode ? false : picked.length >= 6)} title={bonus === n ? '보너스' : undefined} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm">
            선택: {picked.length ? <BallRow numbers={picked} bonus={bonus} /> : <span className="text-neutral-500">없음</span>} ({picked.length}/6)
          </span>
          <button type="button" className={btnCls} disabled={!ready || evaluate.isPending} onClick={() => evaluate.mutate(body)}>
            {evaluate.isPending ? '평가 중…' : '평가'}
          </button>
        </div>
        {evaluate.isError && <ErrorBox error={evaluate.error} />}
      </Section>

      {evaluate.data && (
        <Section title="스코어카드">
          <ScorecardView sc={evaluate.data} alpha={run?.alpha ?? 0.05} />
          <form
            className="mt-4 grid items-start gap-2 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ ...body, label: label || null, target_draw_no: target ? Number(target) : null });
            }}
          >
            <Field label="라벨 (선택)">
              <input className={inputCls} maxLength={64} value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <Field label="대상 회차" hint={`빈칸 = 다음 회차 ${nextDraw}`}>
              <input className={inputCls} type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} placeholder={String(nextDraw)} />
            </Field>
            <FormSlot hint={save.isSuccess ? `저장됨 #${save.data.ticket_id} (대상 ${save.data.target_draw_no}회)` : undefined}>
              <button type="submit" className={btnCls} disabled={save.isPending}>
                {save.isPending ? '저장 중…' : '저장 (성과 추적)'}
              </button>
            </FormSlot>
          </form>
          {save.isError && <ErrorBox error={save.error} />}
        </Section>
      )}

      <Section
        title="저장된 번호"
        right={
          <button
            type="button"
            className={`${btnCls} bg-emerald-700 hover:bg-emerald-800`}
            disabled={!tickets.data?.length}
            title={`1..N(저장된 번호 ${tickets.data?.length ?? 0}개) 중 5개 무작위 추출 × 다음 회차 ${nextDraw}회 → 빈도 상위 5 위치를 ★ 표시 (화면 표시만, 저장 없음)`}
            onClick={tryLottery}
          >
            등록된 번호로 추첨 시도
          </button>
        }
      >
        {lottery && (
          <p className="mb-2 text-xs text-emerald-800 dark:text-emerald-200" role="status" aria-label="추첨 시도 결과">
            추첨 시도 — {lottery.pick.rounds.toLocaleString()}회 반복(1..{lottery.pick.pool} 중 {lottery.pick.pick}개) · 선택 위치{' '}
            <span className="font-semibold tabular-nums">{lottery.pick.selected.join(', ')}</span> · ★ {lottery.ids.size}장 (화면 표시만, 저장되지 않음)
          </p>
        )}
        {tickets.isLoading && <Loading />}
        {tickets.isError && <ErrorBox error={tickets.error} />}
        {tickets.data && tickets.data.length === 0 && <Empty>저장된 번호 없음</Empty>}
        <div className="space-y-2">
          {tickets.data?.map((t: UserTicket) => (
            <div key={t.ticket_id} className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-700">
              <BallRow numbers={t.numbers} bonus={t.bonus} size="sm" />
              <span className="text-xs text-neutral-500">
                #{t.ticket_id} {t.label ? `· ${t.label}` : ''} · 대상 {t.target_draw_no ?? '미지정'}회 · {fmtDate(t.created_at)}
              </span>
              {t.scorecard && (
                <span className="text-xs text-neutral-600 dark:text-neutral-300">
                  쌍 <Term id="calibrated_lift">lift*</Term> {fmtNum(t.scorecard.mean_pair_lift, 3)} · <Term id="typicality">전형성 p</Term> {fmtP(t.scorecard.typicality_p)} · <Term id="winners_model">공유자 지수</Term> {t.scorecard.winners ? fmtNum(t.scorecard.winners.relative_index, 3) : '—'}
                </span>
              )}
              <span className="text-xs">
                {t.outcomes.length === 0 ? (
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">추첨 대기</span>
                ) : (
                  t.outcomes.map((o) => (
                    <span key={o.outcome_id} className="mr-1 rounded bg-blue-50 px-1.5 py-0.5 dark:bg-blue-950/40">
                      {o.draw_no}회 {o.main_matches}개 일치{o.bonus_match ? '+보' : ''} · {o.rank ? `${o.rank}등 ${fmtWon(o.prize_amount)}` : '낙첨'}
                    </span>
                  ))
                )}
              </span>
              <span className="ml-auto inline-flex items-center gap-2">
                {lottery?.ids.has(t.ticket_id) && (
                  <span className="text-base leading-none text-amber-500" role="img" aria-label="추첨 선택" title="추첨 시도로 선택됨 (화면 표시만)">
                    ★
                  </span>
                )}
                <button type="button" className={btnDangerCls} onClick={() => remove.mutate(t.ticket_id)} disabled={remove.isPending}>
                  삭제
                </button>
              </span>
            </div>
          ))}
        </div>
        {remove.isError && <ErrorBox error={remove.error} />}
      </Section>
    </div>
  );
}
