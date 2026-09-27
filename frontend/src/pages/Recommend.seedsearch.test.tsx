import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Recommend from './Recommend';
import { RunProvider } from '../hooks/RunProvider';

// S4.13 (v1.22): 추천 생성 폼 'SEED 값 생성' — 대상 회차 직전 실제 회차 1등 번호 기준 무작위 탐색.
// 필드 순서: 추천 개수 → seed → 희망 등수 → SEED 값 생성/중지 → 티켓 간 최대 공유 번호 → 균등 기준선 → 저장 → 추천 생성/순차.
const posts: Array<{ url: string; body: unknown }> = [];
let jobState: Record<string, unknown> = {};

function fakeFetch(url: string, init?: RequestInit) {
  const method = init?.method ?? 'GET';
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/recommend/strategies')) return json([{ id: 'uniform', label: '균등 무작위 (기준선)', basis: 'b', expectation: 'e' }]);
  if (url.includes('/recommend/history/summary')) return json({ total_filtered: 0, total_all: 0, origin: 'user', by_origin: {}, by_strategy: {}, target_draws: [], batches: [] });
  if (url.includes('/config')) return json({ lotto_number_recommendation_count: 10, lotto_random_seed: 1 });
  if (url.includes('/validation/runs/latest')) return new Response('{"detail":"none"}', { status: 404 });
  if (method === 'POST' && /\/recommend\/seed-search$/.test(url)) {
    posts.push({ url, body: JSON.parse(String(init?.body)) });
    jobState = { job_id: 'job-1', status: 'running', target_draw_no: 1243, compare_draw_no: 1242, target_rank: 1, iterations: 0, seed: null, matched_strategy: null, matched_ticket: null, stop_reason: null, max_iterations: 20000000, elapsed_seconds: 0, error: null };
    return json(jobState);
  }
  if (method === 'GET' && /\/recommend\/seed-search\/job-1$/.test(url)) return json(jobState);
  if (method === 'POST' && /\/recommend\/seed-search\/job-1\/stop$/.test(url)) {
    jobState = { ...jobState, status: 'stopped', stop_reason: 'user' };
    return json(jobState);
  }
  return json([]);
}

beforeEach(() => {
  posts.length = 0;
  jobState = {};
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

test('필드 순서가 추천개수→seed→희망등수→SEED버튼→티켓간최대공유번호 이다', async () => {
  mount();
  await screen.findByRole('button', { name: 'SEED 값 생성' });
  const form = screen.getByLabelText(/^추천 개수/).closest('form') as HTMLFormElement;
  const labels = Array.from(form.querySelectorAll('label, button')).map((el) => el.textContent);
  const idxCount = labels.findIndex((t) => t?.includes('추천 개수'));
  const idxSeed = labels.findIndex((t) => t?.includes('seed'));
  const idxRank = labels.findIndex((t) => t?.includes('희망 등수'));
  const idxSeedBtn = labels.findIndex((t) => t === 'SEED 값 생성');
  const idxShared = labels.findIndex((t) => t?.includes('티켓 간 최대 공유 번호'));
  expect(idxCount).toBeGreaterThanOrEqual(0);
  expect(idxCount).toBeLessThan(idxSeed);
  expect(idxSeed).toBeLessThan(idxRank);
  expect(idxRank).toBeLessThan(idxSeedBtn);
  expect(idxSeedBtn).toBeLessThan(idxShared);
});

test('희망 등수 기본값은 1등(6개 일치)이고 클릭 시 target_rank 를 포함해 탐색을 시작한다', async () => {
  mount();
  await screen.findByRole('button', { name: 'SEED 값 생성' });
  expect(screen.getByLabelText('희망 등수')).toHaveValue('1');
  fireEvent.click(screen.getByRole('button', { name: 'SEED 값 생성' }));
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0].body).toEqual({ target_rank: 1 });
});

