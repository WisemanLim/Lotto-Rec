import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Recommend from './Recommend';
import { RunProvider } from '../hooks/RunProvider';

// S4.11 (v1.12): '추천 생성' 우측 '추천 생성(순차)' → POST /recommend/sequential (모든 전략, control 미포함) → 전략별 결과 섹션 + 요약
const calls: Array<{ url: string; body: unknown }> = [];
const basis = { run_id_a: null, history_T: 1000, train_end_draw: 1000, winners_model_used: false, top_abs_z_numbers: [], top_lift_pairs: [], cohort_note: '' };
const result = (strategy: string, label: string, batch: string) => ({
  batch_id: batch, target_draw_no: 1242, history_T: 1241, count: 2, seed: 1, run_id: null, policy: 'p', analysis_basis: basis,
  sets: [{ strategy, label, basis: 'b', expectation: 'e', meta: {}, params_used: {}, experiment: null, tickets: [], is_control: false }],
});
// v1.26: '추천 생성(순차)' 은 'seed 신규' 체크박스가 기본 해제이므로 SEED 탐색 없이 곧바로 sequential 을 호출한다.
function fakeFetch(url: string, init?: RequestInit) {
  calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/recommend/strategies')) return json([{ id: 'uniform', label: '균등 무작위 (기준선)', basis: 'b', expectation: 'e' }, { id: 'hybrid', label: '하이브리드', basis: 'b', expectation: 'e' }]);
  if (url.includes('/recommend/sequential'))
    return json({ sequence_id: 'seq12345-x', target_draw_no: 1242, strategies: ['uniform', 'hybrid'], results: [result('uniform', '균등 무작위 (기준선)', 'b1'), result('hybrid', '하이브리드', 'b2')], failed: [{ strategy: 'nope', error: '알 수 없는 전략' }], total_tickets: 4 });
  if (url.includes('/recommend/history/summary')) return json({ total_filtered: 0, total_all: 0, origin: 'user', by_origin: {}, by_strategy: {}, target_draws: [], batches: [] });
  if (url.includes('/config')) return json({ lotto_number_recommendation_count: 10, lotto_random_seed: 1 });
  if (url.includes('/validation/runs/latest')) return new Response('{"detail":"none"}', { status: 404 });
  return json([]);
}
beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => fakeFetch(String(u), init)));
});
afterEach(() => vi.unstubAllGlobals());

test('"추천 생성(순차)" 버튼이 "추천 생성" 우측에 있고 클릭 시 sequential 호출 → 전략별 결과 섹션·요약(실패 포함)', async () => {
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
  const seqBtn = await screen.findByRole('button', { name: '추천 생성(순차)' });
  const genBtn = screen.getByRole('button', { name: '추천 생성' });
  expect(genBtn.compareDocumentPosition(seqBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(genBtn.parentElement).toBe(seqBtn.parentElement);
  expect(genBtn.parentElement!.className).toMatch(/flex-nowrap/); // 한 줄 배치 (v1.12.1)
  expect(genBtn.parentElement!.className).not.toMatch(/flex-wrap/);
  await waitFor(() => expect(seqBtn).not.toBeDisabled());
  fireEvent.click(seqBtn);
  await waitFor(() => expect(screen.getByRole('status', { name: '순차 생성 요약' })).toBeInTheDocument());
  expect(calls.some((c) => c.url.includes('/recommend/seed-search'))).toBe(false); // 'seed 신규' 미체크 → 탐색 없음
  const call = calls.find((c) => c.url.includes('/recommend/sequential'));
  expect(call).toBeTruthy();
  expect(call!.body).toMatchObject({ save: true, count: 10 });
  expect(call!.body).not.toHaveProperty('include_control');
  expect(call!.body).not.toHaveProperty('strategy');
  expect(screen.getByRole('status', { name: '순차 생성 요약' })).toHaveTextContent('2전략 · 4장 · 대상 1242회');
  expect(screen.getByRole('status', { name: '순차 생성 요약' })).toHaveTextContent('실패 1');
  expect(screen.getByText(/순차 1\/2 · 균등 무작위 \(기준선\) — 대상 1242회/)).toBeInTheDocument();
  expect(screen.getByText(/순차 2\/2 · 하이브리드 — 대상 1242회/)).toBeInTheDocument();
});
