import { useEffect, useRef, useState } from 'react';
import { useTheme, type ThemeMode } from '../hooks/useTheme';

const OPTIONS: { id: ThemeMode; label: string; icon: string }[] = [
  { id: 'light', label: '라이트', icon: '☀️' },
  { id: 'dark', label: '다크', icon: '🌙' },
  { id: 'system', label: '시스템 설정', icon: '🖥️' },
];

/** 우측 상단 플로팅 테마 메뉴 (PRD §E6 공통 UX). */
export default function ThemeMenu() {
  const { mode, dark, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);
  const current = OPTIONS.find((o) => o.id === mode)!;
  return (
    <div ref={ref} className="fixed right-4 top-3 z-50" data-testid="theme-menu">
      <button
        type="button"
        aria-label={`화면 테마: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="화면 테마"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white/90 text-base shadow backdrop-blur hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800/90 dark:hover:bg-neutral-700"
      >
        <span aria-hidden>{dark ? '🌙' : '☀️'}</span>
      </button>
      {open && (
        <ul role="menu" aria-label="화면 테마 선택" className="mt-2 w-40 overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {OPTIONS.map((o) => (
            <li key={o.id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={mode === o.id}
                onClick={() => {
                  setMode(o.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 ${mode === o.id ? 'font-semibold text-blue-700 dark:text-blue-300' : ''}`}
              >
                <span aria-hidden>{o.icon}</span>
                {o.label}
                {mode === o.id && <span className="ml-auto text-xs">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
