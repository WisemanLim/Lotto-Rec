import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Recommend from './Recommend';
import { RunProvider } from '../hooks/RunProvider';

// S4.6: 추천 이력 필터 바 렌더 + 요약 건수 표시 + 이력 요청에 limit 파라미터 전달
const calls: string[] = [];
function fakeFetch(url: string) {
  calls.push(url);
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/recommend/strategies')) return json([{ id: 'uniform', label: '균등', basis: 'b', expectation: 'e' }]);
  if (url.includes('/recommend/history/summary'))
    return json({ total_filtered: 3, total_all: 40, origin: 'user', by_origin: { user: 40, backtest: 19200 }, by_strategy: { uniform: 40 }, target_draws: [1241], batches: [] });
  if (url.includes('/recommend/history'))
    return json([{ rec_id: 1, batch_id: 'abcdefgh-1', strategy: 'uniform', ticket: [1, 2, 3, 4, 5, 6], seed: 1, target_draw_no: 1241, scorecard: null, params: null, created_at: null }]);
  if (url.includes('/config')) return json({ lotto_number_recommendation_count: 10, lotto_random_seed: 1 });
  if (url.includes('/validation/runs/latest')) return new Response('{"detail":"none"}', { status: 404 });
  return json([]);
}

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => fakeFetch(String(u))));
});
afterEach(() => vi.unstubAllGlobals());

test('추천 이력 필터 바와 건수 요약이 표시되고 limit 이 전달된다', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RunProvider>
          <Recommend />
        </RunProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole('group', { name: '추천 이력 필터' })).toBeInTheDocument();
  expect(screen.getByLabelText('전략 필터')).toBeInTheDocument();
  expect(screen.getByLabelText('표시 개수')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/필터 3 \/ 사용자 생성 40장/)).toBeInTheDocument());
  expect(screen.getByText(/검증 replay 19,200장 별도/)).toBeInTheDocument();
  expect(screen.getByLabelText('출처 필터')).toHaveValue('user');
  expect(calls.some((u) => /\/recommend\/history\?.*limit=20/.test(u) && /origin=user/.test(u))).toBe(true);
});

test('추천 이력 행의 "내 번호로 등록" 버튼이 POST /user/tickets 를 호출한다', async () => {
  const { fireEvent } = await import('@testing-library/react');
  vi.stubGlobal('confirm', vi.fn(() => true));
  const posts: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
      const url = String(u);
      if (init?.method === 'POST' && url.includes('/user/tickets')) {
        posts.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ ticket_id: 77, numbers: [1, 2, 3, 4, 5, 6], bonus: null, label: 'x', target_draw_no: 1241, scorecard: {}, created_at: null, outcomes: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return fakeFetch(url);
    }),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RunProvider>
          <Recommend />
        </RunProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const btn = await screen.findByRole('button', { name: '내 번호로 등록 1 2 3 4 5 6' });
  fireEvent.click(btn);
  await waitFor(() => expect(posts.length).toBe(1));
  expect(posts[0].body).toMatchObject({ numbers: [1, 2, 3, 4, 5, 6], target_draw_no: 1241 });
  expect(String((posts[0].body as { label: string }).label)).toMatch(/^추천 .*#1$/);
  await waitFor(() => expect(screen.getByText(/내 번호 #77 등록됨/)).toBeInTheDocument());
});
