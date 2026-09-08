import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GLOSSARY_BY_ID } from '../lib/glossary';

/**
 * 용어 툴팁 (PRD §E6 공통 UX v1.2).
 * <Term id="hypergeom">영분포</Term> — hover/focus 시 쉬운 설명 + 링크. 미등록 id 는 텍스트만 렌더.
 * icon 모드: 라벨 뒤에 (?) 아이콘만 추가.
 */
export default function Term({ id, children, icon = false, className = '' }: { id: string; children?: ReactNode; icon?: boolean; className?: string }) {
  const term = GLOSSARY_BY_ID[id];
  const [open, setOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    setFlip(typeof window !== 'undefined' && window.innerWidth - r.left < 340);
  }, [open]);
  if (!term) return <>{children ?? id}</>;
  const label = children ?? term.label;
  return (
    <span
      ref={wrap}
      className={`relative inline-flex items-center gap-0.5 ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      {icon ? (
        <>
          {label}
          <button type="button" aria-label={`${term.label} 설명`} aria-describedby={open ? tipId : undefined} className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-400 text-[10px] leading-none text-neutral-500 hover:bg-neutral-100 dark:border-neutral-500 dark:hover:bg-neutral-700" onClick={() => setOpen((o) => !o)}>
            ?
          </button>
        </>
      ) : (
        <span tabIndex={0} role="term" aria-describedby={open ? tipId : undefined} className="cursor-help underline decoration-dotted decoration-neutral-400 underline-offset-2 dark:decoration-neutral-500">
          {label}
        </span>
      )}
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className={`absolute top-full z-50 mt-1 w-80 rounded-lg border border-neutral-200 bg-white p-3 text-left text-xs font-normal normal-case leading-relaxed text-neutral-800 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 ${flip ? 'right-0' : 'left-0'}`}
        >
          <span className="mb-1 block text-[13px] font-semibold">{term.label}</span>
          <span className="block">{term.short}</span>
          {term.detail && <span className="mt-1 block text-neutral-600 dark:text-neutral-300">{term.detail}</span>}
          {(term.links?.length ?? 0) > 0 && (
            <span className="mt-2 block space-y-0.5">
              {term.links!.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="block truncate text-blue-700 underline dark:text-blue-300" onMouseDown={(e) => e.stopPropagation()}>
                  ↗ {l.label}
                </a>
              ))}
            </span>
          )}
          <Link to={`/glossary#${term.id}`} className="mt-2 block text-[11px] text-neutral-500 underline">
            용어 사전에서 보기
          </Link>
        </span>
      )}
    </span>
  );
}
