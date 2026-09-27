import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Recommend from './Recommend';
import { RunProvider } from '../hooks/RunProvider';

// S4.13 v1.24: '추천 생성'/'추천 생성(순차)' 클릭 시 SEED 탐색 완료 여부에 따른 자동 연계.
const posts: Array<{ url: string; body: unknown }> = [];
let seedJob: Record<string, unknown> | null = null;
const recommendResponse = {
  batch_id: 'b1', target_draw_no: 1243, history_T: 1242, count: 1, seed: 1, run_id: null, policy: 'p',
  analysis_basis: { run_id_a: null, history_T: 1000, train_end_draw: 1000, winners_model_used: false, top_abs_z_numbers: [], top_lift_pairs: [], cohort_note: '' },
  sets: [{ strategy: 'hybrid', label: '하이브리드', basis: 'b', expectation: 'e', meta: {}, params_used: {}, experiment: null, tickets: [], is_control: false }],
};

function fakeFetch(url: string, init?: RequestInit) {
  const method = init?.method ?? 'GET';
  if (init?.body) posts.push({ url, body: JSON.parse(String(init.body)) });
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/recommend/strategies')) return json([{ id: 'uniform', label: '균등 무작위 (기준선)', basis: 'b', expectation: 'e' }]);
  if (method === 'POST' && /\/recommend$/.test(url)) return json(recommendResponse);
  if (method === 'POST' && /\/recommend\/sequential$/.test(url))
    return json({ sequence_id: 'seq-1', target_draw_no: 1243, strategies: ['uniform'], results: [], failed: [], total_tickets: 0 });
  if (method === 'POST' && /\/recommend\/seed-search$/.test(url)) {
    seedJob = { job_id: 'sj-1', status: 'running', target_draw_no: 1243, compare_draw_no: 1242, target_rank: 1, iterations: 0, seed: null, matched_strategy: null, matched_ticket: null, stop_reason: null, env_updated: false, max_iterations: 20000000, elapsed_seconds: 0, error: null };
    return json(seedJob);
  }
  if (method === 'GET' && /\/recommend\/seed-search\/sj-1$/.test(url)) return json(seedJob);
  if (method === 'POST' && /\/recommend\/seed-search\/sj-1\/stop$/.test(url)) {
    seedJob = { ...(seedJob as Record<string, unknown>), status: 'stopped', stop_reason: 'user' };
    return json(seedJob);
  }
  if (url.includes('/recommend/history/summary')) return json({ total_filtered: 0, total_all: 0, origin: 'user', by_origin: {}, by_strategy: {}, target_draws: [], batches: [] });
  if (url.includes('/config')) return json({ lotto_number_recommendation_count: 10, lotto_random_seed: 1 });
  if (url.includes('/validation/runs/latest')) return new Response('{"detail":"none"}', { status: 404 });
  return json([]);
}

beforeEach(() => {
  posts.length = 0;
  seedJob = null;
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

test('SEED 탐색을 시도한 적 없을 때 "추천 생성"을 누르면 탐색을 먼저 시작하고, 완료되면 그 seed 로 자동 생성한다', async () => {
  mount();
  const genBtn = await screen.findByRole('button', { name: '추천 생성' });
  fireEvent.click(genBtn);

  await waitFor(() => expect(posts.some((p) => p.url.includes('/recommend/seed-search'))).toBe(true));
  expect(posts.some((p) => /\/recommend$/.test(p.url))).toBe(false); // 아직 추천은 호출되지 않음
  await screen.findByRole('button', { name: 'SEED 대기 중…' });
  expect(screen.getByRole('button', { name: 'SEED 대기 중…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '추천 생성(순차)' })).toBeDisabled(); // 다른 생성 버튼도 대기 중 비활성

  seedJob = { ...(seedJob as Record<string, unknown>), status: 'done', iterations: 31321734, seed: 31321734, matched_strategy: 'uniform', matched_ticket: [1, 2, 3, 4, 5, 6], env_updated: true };
  await waitFor(() => expect(posts.some((p) => /\/recommend$/.test(p.url))).toBe(true));
  const call = posts.find((p) => /\/recommend$/.test(p.url));
  expect(call!.body).toMatchObject({ seed: 31321734 });
  await waitFor(() => expect(screen.getByLabelText(/^seed/)).toHaveValue(31321734));
  expect(screen.getByRole('button', { name: '추천 생성' })).not.toBeDisabled();
});

test('SEED 탐색이 이미 완료돼 있으면 "추천 생성"은 새 탐색 없이 즉시 실행된다', async () => {
  mount();
  const seedBtn = await screen.findByRole('button', { name: 'SEED 값 생성' });
  fireEvent.click(seedBtn);
  await screen.findByRole('button', { name: 'SEED 생성 중지' }); // 첫 폴링(running)이 반영될 때까지 대기
  seedJob = { ...(seedJob as Record<string, unknown>), status: 'done', iterations: 42, seed: 42, matched_strategy: 'uniform', matched_ticket: [1, 2, 3, 4, 5, 6], env_updated: true };
  await waitFor(() => expect(screen.getByLabelText(/^seed/)).toHaveValue(42));
  posts.length = 0; // 이전 seed-search 호출 기록 지움

  fireEvent.click(screen.getByRole('button', { name: '추천 생성' }));
  await waitFor(() => expect(posts.some((p) => /\/recommend$/.test(p.url))).toBe(true));
  expect(posts.some((p) => p.url.includes('/recommend/seed-search'))).toBe(false); // 재탐색 없음
  expect(posts.find((p) => /\/recommend$/.test(p.url))!.body).toMatchObject({ seed: 42 });
});

test('대기 중 "SEED 생성 중지"를 누르면 예약된 추천 생성이 취소된다', async () => {
  mount();
  const seqBtn = await screen.findByRole('button', { name: '추천 생성(순차)' });
  await waitFor(() => expect(seqBtn).not.toBeDisabled()); // 전략 목록 로드 전엔 비활성
  fireEvent.click(seqBtn);
  await waitFor(() => expect(posts.some((p) => p.url.includes('/recommend/seed-search'))).toBe(true));
  await screen.findByRole('button', { name: 'SEED 대기 중…' });
  await screen.findByRole('button', { name: 'SEED 생성 중지' }); // 첫 폴링(running)이 반영될 때까지 대기

  fireEvent.click(screen.getByRole('button', { name: 'SEED 생성 중지' }));
  await waitFor(() => expect(screen.getByRole('status', { name: 'SEED 탐색 상태' }).textContent).toMatch(/중지했습니다/));
  expect(posts.some((p) => p.url.includes('/recommend/sequential'))).toBe(false);
  expect(screen.getByRole('button', { name: '추천 생성(순차)' })).not.toBeDisabled();
});
