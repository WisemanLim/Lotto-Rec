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

export function BallRow({ numbers, bonus, size = 'md' }: { numbers: number[]; bonus?: number | null; size?: Props['size'] }) {
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
    </span>
  );
}
