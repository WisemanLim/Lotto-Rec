import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { isActive, useRun } from '../hooks/useRun';
import { displayTimeZoneLabel, fmtDate, setDisplayTimeZone } from '../lib/format';
import { APP_NAME_LINES, NAV, STATUS_LABEL } from '../lib/labels';
import ThemeMenu from '../components/ThemeMenu';


function Brand({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  return (
    <span className={`block font-bold leading-tight ${size === 'lg' ? 'text-lg' : 'text-sm'}`} aria-label={APP_NAME_LINES.join(' ')}>
      <span className="block">{APP_NAME_LINES[0]}</span>
      <span className="block">{APP_NAME_LINES[1]}</span>
    </span>
  );
}

function JobProgress() {
  const { activeJobs } = useRun();
  const val = useQuery({
    queryKey: ['validation', 'runs'],
    queryFn: () => api.validation.runs(50),
    refetchInterval: (q) => (q.state.data?.some((r) => isActive(r.status)) ? 2000 : 30_000),
  });
  const activeVal = (val.data ?? []).filter((v) => isActive(v.status));
  if (activeJobs.length === 0 && activeVal.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs" aria-live="polite">
      {activeJobs.map((j) => (
        <span key={j.run_id} className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
          분석 군 {j.cohort} {j.preset} · {j.stage ?? STATUS_LABEL[j.status]}
          <progress className="h-1.5 w-24" max={1} value={j.progress} aria-label="분석 진행률" />
          {Math.round(j.progress * 100)}%
        </span>
      ))}
      {activeVal.map((v) => (
        <span key={v.validation_id} className="inline-flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-orange-500" />
          검증 · {v.stage ?? STATUS_LABEL[v.status]}
          <progress className="h-1.5 w-24" max={1} value={v.progress} aria-label="검증 진행률" />
          {Math.round(v.progress * 100)}%
        </span>
      ))}
    </div>
  );
}

function TimeZoneBadge() {
  const config = useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: Infinity });
  useEffect(() => {
    setDisplayTimeZone(config.data?.timezone);
  }, [config.data?.timezone]);
  return (
    <span className="hidden rounded border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-500 lg:inline dark:border-neutral-700" title="표시 시간대 (.env LOTTO_TIMEZONE)">
      {displayTimeZoneLabel()}
    </span>
  );
}

function RunInfo() {
  const { run, isLoading, error } = useRun();
  if (isLoading) return <span className="text-xs text-neutral-500">run 조회 중…</span>;
  if (error) return <span className="text-xs text-red-600">backend 연결 실패 — make local-all 확인</span>;
  if (!run) return <span className="text-xs text-neutral-500">완료된 분석 run 없음 — 설정/실행에서 분석을 시작하세요</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
      <span>
        <span className="text-neutral-400">현재 run</span> 군 <b>{run.cohort}</b>
      </span>
      <span>
        {run.draw_from}–{run.draw_to}회 ({run.n_draws.toLocaleString()}회)
      </span>
      <span>
        {run.preset} · B={run.mc_iterations.toLocaleString()} · α={run.alpha} · {run.correction}
      </span>
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">{STATUS_LABEL[run.status] ?? run.status}</span>
      <span className="hidden text-neutral-400 md:inline">{fmtDate(run.created_at)}</span>
    </span>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const nav = (
    <nav aria-label="주 메뉴" className="flex flex-col gap-0.5 p-3">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'}`
          }
        >
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <aside className="fixed inset-y-0 left-0 hidden w-52 border-r border-neutral-200 bg-white md:block dark:border-neutral-800 dark:bg-neutral-900">
        <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Brand />
          <div className="text-[11px] text-neutral-500">로또 6/45 통계분석 · 검증 · 추천 (local)</div>
        </div>
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-60 bg-white dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <Brand />
            </div>
            {nav}
          </aside>
        </div>
      )}
      <ThemeMenu />
      <div className="md:pl-52">
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
          <div className="flex flex-wrap items-center gap-3 px-4 py-2 pr-16">
            <button
              type="button"
              className="rounded-md border border-neutral-300 px-2 py-1 text-sm md:hidden dark:border-neutral-600"
              onClick={() => setOpen(true)}
              aria-label="메뉴 열기"
            >
              ☰
            </button>
            <span className="md:hidden">
              <Brand size="sm" />
            </span>
            <RunInfo />
            <TimeZoneBadge />
            <div className="ml-auto">
              <JobProgress />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
