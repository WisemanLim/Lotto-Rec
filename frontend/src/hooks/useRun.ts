import { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Cohort, type RunMeta, type Section } from '../api/client';

export interface RunCtx {
  runs: RunMeta[];
  doneRuns: RunMeta[];
  run: RunMeta | undefined;
  runId: string | null;
  setRunId: (id: string | null) => void;
  cohortFilter: Cohort | 'ANY';
  setCohortFilter: (c: Cohort | 'ANY') => void;
  isLoading: boolean;
  error: unknown;
  activeJobs: RunMeta[];
  refetch: () => void;
}

export const RunContext = createContext<RunCtx | null>(null);

export function isActive(status: string) {
  return status === 'running' || status === 'pending';
}

export function useRun(): RunCtx {
  const v = useContext(RunContext);
  if (!v) throw new Error('RunProvider 밖에서 useRun 호출');
  return v;
}

/** 현재 선택 run 의 섹션 데이터. */
export function useSection<T>(section: Section, runIdOverride?: string | null) {
  const { run } = useRun();
  const id = runIdOverride ?? run?.run_id ?? null;
  return useQuery({
    queryKey: ['analysis', 'section', id, section],
    queryFn: () => api.analysis.section<T>(id!, section),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
