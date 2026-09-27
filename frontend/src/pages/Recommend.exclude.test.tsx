import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Recommend from './Recommend';
import { RunProvider } from '../hooks/RunProvider';

// S4.10/S4.14 v1.28~1.29: '전략 선택' 카드 그리드의 마지막 카드('군 A 분석 가중') 우측 빈 공간에 배치된 1~45
// '제외 번호' 그리드(내 번호 평가와 동일 공 UI). 클릭한 번호는 '내 번호로 자동 등록'뿐 아니라 '추천 생성'·
// '추천 생성(순차)' 요청의 exclude_numbers 로도 전달된다(화면 상태만, 저장 없음).
const posts: Array<{ url: string; body: unknown }> = [];
const autoRegisterResponse = {
  target_draw_no: 1243, rounds: 1243, pool: 10, pick: 5, seed: 1, counts: {}, selected: [1, 3, 5, 7, 9], exclude_numbers: [9],
  strategies: [
    {
      strategy: 'uniform', label: '균등', batch_id: 'abcdefgh-1', n_tickets: 10,
      registered: [], merged_duplicates: [], missing_positions: [],
      excluded_positions: [{ position: 1, rec_id: 12, ticket: [9, 10, 11, 12, 13, 14] }],
    },
  ],
  total_registered: 0, total_merged: 0, policy: 'p',
};

function fakeFetch(url: string, init?: RequestInit) {
  const method = init?.method ?? 'GET';
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  if (method === 'POST' && url.includes('/recommend/auto-register')) {
    posts.push({ url, body: JSON.parse(String(init?.body)) });
    return json(autoRegisterResponse);
  }
  if (method === 'POST' && /\/recommend$/.test(url)) {
    posts.push({ url, body: JSON.parse(String(init?.body)) });
    return json({
      batch_id: 'b1', target_draw_no: 1243, history_T: 1242, count: 1, seed: 1, run_id: null, policy: 'p',
      analysis_basis: { run_id_a: null, history_T: 1000, train_end_draw: 1000, winners_model_used: false, top_abs_z_numbers: [], top_lift_pairs: [], cohort_note: '' },
      sets: [{ strategy: 'hybrid', label: '하이브리드', basis: 'b', expectation: 'e', meta: {}, params_used: {}, experiment: null, tickets: [], is_control: false }],
    });
  }
  if (method === 'POST' && /\/recommend\/sequential$/.test(url)) {
    posts.push({ url, body: JSON.parse(String(init?.body)) });
    return json({ sequence_id: 'seq-1', target_draw_no: 1243, strategies: ['uniform'], results: [], failed: [], total_tickets: 0 });
  }
  if (url.includes('/data/summary')) return json({ max_draw: 1242 });
  if (url.includes('/recommend/strategies'))
    return json([
      { id: 'uniform', label: '균등', basis: 'b', expectation: 'e' },
      { id: 'analysis_weighted', label: '군 A 분석 가중', basis: 'b', expectation: 'e' },
    ]);
  if (url.includes('/recommend/history/summary'))
    return json({ total_filtered: 3, total_all: 3, origin: 'user', by_origin: {}, by_strategy: {}, target_draws: [], batches: [] });
  if (url.includes('/recommend/history')) return json([]);
  if (url.includes('/config')) return json({ lotto_number_recommendation_count: 10, lotto_random_seed: 1 });
  if (url.includes('/validation/runs/latest')) return new Response('{"detail":"none"}', { status: 404 });
  return json([]);
}

