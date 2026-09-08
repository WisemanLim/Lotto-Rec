import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Cohort } from '../api/client';
import { RunContext, isActive, type RunCtx } from './useRun';

/** 분석 run 목록 + 현재 선택 run. 진행 중 run 이 있으면 2초 폴링. */
export function RunProvider({ children }: { children: ReactNode }) {
  const [runId, setRunId] = useState<string | null>(null);
  const [cohortFilter, setCohortFilter] = useState<Cohort | 'ANY'>('ANY');
  const q = useQuery({
    queryKey: ['analysis', 'runs'],
    queryFn: () => api.analysis.runs(200),
    refetchInterval: (query) => (query.state.data?.some((r) => isActive(r.status)) ? 2000 : 30_000),
  });
  const value = useMemo<RunCtx>(() => {
    const runs = [...(q.data ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const doneAll = runs.filter((r) => r.status === 'done');
    const doneRuns = cohortFilter === 'ANY' ? doneAll : doneAll.filter((r) => r.cohort === cohortFilter);
    const run = (runId ? runs.find((r) => r.run_id === runId) : undefined) ?? doneRuns[0] ?? doneAll[0];
    return {
      runs,
      doneRuns,
      run,
      runId,
      setRunId,
      cohortFilter,
      setCohortFilter: (c) => {
        setCohortFilter(c);
        setRunId(null);
      },
      isLoading: q.isLoading,
      error: q.error,
      activeJobs: runs.filter((r) => isActive(r.status)),
      refetch: () => void q.refetch(),
    };
  }, [q, runId, cohortFilter]);
  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

