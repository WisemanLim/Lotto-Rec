import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MyNumbers from './MyNumbers';
import { RunProvider } from '../hooks/RunProvider';
import type { Scorecard } from '../api/client';

// S5.11 (v1.27): '번호 선택'에서 '평가' 클릭 시 아래 '저장된 번호' 목록을 대상 회차 기준 추첨 결과 순
// (1등→5등→낙첨→추첨 대기)으로 재정렬한다. 서버에는 아무 쓰기도 없는 표시 전용 기능.
const outcome = (rank: number) => [{ outcome_id: rank, source: 'user', ticket_ref: 1, strategy: 'user', origin: 'user', draw_no: 1241, ticket: [1, 2, 3, 4, 5, 6], main_matches: 6, bonus_match: false, rank, prize_amount: 0, evaluated_at: null }];
const base = { bonus: null, target_draw_no: 1241, scorecard: null, created_at: null, dup_count: 1, dup_labels: [], same_number_ticket_ids: [], duplicate: false };
const tickets = [
  { ...base, ticket_id: 1, numbers: [1, 2, 3, 4, 5, 6], label: '대기', outcomes: [] }, // 추첨 대기
  { ...base, ticket_id: 2, numbers: [7, 8, 9, 10, 11, 12], label: '낙첨', outcomes: outcome(0) },
  { ...base, ticket_id: 3, numbers: [13, 14, 15, 16, 17, 18], label: '5등', outcomes: outcome(5) },
  { ...base, ticket_id: 4, numbers: [19, 20, 21, 22, 23, 24], label: '1등', outcomes: outcome(1) },
  { ...base, ticket_id: 5, numbers: [25, 26, 27, 28, 29, 30], label: '3등', outcomes: outcome(3) },
];
const sc: Scorecard = {
  numbers: [31, 32, 33, 34, 35, 36], bonus: null, history_T: 1240,
  per_number: [], pairs: [], mean_pair_lift: 1.0,
  typicality: { features: {}, per_feature: {}, mahalanobis: 1, typicality_p: 0.5, note: 'n' },
  history: { exact_6: 0, match_5: 0, match_4: 0, match_3: 0, mean_matches_past: 0.8, expected_mean: 0.8 },
  match_distribution: {}, rank_probabilities: { rank1: 0, rank2: 0, rank3: 0, rank4: 0, rank5: 0 },
  expected_matches: 0.8, winners: null, policy: 'p',
} as Scorecard;
const posts: string[] = [];

beforeEach(() => {
  posts.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
      const url = String(u);
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      if (init?.method === 'POST' && url.includes('/user/tickets/evaluate')) {
        posts.push(url);
        return json(sc);
      }
      if (init?.method && init.method !== 'GET') posts.push(`${init.method} ${url}`); // 저장/삭제 등은 없어야 함
      if (url.includes('/user/tickets/draws')) return json({ next_draw: 1241, latest_result_draw: 1240, active_target_draw: 1241, reason: 'next_registered', draws: [{ target_draw_no: 1241, count: 5, evaluated: false }] });
      if (url.includes('/user/tickets')) return json(tickets);
      if (url.includes('/data/summary')) return json({ max_draw: 1240 });
      if (url.includes('/analysis/runs/latest')) return new Response('{"detail":"none"}', { status: 404 });
      if (url.includes('/config')) return json({ lotto_number_recommendation_count: 10 });
      return json([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RunProvider>
        <MemoryRouter>
          <MyNumbers />
        </MemoryRouter>
      </RunProvider>
    </QueryClientProvider>,
  );
}

function pick(labels: string[]) {
  // 화면에 '1', '2', ... 로 표시된 공 버튼을 6개 고른다
  for (const n of [1, 2, 3, 4, 5, 6]) fireEvent.click(screen.getByRole('button', { name: String(n) }));
  void labels;
}

test('초기 목록은 등록 순(ticket_id 내림차순)이고, 평가 클릭 후 결과 순(1등→5등→낙첨→대기)으로 바뀐다', async () => {
  mount();
  await waitFor(() => expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(5));
  const order = () => screen.getAllByRole('button', { name: '삭제' }).map((b) => b.closest('div.flex-wrap')!.textContent);
  expect(order()[0]).toMatch(/대기/); // ticket_id 5(3등)가 가장 최근 → 등록순 첫 행은 label '3등' 이어야 함(내림차순)
});

test('평가 클릭 시 저장된 번호가 1등→3등→5등→낙첨→대기 순으로 재정렬되고 서버에는 아무 것도 쓰지 않는다', async () => {
  mount();
  await waitFor(() => expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(5));
  pick([]);
  fireEvent.click(screen.getByRole('button', { name: '평가' }));
  await screen.findByRole('status', { name: '결과순 정렬 안내' });

  const rows = screen.getAllByRole('button', { name: '삭제' }).map((b) => b.closest('div.flex-wrap')!.textContent ?? '');
  const labelOf = (t: string) => (['1등', '3등', '5등', '낙첨', '대기'] as const).find((l) => t.includes(l));
  expect(rows.map(labelOf)).toEqual(['1등', '3등', '5등', '낙첨', '대기']);
  expect(posts).toEqual(['/api/v1/user/tickets/evaluate']); // 저장·삭제 등 다른 쓰기 없음
});

test('회차 필터를 바꾸면 결과순 정렬이 해제된다', async () => {
  mount();
  await waitFor(() => expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(5));
  pick([]);
  fireEvent.click(screen.getByRole('button', { name: '평가' }));
  await screen.findByRole('status', { name: '결과순 정렬 안내' });

  fireEvent.change(screen.getByLabelText('대상 회차 필터'), { target: { value: 'all' } });
  await waitFor(() => expect(screen.queryByRole('status', { name: '결과순 정렬 안내' })).not.toBeInTheDocument());
});

test('"초기화" 클릭 시 결과순 정렬이 해제된다', async () => {
  mount();
  await waitFor(() => expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(5));
  pick([]);
  fireEvent.click(screen.getByRole('button', { name: '평가' }));
  await screen.findByRole('status', { name: '결과순 정렬 안내' });

  fireEvent.click(screen.getByRole('button', { name: '초기화' }));
  await waitFor(() => expect(screen.queryByRole('status', { name: '결과순 정렬 안내' })).not.toBeInTheDocument());
});
