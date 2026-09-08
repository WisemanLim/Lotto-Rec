import { fmtP } from '../lib/format';

interface Props {
  p: number | null | undefined;
  /** 보정 후 값(q 또는 보정 p). 주어지면 유의 판정에 우선 사용. */
  q?: number | null;
  alpha?: number;
  /** 서버가 계산한 유의 플래그가 있으면 우선. */
  sig?: boolean | null;
  showValue?: boolean;
}

/**
 * p<α(보정 후) → 강조 "유의"; 원시 p<0.05 이지만 보정 후 비유의 → "탐색 후보"; 그 외 값만 표시.
 */
export default function PValueBadge({ p, q, alpha = 0.05, sig, showValue = true }: Props) {
  if (p == null || Number.isNaN(p)) return <span className="text-neutral-400">—</span>;
  const significant = sig ?? (q != null ? q < alpha : p < alpha);
  const exploratory = !significant && p < 0.05;
  const text = showValue ? fmtP(p) : '';
  if (significant) {
    return (
      <span
        data-state="significant"
        className="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-800 dark:bg-orange-900/50 dark:text-orange-200"
        title={`보정 후 유의 (α=${alpha})`}
      >
        유의 {text}
      </span>
    );
  }
  if (exploratory) {
    return (
      <span
        data-state="exploratory"
        className="inline-flex items-center gap-1 rounded border border-dashed border-neutral-400 px-1.5 py-0.5 text-xs text-neutral-700 dark:text-neutral-300"
        title="보정 전 p<0.05 — 탐색 후보 (다중비교 보정 후 비유의)"
      >
        탐색 후보 {text}
      </span>
    );
  }
  return (
    <span data-state="null" className="tabular-nums text-neutral-700 dark:text-neutral-300">
      {text}
    </span>
  );
}
