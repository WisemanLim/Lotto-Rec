import Term from './Term';

interface Props {
  ok: boolean;
  okText?: string;
  badText?: string;
  text?: string;
}

/** 판정 배지 — 아이콘+텍스트 동반 (색만으로 의미 전달 금지). */
export default function VerdictBadge({ ok, okText = '균등 영가설과 일치', badText = '영가설과 불일치 신호', text }: Props) {
  const label = text ?? (ok ? okText : badText);
  return ok ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
      <span aria-hidden>✓</span> <Term id="verdict" icon>{label}</Term>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
      <span aria-hidden>!</span> <Term id="verdict" icon>{label}</Term>
    </span>
  );
}
