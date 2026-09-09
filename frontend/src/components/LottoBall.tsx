import type { PastWin } from '../api/client';
import { BALL_HEX, ballTone } from '../lib/colors';

interface Props {
  n: number;
  size?: 'sm' | 'md' | 'lg';
  bonus?: boolean;
  dim?: boolean;
  onClick?: () => void;
  selected?: boolean;
  title?: string;
}

const SIZE = { sm: 'h-6 w-6 text-[11px]', md: 'h-8 w-8 text-sm', lg: 'h-10 w-10 text-base' };

/** 한국 로또 구간색 공 (1–10 노랑, 11–20 파랑, 21–30 빨강, 31–40 회색, 41–45 초록). */
export default function LottoBall({ n, size = 'md', bonus, dim, onClick, selected, title }: Props) {
  const tone = ballTone(n);
  const bg = BALL_HEX[tone];
  const fg = tone === 'yellow' || tone === 'green' ? '#1a1a19' : '#ffffff';
  const cls = `inline-flex items-center justify-center rounded-full font-semibold tabular-nums shadow-sm select-none ${SIZE[size]} ${
    dim ? 'opacity-30' : ''
  } ${selected ? 'ring-2 ring-offset-1 ring-neutral-900 dark:ring-white dark:ring-offset-neutral-900' : ''} ${
    onClick ? 'cursor-pointer hover:scale-105 transition' : ''
  }`;
  const style = { backgroundColor: bg, color: fg };
  const label = bonus ? `보너스 ${n}` : `${n}`;
  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        style={style}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={label}
        title={title}
        data-tone={tone}
      >
        {n}
      </button>
    );
  }
  return (
    <span className={cls} style={style} aria-label={label} title={title} data-tone={tone}>
      {n}
    </span>
  );
}

/** 과거 1·2등 일치 회차 태그 `(386)` — 기본 글자보다 작고 회색으로 흐릿하게 (PRD S4.9). */
export function PastWinTags({ wins }: { wins?: PastWin[] | null }) {
  if (!wins?.length) return null;
  return (
    <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-neutral-400/80 dark:text-neutral-500" aria-label="과거 1·2등 일치 회차">
      {wins.map((w) => (
        <span key={`${w.draw_no}-${w.rank}`} title={`${w.draw_no}회 ${w.rank}등 조합과 일치`}>
          ({w.draw_no})
        </span>
      ))}
    </span>
  );
}

export function BallRow({
  numbers,
  bonus,
  size = 'md',
  pastWins,
}: {
  numbers: number[];
  bonus?: number | null;
  size?: Props['size'];
  pastWins?: PastWin[] | null;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {numbers.map((n) => (
        <LottoBall key={n} n={n} size={size} />
      ))}
      {bonus != null && (
        <>
          <span className="mx-1 text-neutral-400">+</span>
          <LottoBall n={bonus} size={size} bonus />
        </>
      )}
      <PastWinTags wins={pastWins} />
    </span>
  );
}
