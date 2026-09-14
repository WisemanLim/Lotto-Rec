import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MyNumbers from './MyNumbers';
import { RunProvider } from '../hooks/RunProvider';

// S5.7 (v1.11): 저장된 번호는 현재 대상 회차만 기본 표시. 다음 회차 추천 저장 후엔 이전 회차 번호 숨김(삭제 아님), 회차 필터로 확인.
const base = { bonus: null, scorecard: null, created_at: null, dup_count: 1, dup_labels: [], same_number_ticket_ids: [], duplicate: false };
const t1242 = [
  { ...base, ticket_id: 1, numbers: [1, 2, 3, 4, 5, 6], label: '지난 회차', target_draw_no: 1242, outcomes: [{ outcome_id: 1, draw_no: 1242, main_matches: 1, bonus_match: false, rank: null, prize_amount: 0 }] },
];
let ctx = { next_draw: 1243, latest_result_draw: 1242, active_target_draw: 1243, reason: 'next_recommended', draws: [{ target_draw_no: 1242, count: 1, evaluated: true }] };

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.includes('/user/tickets/draws')) return json(ctx);
      if (url.includes('/user/tickets')) {
        const q = new URL(url, 'http://x').searchParams.get('target_draw_no');
        return json(q === null ? t1242 : t1242.filter((t) => String(t.target_draw_no) === q));
      }
      if (url.includes('/data/summary')) return json({ max_draw: 1242 });
      if (url.includes('/analysis/runs/latest')) return new Response('{"detail":"none"}', { status: 404 });
      if (url.includes('/config')) return json({ lotto_number_recommendation_count: 10 });
      return json([]);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RunProvider>
          <MyNumbers />
        </RunProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('다음 회차 추천 저장 후: 1243회 기본 표시(빈 목록·안내), 1242회 번호는 숨김 → 회차 필터로 확인(낙첨)', async () => {
  mount();
  await waitFor(() => expect(screen.getByRole('status', { name: '현재 대상 회차 안내' })).toBeInTheDocument());
  expect(screen.getByRole('status', { name: '현재 대상 회차 안내' })).toHaveTextContent('다음 회차(1243회) 추천이 저장되어 1243회 대상 번호만 표시');
  await waitFor(() => expect(screen.getByText(/1243회 대상 저장된 번호 없음/)).toBeInTheDocument());
  expect(screen.queryByText(/지난 회차/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('대상 회차 필터'), { target: { value: '1242' } });
  await waitFor(() => expect(screen.getByText(/지난 회차/)).toBeInTheDocument());
  expect(screen.getByText(/1242회 1개 일치 · 낙첨/)).toBeInTheDocument();
  expect(screen.getByText(/저장된 번호 \(대상 1242회\)/)).toBeInTheDocument();
});

test('결과 등록 직후(다음 회차 추천 없음): 1242회 번호·낙첨 결과가 그대로 보이고 전환 안내 표시', async () => {
  ctx = { ...ctx, active_target_draw: 1242, reason: 'awaiting_next_recommendation' };
  mount();
  await waitFor(() => expect(screen.getByText(/지난 회차/)).toBeInTheDocument());
  expect(screen.getByRole('status', { name: '현재 대상 회차 안내' })).toHaveTextContent('1242회 결과가 등록되어');
  expect(screen.getByRole('status', { name: '현재 대상 회차 안내' })).toHaveTextContent('추천을 저장하면 목록이 1243회로 전환');
  ctx = { ...ctx, active_target_draw: 1243, reason: 'next_recommended' };
});
