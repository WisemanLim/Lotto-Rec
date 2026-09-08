import type { Cohort } from '../api/client';
import { useRun } from '../hooks/useRun';
import { fmtDate } from '../lib/format';
import { inputCls } from './States';

const COHORTS: Array<{ v: Cohort | 'ANY'; label: string }> = [
  { v: 'ANY', label: '전체' },
  { v: 'A', label: '군 A' },
  { v: 'B', label: '군 B' },
  { v: 'ALL', label: 'A+B' },
];

/** 분석 run 선택기 — 군 필터 + 완료 run 드롭다운. */
export default function RunPicker() {
  const { doneRuns, run, setRunId, cohortFilter, setCohortFilter } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <div role="group" aria-label="군 필터" className="inline-flex overflow-hidden rounded-md border border-neutral-300 dark:border-neutral-600">
        {COHORTS.map((c) => (
          <button
            key={c.v}
            type="button"
            onClick={() => setCohortFilter(c.v)}
            className={`px-2.5 py-1 text-xs ${cohortFilter === c.v ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <select
        aria-label="분석 run 선택"
        className={`${inputCls} w-auto max-w-[28rem]`}
        value={run?.run_id ?? ''}
        onChange={(e) => setRunId(e.target.value || null)}
      >
        {doneRuns.length === 0 && <option value="">완료된 run 없음</option>}
        {doneRuns.map((r) => (
          <option key={r.run_id} value={r.run_id}>
            군 {r.cohort} · {r.draw_from}–{r.draw_to}회 · {r.preset} · B={r.mc_iterations.toLocaleString()} · {fmtDate(r.created_at)}
          </option>
        ))}
      </select>
    </div>
  );
}
