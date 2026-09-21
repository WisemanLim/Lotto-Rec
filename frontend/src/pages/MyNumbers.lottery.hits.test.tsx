import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MyNumbers from './MyNumbers';
import { RunProvider } from '../hooks/RunProvider';

// S5.10: 추첨 시도 후 ★ 티켓 상단 정렬 + 최근 6회차 1등 본번호 출현 횟수 테두리 (★ 티켓에만)
const tickets = Array.from({ length: 7 }, (_, i) => ({
  ticket_id: 100 - i,
  numbers: [11, 13, 19, 22, 28, 31],
  bonus: null,
  label: `t${i}`,
  target_draw_no: 1243,
  scorecard: null,
  created_at: null,
  outcomes: [],
}));
const mk = (draw_no: number, numbers: number[], bonus: number) => ({
  draw_no, numbers, bonus, cohort: 'B',
  prize1: null, winners1: null, prize2: null, winners2: null, prize3: null, winners3: null, prize4: null, winners4: null, prize5: null, winners5: null,
});
const recent = [
  mk(1242, [2, 4, 10, 16, 31, 41], 9),
  mk(1241, [7, 13, 16, 23, 24, 43], 9),
  mk(1240, [11, 13, 19, 20, 31, 44], 27),
  mk(1239, [11, 13, 22, 32, 33, 36], 8),
  mk(1238, [2, 13, 18, 32, 38, 42], 22),
  mk(1237, [10, 20, 23, 34, 37, 40], 36),
];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.includes('/user/tickets/draws')) return json({ next_draw: 1243, latest_result_draw: 1242, active_target_draw: 1243, reason: 'next_registered', draws: [{ target_draw_no: 1243, count: 7, evaluated: false }] });
      if (url.includes('/user/tickets')) return json(tickets);
      if (url.includes('/data/draws')) return json(recent);
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

test('★ 티켓이 상단에 정렬되고 ★ 티켓의 번호에만 출현 횟수 테두리가 표시된다', async () => {
  mount();
  const btn = await screen.findByRole('button', { name: '등록된 번호로 추첨 시도' });
  await waitFor(() => expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(7));
  fireEvent.click(btn);
  await screen.findAllByRole('img', { name: '추첨 선택' });

  // 각 행 = '삭제' 버튼을 가진 카드. 앞 5행은 ★, 뒤 2행은 ★ 없음
  const rows = screen.getAllByRole('button', { name: '삭제' }).map((b) => b.closest('div.flex-wrap') as HTMLElement);
  const starred = rows.map((r) => within(r).queryByRole('img', { name: '추첨 선택' }) !== null);
  expect(starred).toEqual([true, true, true, true, true, false, false]);

  // 최근 6회차 출현 횟수: 11→2, 13→4, 19→1, 22→1, 31→2, 28→0
  const hits = (row: HTMLElement, n: number) => within(row).getByLabelText(String(n)).getAttribute('data-hits');
  expect(hits(rows[0], 11)).toBe('2');
  expect(hits(rows[0], 13)).toBe('4');
  expect(hits(rows[0], 19)).toBe('1');
  expect(hits(rows[0], 22)).toBe('1');
  expect(hits(rows[0], 31)).toBe('2');
  expect(hits(rows[0], 28)).toBeNull(); // 출현 없음 → 테두리 없음
  expect((within(rows[0]).getByLabelText('11') as HTMLElement).style.boxShadow).not.toBe('');
  expect(within(rows[0]).getByLabelText('11')).toHaveAttribute('title', expect.stringMatching(/최근 6회차 1등 번호에 2회 출현/));
  // ★ 아닌 티켓은 테두리 없음
  expect(hits(rows[6], 11)).toBeNull();
  expect((within(rows[6]).getByLabelText('11') as HTMLElement).style.boxShadow).toBe('');
  // 범례
  expect(screen.getByLabelText('최근 6회차 출현 테두리 범례')).toHaveTextContent('6회');
});

test('추첨 시도 전에는 테두리·범례가 없다', async () => {
  mount();
  await waitFor(() => expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(7));
  expect(screen.queryByLabelText('최근 6회차 출현 테두리 범례')).not.toBeInTheDocument();
  expect(document.querySelectorAll('[data-hits]')).toHaveLength(0);
});
