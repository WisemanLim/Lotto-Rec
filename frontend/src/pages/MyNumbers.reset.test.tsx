import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MyNumbers from './MyNumbers';
import { RunProvider } from '../hooks/RunProvider';

// S5.9 (v1.15): 내 번호 초기화 — 표시 중인 대상 회차만 삭제, '전체 회차'에서는 비활성
const base = { bonus: null, scorecard: null, created_at: null, dup_count: 1, dup_labels: [], same_number_ticket_ids: [], duplicate: false, outcomes: [] };
const ctx = {
  next_draw: 1243,
  latest_result_draw: 1242,
  active_target_draw: 1243,
  reason: 'next_registered',
  draws: [
    { target_draw_no: 1243, count: 1, evaluated: false },
    { target_draw_no: 1242, count: 1, evaluated: true },
  ],
};
const dels: string[] = [];
const confirmSpy = vi.fn(() => true);

beforeEach(() => {
  dels.length = 0;
  vi.stubGlobal('confirm', confirmSpy);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
      const url = String(u);
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      if (init?.method === 'DELETE') {
        dels.push(url);
        return json({ target_draw_no: 1243, deleted_tickets: 1, deleted_outcomes: 0 });
      }
      if (url.includes('/user/tickets/draws')) return json(ctx);
      if (url.includes('/user/tickets')) return json([{ ...base, ticket_id: 1, numbers: [1, 2, 3, 4, 5, 6], label: 'x', target_draw_no: 1243 }]);
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

test('현재 대상 회차(1243)를 확인 후 DELETE /user/tickets?target_draw_no=1243 으로 초기화한다', async () => {
  mount();
  await waitFor(() => expect(screen.getByText(/저장된 번호 \(대상 1243회\)/)).toBeInTheDocument());
  const btn = screen.getByRole('button', { name: '내 번호 초기화' });
  await waitFor(() => expect(btn).toBeEnabled());

  confirmSpy.mockReturnValueOnce(false);
  fireEvent.click(btn);
  expect(dels).toHaveLength(0);

  fireEvent.click(btn);
  await waitFor(() => expect(dels).toHaveLength(1));
  expect(dels[0]).toMatch(/\/api\/v1\/user\/tickets\?target_draw_no=1243$/);
  expect((await screen.findByRole('status', { name: '내 번호 초기화 결과' })).textContent).toMatch(/1243회 내 번호 1장/);
});

test('전체 회차를 선택하면 버튼이 비활성화된다', async () => {
  mount();
  await waitFor(() => expect(screen.getByLabelText('대상 회차 필터')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('대상 회차 필터'), { target: { value: 'all' } });
  await waitFor(() => expect(screen.getByRole('button', { name: '내 번호 초기화' })).toBeDisabled());
});

test('방어(v1.19): 결과가 입력된 회차(1242)를 선택하면 비활성 + 사유 툴팁, 호출 없음', async () => {
  mount();
  await waitFor(() => expect(screen.getByLabelText('대상 회차 필터')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('대상 회차 필터'), { target: { value: '1242' } });
  const btn = screen.getByRole('button', { name: '내 번호 초기화' });
  await waitFor(() => expect(btn).toBeDisabled());
  expect(btn).toHaveAttribute('title', expect.stringMatching(/결과가 입력된 회차/));
  fireEvent.click(btn);
  expect(dels).toHaveLength(0);
});
