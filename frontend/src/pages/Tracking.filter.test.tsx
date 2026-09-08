import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Tracking from './Tracking';
import { RunProvider } from '../hooks/RunProvider';

// S8.6: 티켓 결과 필터 바 · 건수 요약 · limit/origin 파라미터 전달
const calls: string[] = [];
function fake(url: string) {
  calls.push(url);
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/tracking/outcomes/summary'))
    return json({ total_filtered: 7, total_all: 19220, origin: 'user', draw_nos: [1240, 1239], strategies: { uniform: 5, hybrid: 2 }, by_source: { recommendation: 6, user: 1 }, by_origin: { user: 20, backtest: 19200 } });
  if (url.includes('/tracking/outcomes'))
    return json([{ outcome_id: 1, source: 'recommendation', ticket_ref: 1, strategy: 'uniform', origin: 'user', draw_no: 1240, ticket: [1, 2, 3, 4, 5, 6], main_matches: 0, bonus_match: false, rank: 0, prize_amount: 0, evaluated_at: null }]);
  if (url.includes('/tracking/summary'))
    return json({ strategies: {}, comparison_vs_uniform: {}, n_outcomes: 0, pending: { max_draw_in_db: 1240, recommendations: 0, user_tickets: 0, target_draws: [] }, policy: 'p' });
  if (url.includes('/tracking/pending')) return json({ max_draw_in_db: 1240, recommendations: 0, user_tickets: 0, target_draws: [] });
  if (url.includes('/config')) return json({ lotto_number_recommendation_count: 10 });
  if (url.includes('/data/summary')) return json({ total_draws: 1240, max_draw: 1240, train_end_draw: 1000, cohort_a_count: 1000, cohort_b_count: 240, missing_draws: [], integrity: {} });
  return json([]);
}

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => fake(String(u))));
});
afterEach(() => vi.unstubAllGlobals());

test('티켓 결과 필터 바·건수 요약 렌더, limit·origin 파라미터 전달', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RunProvider>
          <Tracking />
        </RunProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole('group', { name: '티켓 결과 필터' })).toBeInTheDocument();
  expect(screen.getByLabelText('회차 필터')).toBeInTheDocument();
  expect(screen.getByLabelText('표시 개수')).toHaveValue('200');
  await waitFor(() => expect(screen.getByText(/필터 7 \/ 사용자 19,220건/)).toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('option', { name: '1240회' })).toBeInTheDocument());
  expect(calls.some((u) => /\/tracking\/outcomes\?.*limit=200/.test(u) && /origin=user/.test(u))).toBe(true);
});
