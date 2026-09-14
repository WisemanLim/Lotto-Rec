import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MyNumbers from './MyNumbers';
import { RunProvider } from '../hooks/RunProvider';

// S5.6: 같은 번호가 중복 등록된 저장 번호에 ★ 중복 ×n 배지 + duplicate_ticket 툴팁(정직한 해석)
const base = { bonus: null, target_draw_no: 1241, scorecard: null, created_at: null, outcomes: [] };
const tickets = [
  { ...base, ticket_id: 3, numbers: [3, 14, 21, 29, 38, 45], label: '추천 hybrid #1', dup_count: 2, dup_labels: ['추천 hybrid #1', '추천 uniform #4'], same_number_ticket_ids: [1], duplicate: true },
  { ...base, ticket_id: 2, numbers: [1, 2, 3, 4, 5, 6], label: '단일', dup_count: 1, dup_labels: ['단일'], same_number_ticket_ids: [], duplicate: false },
  { ...base, ticket_id: 1, numbers: [3, 14, 21, 29, 38, 45], label: '이전 회차', target_draw_no: 1240, dup_count: 1, dup_labels: ['이전 회차'], same_number_ticket_ids: [3], duplicate: true },
];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.includes('/user/tickets/draws')) return json({ next_draw: 1241, latest_result_draw: 1240, active_target_draw: 1241, reason: 'next_registered', draws: [{ target_draw_no: 1241, count: 2, evaluated: false }, { target_draw_no: 1240, count: 1, evaluated: true }] }); // S5.7
      if (url.includes('/user/tickets')) return json(tickets);
      if (url.includes('/data/summary')) return json({ max_draw: 1240 });
      if (url.includes('/analysis/runs/latest')) return new Response('{"detail":"none"}', { status: 404 });
      if (url.includes('/config')) return json({ lotto_number_recommendation_count: 10 });
      return json([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

test('중복 저장 번호에 ★ 배지(×n)와 duplicate_ticket 툴팁, 단일 번호에는 없음', async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RunProvider>
        <MemoryRouter>
          <MyNumbers />
        </MemoryRouter>
      </RunProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getAllByTestId('dup-badge')).toHaveLength(2));
  const badges = screen.getAllByTestId('dup-badge');
  // #3: 같은 회차 2회 병합 + 다른 회차 1건 → ×3, #1: 다른 회차 1건 → ×2
  expect(badges.map((b) => b.textContent)).toEqual(['★ 중복 ×3', '★ 중복 ×2']);
  expect(screen.getByText(/\(\+추천 uniform #4\)/)).toBeInTheDocument();
  fireEvent.mouseEnter(badges[0].closest('[role=term]')!.parentElement!);
  const tip = await screen.findByRole('tooltip');
  expect(tip).toHaveTextContent(/증거가 아니다/);
});