beforeEach(() => {
  posts.length = 0;
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => fakeFetch(String(u), init)));
});
afterEach(() => vi.unstubAllGlobals());

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RunProvider>
          <Recommend />
        </RunProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('제외 번호 그리드는 "군 A 분석 가중" 전략 카드 뒤(같은 카드 그리드)에 있고, 클릭한 번호가 선택 표시된다', async () => {
  mount();
  const grid = await screen.findByRole('group', { name: '제외 번호 선택' });
  const lastCard = await screen.findByRole('button', { name: /군 A 분석 가중/ });
  const filterGroup = await screen.findByRole('group', { name: '추천 이력 필터' });
  // DOM 순서: 마지막 전략 카드 → 제외 번호 그리드(같은 grid 컨테이너, lg:col-span-3) → (아래) 추천 이력 필터
  expect(lastCard.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(lastCard.parentElement).toContainElement(grid); // 같은 전략 카드 그리드 컨테이너 안에 있음
  expect(grid.compareDocumentPosition(filterGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  const ball9 = screen.getByRole('button', { name: '9' });
  expect(ball9).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(ball9);
  expect(ball9).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('선택 1개: 9')).toBeInTheDocument();
});

test('선택한 제외 번호가 "내 번호로 자동 등록" 요청에 exclude_numbers 로 전달된다', async () => {
  mount();
  await screen.findByRole('group', { name: '제외 번호 선택' });
  fireEvent.click(screen.getByRole('button', { name: '9' }));
  fireEvent.click(screen.getByRole('button', { name: '23' }));
  const btn2 = screen.getByRole('button', { name: '내 번호로 자동 등록' });
  await waitFor(() => expect(btn2).toBeEnabled());
  fireEvent.click(btn2);
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0].body).toMatchObject({ exclude_numbers: [9, 23] });

  const status = await screen.findByRole('status', { name: '자동 등록 결과' });
  expect(status.textContent).toMatch(/제외 번호 \[9\]/);
  expect(status.textContent).toMatch(/제외됨 1\(#1\)/);
});

test('선택 없이 등록하면 exclude_numbers 를 보내지 않는다', async () => {
  mount();
  await screen.findByRole('group', { name: '제외 번호 선택' });
  const btn3 = screen.getByRole('button', { name: '내 번호로 자동 등록' });
  await waitFor(() => expect(btn3).toBeEnabled());
  fireEvent.click(btn3);
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0].body).not.toHaveProperty('exclude_numbers');
});

test('"지우기"를 누르면 선택이 모두 해제된다', async () => {
  mount();
  await screen.findByRole('group', { name: '제외 번호 선택' });
  fireEvent.click(screen.getByRole('button', { name: '9' }));
  fireEvent.click(screen.getByRole('button', { name: '지우기' }));
  expect(screen.getByRole('button', { name: '9' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByText(/선택 \d+개/)).not.toBeInTheDocument();
});


test('선택한 제외 번호가 "추천 생성" 요청에도 exclude_numbers 로 전달된다', async () => {
  mount();
  await screen.findByRole('group', { name: '제외 번호 선택' });
  fireEvent.click(screen.getByRole('button', { name: '9' }));
  fireEvent.click(screen.getByRole('button', { name: '추천 생성' }));
  await waitFor(() => expect(posts.some((p) => /\/recommend$/.test(p.url))).toBe(true));
  const call = posts.find((p) => /\/recommend$/.test(p.url));
  expect(call!.body).toMatchObject({ exclude_numbers: [9] });
});

test('선택한 제외 번호가 "추천 생성(순차)" 요청에도 exclude_numbers 로 전달된다', async () => {
  mount();
  await screen.findByRole('group', { name: '제외 번호 선택' });
  fireEvent.click(screen.getByRole('button', { name: '23' }));
  const seqBtn = screen.getByRole('button', { name: '추천 생성(순차)' });
  await waitFor(() => expect(seqBtn).not.toBeDisabled());
  fireEvent.click(seqBtn);
  await waitFor(() => expect(posts.some((p) => /\/recommend\/sequential$/.test(p.url))).toBe(true));
  const call = posts.find((p) => /\/recommend\/sequential$/.test(p.url));
  expect(call!.body).toMatchObject({ exclude_numbers: [23] });
});

test('추천 개수 입력란은 최대 200까지 허용한다 (v1.29)', async () => {
  mount();
  const countInput = await screen.findByRole('spinbutton', { name: /^추천 개수/ });
  expect(countInput).toHaveAttribute('max', '200');
});
