import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
  if (url.includes('/data/summary')) return json({ max_draw: 1242 });
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

test('추천 이력 행의 "내 번호로 등록" 버튼이 확인 팝업 없이 POST /user/tickets 를 호출한다', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const confirmSpy = vi.fn(() => false);
  vi.stubGlobal('confirm', confirmSpy);
  const posts: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
      const url = String(u);
      if (init?.method === 'POST' && url.includes('/user/tickets')) {
        posts.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify({ ticket_id: 77, numbers: [1, 2, 3, 4, 5, 6], bonus: null, label: 'x', target_draw_no: 1241, scorecard: {}, created_at: null, outcomes: [], duplicate: true, dup_count: 2, dup_labels: ['a', 'b'], same_number_ticket_ids: [] }), {
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
  expect(confirmSpy).not.toHaveBeenCalled();
  expect(posts[0].body).toMatchObject({ numbers: [1, 2, 3, 4, 5, 6], target_draw_no: 1241 });
  expect(String((posts[0].body as { label: string }).label)).toMatch(/^추천 .*#1$/);
  await waitFor(() => expect(screen.getByText(/★ 중복/)).toBeInTheDocument());
  expect(screen.getByText(/#77 에 병합\(×2\)/)).toBeInTheDocument();
});

test('"내 번호로 자동 등록" 버튼이 필터 초기화 우측에 있고 POST /recommend/auto-register 후 결과 요약을 표시한다 (S4.10)', async () => {
  const { fireEvent } = await import('@testing-library/react');
  vi.stubGlobal('confirm', vi.fn(() => true));
  const posts: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
      const url = String(u);
      if (init?.method === 'POST' && url.includes('/recommend/auto-register')) {
        posts.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(
          JSON.stringify({
            target_draw_no: 1241, rounds: 1241, pool: 10, pick: 5, seed: 42, counts: {}, selected: [2, 4, 5, 7, 9],
            strategies: [{ strategy: 'uniform', label: '균등', batch_id: 'abcdefgh-1', n_tickets: 10, registered: [{ position: 2, rec_id: 12, ticket: [1, 2, 3, 4, 5, 6], ticket_id: 90 }], merged_duplicates: [], missing_positions: [] }],
            total_registered: 1, total_merged: 0, policy: 'p',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
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
  const group = screen.getByRole('group', { name: '추천 이력 필터' });
  const buttons = Array.from(group.querySelectorAll('button')).map((b) => b.textContent);
  expect(buttons.indexOf('내 번호로 자동 등록')).toBe(buttons.indexOf('필터 초기화') + 1);
  const autoBtn = screen.getByRole('button', { name: '내 번호로 자동 등록' });
  await waitFor(() => expect(autoBtn).toBeEnabled()); // 회차 정보·진행 예정 추천 확인 후 활성 (v1.19)
  expect(autoBtn).toHaveAttribute('title', expect.stringMatching(/1\.\.P 중 5개 무작위 추출/));
  expect(group.textContent).not.toMatch(/빈도 상위 5 위치의 전략별 최신 티켓 등록/);
  fireEvent.click(screen.getByRole('button', { name: '내 번호로 자동 등록' }));
  await waitFor(() => expect(posts.length).toBe(1));
  expect(posts[0].body).toEqual({});
  const status = await screen.findByRole('status', { name: '자동 등록 결과' });
  expect(status.textContent).toMatch(/대상 1241회/);
  expect(status.textContent).toMatch(/2, 4, 5, 7, 9/);
  expect(status.textContent).toMatch(/등록 1장/);
});

test('"추천 초기화" 버튼이 자동 등록 우측에 있고 확인 후 DELETE /recommend/history 를 호출한다 (S4.12)', async () => {
  const { fireEvent } = await import('@testing-library/react');
  const confirmSpy = vi.fn(() => true);
  vi.stubGlobal('confirm', confirmSpy);
  const dels: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
      const url = String(u);
      if (init?.method === 'DELETE' && url.includes('/recommend/history')) {
        dels.push(url);
        return new Response(JSON.stringify({ target_draw_no: 1243, deleted_recommendations: 10, deleted_outcomes: 0 }), {
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
  const group = screen.getByRole('group', { name: '추천 이력 필터' });
  const buttons = Array.from(group.querySelectorAll('button')).map((b) => b.textContent);
  expect(buttons.indexOf('추천 초기화')).toBe(buttons.indexOf('내 번호로 자동 등록') + 1);

  await waitFor(() => expect(screen.getByRole('button', { name: '추천 초기화' })).toBeEnabled());
  confirmSpy.mockReturnValueOnce(false);
  fireEvent.click(screen.getByRole('button', { name: '추천 초기화' }));
  expect(dels).toHaveLength(0); // 취소하면 호출 없음

  fireEvent.click(screen.getByRole('button', { name: '추천 초기화' }));
  await waitFor(() => expect(dels).toHaveLength(1));
  expect(dels[0]).toMatch(/\/api\/v1\/recommend\/history$/);
  const status = await screen.findByRole('status', { name: '추천 초기화 결과' });
  expect(status.textContent).toMatch(/1243회 추천 10장/);
});

test('방어(v1.19): 결과가 입력된 회차를 필터로 고르면 자동 등록 비활성, 진행 예정 회차에 추천이 없으면 초기화 비활성', async () => {
  const { fireEvent } = await import('@testing-library/react');
  let upcoming = 3;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      if (url.includes('/recommend/history/summary') && url.includes('target_draw_no=1243'))
        return new Response(JSON.stringify({ total_filtered: upcoming, total_all: 40, origin: 'user', by_origin: {}, by_strategy: {}, target_draws: [1241], batches: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
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
  const auto = screen.getByRole('button', { name: '내 번호로 자동 등록' });
  const reset = screen.getByRole('button', { name: '추천 초기화' });
  await waitFor(() => expect(auto).toBeEnabled());
  expect(reset).toBeEnabled();
  // 결과가 입력된 회차(1241) 선택 → 자동 등록 비활성 + 사유 툴팁
  fireEvent.change(screen.getByLabelText('대상 회차 필터'), { target: { value: '1241' } });
  await waitFor(() => expect(auto).toBeDisabled());
  expect(auto).toHaveAttribute('title', expect.stringMatching(/결과가 입력된 회차/));
  expect(reset).toBeEnabled(); // 초기화는 필터와 무관하게 진행 예정 회차 기준
  cleanup();
  vi.unstubAllGlobals();

  // 진행 예정 회차에 저장된 추천이 0장 → 둘 다 비활성
  upcoming = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      if (url.includes('/recommend/history/summary') && url.includes('target_draw_no=1243'))
        return new Response(JSON.stringify({ total_filtered: 0, total_all: 0, origin: 'user', by_origin: {}, by_strategy: {}, target_draws: [], batches: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return fakeFetch(url);
    }),
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <RunProvider>
          <Recommend />
        </RunProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByRole('button', { name: '추천 초기화' })).toHaveAttribute('title', expect.stringMatching(/저장된 추천이 없습니다/)));
  expect(screen.getByRole('button', { name: '추천 초기화' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '내 번호로 자동 등록' })).toBeDisabled();
});
