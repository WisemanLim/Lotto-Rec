import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Groups from './Groups';
import { RunProvider } from '../hooks/RunProvider';

// PRD §E6 v1.2: 그룹 패턴의 "영분포/하이퍼지오메트릭/MC" 가 용어 툴팁(Term)으로 감싸져야 한다.
vi.mock('../components/PlotlyChart', () => ({ default: () => <div data-testid="plot" /> }));

const run = {
  run_id: 'r1',
  cohort: 'ALL',
  draw_from: 1,
  draw_to: 100,
  n_draws: 100,
  preset: 'quick',
  alpha: 0.05,
  correction: 'fdr_bh',
  mc_iterations: 100,
  seed: 1,
  data_hash: 'h',
  versions: {},
  status: 'done',
  progress: 1,
  stage: null,
  error: null,
  trigger: 'manual',
  created_at: '2026-01-01T00:00:00Z',
  finished_at: '2026-01-01T00:01:00Z',
};
const scheme = (kind: 'hypergeom' | 'mc') => ({
  kind,
  support: [0, 1, 2],
  observed_counts: [30, 40, 30],
  expected_counts: [31, 38, 31],
  observed_mean: 1.0,
  expected_mean: 1.0,
  chi2: 0.2,
  df: 2,
  p: 0.9,
  cells_after_merge: 3,
  null_quantiles: kind === 'mc' ? { q025: 0.9, q50: 1.0, q975: 1.1 } : undefined,
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.includes('/analysis/runs/r1/groups')) return json({ T: 100, schemes: { odd_even: scheme('hypergeom'), sum: scheme('mc') } });
      if (url.includes('/analysis/runs')) return json([run]);
      return json([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

test('그룹 패턴: 영분포 헤더에 (?) 버튼, 하이퍼지오메트릭/MC 는 role=term', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RunProvider>
          <Groups />
        </RunProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: '영분포 설명' })).toBeInTheDocument());
  const terms = screen.getAllByRole('term').map((el) => el.textContent);
  expect(terms).toContain('하이퍼지오메트릭');
  expect(terms).toContain('MC');
  expect(terms).toContain('영분포');
});
