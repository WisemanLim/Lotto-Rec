import { useQuery } from '@tanstack/react-query';
import { api, type Draw } from '../api/client';
import { BallRow } from './LottoBall';

// S1.7 — '추첨 결과 직접 입력' 제목 우측: 과거 6회차 회차번호 칩 + 마우스 오버/포커스 툴팁 표 (표시 전용)
export const RECENT_CHIPS = 6;
const RANKS = [1, 2, 3, 4, 5] as const;
const FIXED_DEFAULT: Record<4 | 5, number> = { 4: 50000, 5: 5000 };
const CRITERIA = ['6개 일치', '5개 + 보너스', '5개 일치', '4개 일치', '3개 일치'];
const won = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('ko-KR')}원`);
const cnt = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('ko-KR'));

function rankRow(d: Draw, r: (typeof RANKS)[number], fixed: Record<4 | 5, number>) {
  const winners = d[`winners${r}` as keyof Draw] as number | null;
  const stored = d[`prize${r}` as keyof Draw] as number | null;
  const perGame = r >= 4 ? (stored ?? fixed[r as 4 | 5]) : stored;
  const total = perGame != null && winners != null ? perGame * winners : null;
  return { winners, perGame, total };
}

export function DrawTooltip({ d, fixed = FIXED_DEFAULT }: { d: Draw; fixed?: Record<4 | 5, number> }) {
  return (
    <div role="tooltip" className="w-[30rem] max-w-[calc(100vw-2rem)] rounded-md border border-neutral-300 bg-white p-3 text-left text-xs shadow-lg dark:border-neutral-600 dark:bg-neutral-900">
      <div className="mb-2 flex items-center gap-3">
        <span className="font-semibold">{d.draw_no}회 당첨결과</span>
        <BallRow numbers={d.numbers} bonus={d.bonus} size="sm" />
      </div>
      <table className="w-full border-collapse whitespace-nowrap tabular-nums">
        <thead>
          <tr className="border-b border-neutral-300 text-neutral-500 dark:border-neutral-600">
            <th className="py-1 pr-2 text-left font-normal">순위</th>
            <th className="py-1 pr-2 text-right font-normal">등위별 총 당첨금</th>
            <th className="py-1 pr-2 text-right font-normal">당첨게임 수</th>
            <th className="py-1 pr-2 text-right font-normal">1게임당 당첨금</th>
            <th className="py-1 text-left font-normal">당첨기준</th>
          </tr>
        </thead>
        <tbody>
          {RANKS.map((r, i) => {
            const x = rankRow(d, r, fixed);
            return (
              <tr key={r} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="py-1 pr-2 font-medium">{r}등</td>
                <td className="py-1 pr-2 text-right">{won(x.total)}</td>
                <td className="py-1 pr-2 text-right">{cnt(x.winners)}</td>
                <td className="py-1 pr-2 text-right">{won(x.perGame)}</td>
                <td className="py-1 text-neutral-500">{CRITERIA[i]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RecentDrawChips({ fixed }: { fixed?: Record<4 | 5, number> }) {
  const q = useQuery({
    queryKey: ['data', 'draws', 'recent-chips', RECENT_CHIPS],
    queryFn: () => api.data.draws({ limit: RECENT_CHIPS, order: 'desc' }),
  });
  const draws = Array.isArray(q.data) ? q.data : [];
  if (!draws.length) return null;
  return (
    <ul className="flex flex-wrap items-center justify-end gap-1.5" aria-label={`과거 ${draws.length}회차 요약`}>
      {draws.map((d) => (
        <li key={d.draw_no} className="group relative">
          <button
            type="button"
            className="rounded-md border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium tabular-nums hover:border-indigo-400 hover:bg-indigo-50 focus:border-indigo-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900 dark:hover:bg-indigo-950/40"
            aria-label={`${d.draw_no}회 결과 보기`}
          >
            {d.draw_no}
          </button>
          <div className="pointer-events-none invisible absolute right-0 top-full z-30 pt-1 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
            <DrawTooltip d={d} fixed={fixed} />
          </div>
        </li>
      ))}
    </ul>
  );
}
