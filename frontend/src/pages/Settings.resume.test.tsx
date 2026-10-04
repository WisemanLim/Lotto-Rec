import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Settings from './Settings';
import { RunProvider } from '../hooks/RunProvider';

// S2.14: 서버 재기동으로 중단된(interrupted) 분석 run — '중단됨' 표시 + '이어서 실행' 버튼 → POST /resume
const calls: { url: string; method: string }[] = [];
const RUN = {
  run_id: 'aaaaaaaa-1111-2222-3333-444444444444', cohort: 'ALL', draw_from: 1, draw_to: 1244, n_draws: 1244, preset: 'quick',
  alpha: 0.05, correction: 'fdr_bh', mc_iterations: 10000, seed: 2613857, data_hash: 'h', versions: {},
  status: 'interrupted', progress: 0.25, stage: '서버 재기동으로 중단됨 — 이어서 실행 가능', error: null, trigger: 'auto_import',
  created_at: '2026-10-04T05:10:37+00:00', finished_at: null, diff_summary: null,
};
function fake(url: string, init?: RequestInit) {
  calls.push({ url, method: init?.method ?? 'GET' });
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/resume')) return json({ ...RUN, status: 'pending', stage: 'resume' });
  if (url.includes('/analysis/runs')) return json([RUN]);
  if (url.includes('/config')) return json({ lotto_auto_resume_runs: false, mc_iterations: { quick: 10000 } });
  if (url.includes('/data/summary')) return json({ total_draws: 1244, max_draw: 1244, train_end_draw: 1000, cohort_a_count: 1000, cohort_b_count: 244, missing_draws: [], integrity: { contiguous: true, all_sorted: true, invalid_rows: [] } });
  return json([]);
}

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => fake(String(u), init)));
});
afterEach(() => vi.unstubAllGlobals());

test("중단된 run 은 '중단됨 · 25% 에서 멈춤' 과 '이어서 실행' 버튼을 보여주고, 클릭 시 resume API 를 호출한다", async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RunProvider>
          <Settings />
        </RunProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const btn = await screen.findByRole('button', { name: '이어서 실행' });
  expect(screen.getByText('중단됨')).toBeInTheDocument();
  expect(screen.getByText('25% 에서 멈춤')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '삭제' })).toBeEnabled(); // 중단된 run 은 삭제 가능
  fireEvent.click(btn);
  await waitFor(() =>
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith(`/api/v1/analysis/runs/${RUN.run_id}/resume`))).toBe(true),
  );
});