test('탐색 시작 후 버튼이 "SEED 생성 중지"로 바뀌고, 진행 상태를 폴링해 표시하다가 완료 시 seed 입력칸을 채운다', async () => {
  mount();
  const btn = await screen.findByRole('button', { name: 'SEED 값 생성' });
  fireEvent.click(btn);
  await screen.findByRole('button', { name: 'SEED 생성 중지' });
  const status = await screen.findByRole('status', { name: 'SEED 탐색 상태' });
  expect(status.textContent).toMatch(/SEED 탐색 중/);
  expect(status.textContent).toMatch(/1243회 vs 직전 1242회/);

  jobState = { ...jobState, status: 'done', iterations: 12345, seed: 12345, matched_strategy: 'uniform', matched_ticket: [1, 2, 3, 4, 5, 6] };
  await waitFor(() => expect(screen.getByRole('spinbutton', { name: /^seed/ })).toHaveValue(12345));
  await waitFor(() => expect(screen.getByRole('status', { name: 'SEED 탐색 상태' }).textContent).toMatch(/완료 — 12,345회 만에/));
  expect(screen.getByRole('button', { name: 'SEED 값 생성' })).toBeInTheDocument();
});

test('진행 중 다시 누르면 중지 요청을 보내고 중지 사유를 표시한다', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'SEED 값 생성' }));
  const stopBtn = await screen.findByRole('button', { name: 'SEED 생성 중지' });
  fireEvent.click(stopBtn);
  await waitFor(() => expect(screen.getByRole('status', { name: 'SEED 탐색 상태' }).textContent).toMatch(/중지했습니다/));
  expect(screen.getByRole('button', { name: 'SEED 값 생성' })).toBeInTheDocument();
});

test('etraget_rank 를 바꾸면 시작 요청에 반영된다', async () => {
  mount();
  await screen.findByRole('button', { name: 'SEED 값 생성' });
  fireEvent.change(screen.getByLabelText('희망 등수'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'SEED 값 생성' }));
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0].body).toEqual({ target_rank: 5 });
});

test('SEED 값 생성 버튼은 균등 기준선 체크박스보다 앞, 추천 생성 버튼보다 앞에 있다', async () => {
  mount();
  const seedBtn = await screen.findByRole('button', { name: 'SEED 값 생성' });
  const genBtn = screen.getByRole('button', { name: '추천 생성' });
  expect(seedBtn.compareDocumentPosition(genBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('레이아웃(v1.23): 폼이 flex-wrap 컴팩트 배치이고 체크박스 라벨이 줄바꿈되지 않는다', async () => {
  mount();
  await screen.findByRole('button', { name: 'SEED 값 생성' });
  const form = screen.getByLabelText(/^추천 개수/).closest('form') as HTMLFormElement;
  expect(form.className).toMatch(/flex flex-wrap/);
  expect(form.className).not.toMatch(/grid/);
  expect(form.className).toMatch(/gap-x-2/);
  const labelEls = Array.from(form.querySelectorAll('label'));
  const uniformLabel = labelEls.find((l) => l.textContent?.includes('동시 생성')) as HTMLElement;
  expect(uniformLabel.className).toMatch(/whitespace-nowrap/);
  const saveLabel = labelEls.find((l) => l.textContent?.includes('저장 (성과 추적)')) as HTMLElement;
  expect(saveLabel.className).toMatch(/whitespace-nowrap/);
});

test('레이아웃(v1.25): "추천 생성(순차)" 버튼 묶음이 폼 행의 우측 끝에 맞춰진다(margin-left: auto)', async () => {
  mount();
  await screen.findByRole('button', { name: 'SEED 값 생성' });
  const genBtn = screen.getByRole('button', { name: '추천 생성' });
  const buttonGroup = genBtn.closest('.ml-auto') as HTMLElement | null;
  expect(buttonGroup).not.toBeNull();
  expect(buttonGroup!.className).toMatch(/ml-auto/);
  expect(buttonGroup).toContainElement(screen.getByRole('button', { name: '추천 생성(순차)' }));
});
