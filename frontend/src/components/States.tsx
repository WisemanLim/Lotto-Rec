import type { ReactNode } from 'react';

export function Loading({ text = '불러오는 중…' }: { text?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-4 text-sm text-neutral-500">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700 dark:border-neutral-600 dark:border-t-neutral-200" />
      {text}
    </div>
  );
}

export function ErrorBox({ error, title = '오류' }: { error: unknown; title?: string }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
      <span className="font-semibold">{title}:</span> {msg}
    </div>
  );
}

export function Empty({ children = '데이터 없음' }: { children?: ReactNode }) {
  return <div className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">{children}</div>;
}

/** 섹션 카드 — `aside` 는 타이틀 바로 우측(헤더 좌측 그룹)에 붙는 보조 내용(S5.8 최근 당첨번호 등). */
export function Section({ title, children, right, aside, className = '' }: { title: ReactNode; children: ReactNode; right?: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        {aside ? (
          <div className="flex flex-1 flex-wrap items-start gap-3">
            <h2 className="text-base font-semibold">{title}</h2>
            {aside}
          </div>
        ) : (
          <h2 className="text-base font-semibold">{title}</h2>
        )}
        {right}
      </div>
      {children}
    </section>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <header className="mb-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      {sub && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{sub}</p>}
    </header>
  );
}

/** 폼 필드 — 라벨·입력·힌트 3줄 구조를 항상 유지(힌트 없으면 빈 줄 예약) → 그리드에서 입력창 상단 정렬 (PRD §E6 공통 UX). */
export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block h-4 text-xs font-medium leading-4 text-neutral-600 dark:text-neutral-300">{label}</span>
      {children}
      <span className="mt-0.5 block min-h-[14px] text-[11px] leading-[14px] text-neutral-500">{hint ?? '\u00a0'}</span>
    </label>
  );
}

/** Field 와 같은 줄에 버튼·체크박스를 놓기 위한 슬롯(라벨 높이만큼 위 여백, 힌트 줄 예약). */
export function FormSlot({ children, hint, className = '' }: { children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={`block text-sm ${className}`}>
      <span aria-hidden className="mb-1 block h-4" />
      <div className="flex min-h-[34px] items-center gap-3">{children}</div>
      <span className="mt-0.5 block min-h-[14px] text-[11px] leading-[14px] text-neutral-500">{hint ?? '\u00a0'}</span>
    </div>
  );
}

export const inputCls =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500';
export const btnCls =
  'inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed';
export const btnGhostCls =
  'inline-flex items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-800 disabled:opacity-50';
export const btnDangerCls =
  'inline-flex items-center rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40 disabled:opacity-50';
