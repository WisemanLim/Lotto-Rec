import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MyNumbers from './MyNumbers';
import { RunProvider } from '../hooks/RunProvider';

// S5.5 v1.21: 추첨 개수 = .env(/config lotto_lottery_pick_count) 기본값 + 버튼 앞 입력 박스(세션 수정)
// S5.10 v1.21: 추첨 시도 결과 문구는 테두리 범례 우측 같은 줄
const tickets = Array.from({ length: 8 }, (_, i) => ({
  ticket_id: 100 - i, numbers: [1 + i, 10 + i, 20 + i, 30 + i, 40, 45], bonus: null, label: `t${i}`,
  target_draw_no: 1243, scorecard: null, created_at: null, outcomes: [],
}));
const draw = (n: number) => ({
  draw_no: n, numbers: [1, 2, 3, 4, 5, 6], bonus: 7, cohort: 'B',
  prize1: null, winners1: null, prize2: null, winners2: null, prize3: null, winners3: null, prize4: null, winners4: null, prize5: null, winners5: null,
});
let cfg: Record<string, unknown> = {};
beforeEach(() => {
  cfg = { lotto_number_recommendation_count: 10, lotto_lottery_pick_count: 3 };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.includes('/user/tickets/draws')) return json({ next_draw: 1243, latest_result_draw: 1242, active_target_draw: 1243, reason: 'next_registered', draws: [{ target_draw_no: 1243, count: 8, evaluated: false }] });
      if (url.includes('/user/tickets')) return json(tickets);
      if (url.includes('/data/draws')) return json([1242, 1241, 1240, 1239, 1238, 1237].map(draw));
      if (url.includes('/data/summary')) return json({ max_draw: 1242 });
      if (url.includes('/analysis/runs/latest')) return new Response('{"detail":"none"}', { status: 404 });
      if (url.includes('/config')) return json(cfg);
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

test('입력 박스는 추첨 시도 버튼 앞에 있고 .env 기본값(3)으로 시작, 수정하면 그 개수만큼 ★', async () => {
  mount();
  const input = (await screen.findByLabelText('추첨 선택 개수')) as HTMLInputElement;
  const btn = screen.getByRole('button', { name: '등록된 번호로 추첨 시도' });
  expect(input.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await waitFor(() => expect(input.value).toBe('3')); // config 로드 후 .env 값
  await waitFor(() => expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(8));
  fireEvent.click(btn);
  expect(await screen.findAllByRole('img', { name: '추첨 선택' })).toHaveLength(3);
  expect(screen.getByRole('status', { name: '추첨 시도 결과' }).textContent).toMatch(/1\.\.8 중 3개/);

  fireEvent.change(input, { target: { value: '6' } });
  expect(btn).toHaveAttribute('title', expect.stringMatching(/6개 무작위 추출/));
  fireEvent.click(btn);
  await waitFor(() => expect(screen.getAllByRole('img', { name: '추첨 선택' })).toHaveLength(6));
});

test('개수가 티켓 수보다 크면 min(k, N), 잘못된 값이면 버튼 비활성', async () => {
  mount();
  const input = (await screen.findByLabelText('추첨 선택 개수')) as HTMLInputElement;
  const btn = screen.getByRole('button', { name: '등록된 번호로 추첨 시도' });
  await waitFor(() => expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(8));
  fireEvent.change(input, { target: { value: '20' } });
  fireEvent.click(btn);
  await waitFor(() => expect(screen.getAllByRole('img', { name: '추첨 선택' })).toHaveLength(8));
  for (const bad of ['', '0', '51', '2.5']) {
    fireEvent.change(input, { target: { value: bad } });
    expect(btn).toBeDisabled();
  }
  fireEvent.change(input, { target: { value: '4' } });
  expect(btn).toBeEnabled();
});

test('.env 값이 없으면 기본 5', async () => {
  cfg = { lotto_number_recommendation_count: 10 };
  mount();
  const input = (await screen.findByLabelText('추첨 선택 개수')) as HTMLInputElement;
  await waitFor(() => expect(input.value).toBe('5'));
});

test('추첨 시도 결과 문구는 테두리 범례 우측 같은 줄에 있다', async () => {
  mount();
  await waitFor(() => expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(8));
  fireEvent.click(screen.getByRole('button', { name: '등록된 번호로 추첨 시도' }));
  const legend = await screen.findByLabelText('최근 6회차 출현 테두리 범례');
  const status = screen.getByRole('status', { name: '추첨 시도 결과' });
  expect(legend.parentElement).toBe(status.parentElement); // 같은 행 컨테이너
  expect(legend.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // 범례 다음(우측)
  expect(status.parentElement?.className).toMatch(/flex/);
  expect(status.className).toMatch(/ml-auto/);
});
