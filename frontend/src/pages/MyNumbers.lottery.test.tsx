import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MyNumbers from './MyNumbers';
import { RunProvider } from '../hooks/RunProvider';

// S5.5: '저장된 번호' 우측 '등록된 번호로 추첨 시도' → 1..N 무작위 빈도 규칙으로 5장 ★ 표시(DB 호출 없음)
const tickets = Array.from({ length: 7 }, (_, i) => ({
  ticket_id: 100 - i,
  numbers: [1 + i, 10 + i, 20 + i, 30 + i, 40, 45].sort((a, b) => a - b).slice(0, 6),
  bonus: null,
  label: `t${i}`,
  target_draw_no: 1241,
  scorecard: null,
  created_at: null,
  outcomes: [],
}));
const posts: string[] = [];
function fakeFetch(url: string, init?: RequestInit) {
  if (init?.method && init.method !== 'GET') posts.push(`${init.method} ${url}`);
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/user/tickets')) return json(tickets);
  if (url.includes('/data/summary')) return json({ max_draw: 1240 });
  if (url.includes('/analysis/runs/latest')) return new Response('{"detail":"none"}', { status: 404 });
  if (url.includes('/config')) return json({ lotto_number_recommendation_count: 10 });
  return json([]);
}

beforeEach(() => {
  posts.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => fakeFetch(String(u), init)));
});
afterEach(() => vi.unstubAllGlobals());

test('추첨 시도 버튼 → 5장에 ★, 요약 표시, 삭제 버튼 좌측, 서버 쓰기 없음', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RunProvider>
          <MyNumbers />
        </RunProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const btn = await screen.findByRole('button', { name: '등록된 번호로 추첨 시도' });
  await waitFor(() => expect(screen.getAllByRole('button', { name: '삭제' })).toHaveLength(7));
  expect(btn).toHaveAttribute('title', expect.stringMatching(/1\.\.N/));
  expect(screen.queryAllByRole('img', { name: '추첨 선택' })).toHaveLength(0);
  fireEvent.click(btn);
  const stars = await screen.findAllByRole('img', { name: '추첨 선택' });
  expect(stars).toHaveLength(5);
  for (const star of stars) {
    const next = star.nextElementSibling as HTMLElement;
    expect(next.tagName).toBe('BUTTON');
    expect(next.textContent).toBe('삭제');
  }
  const status = screen.getByRole('status', { name: '추첨 시도 결과' });
  expect(status.textContent).toMatch(/1,241회 반복\(1\.\.7 중 5개\)/);
  expect(status.textContent).toMatch(/★ 5장/);
  expect(posts).toEqual([]);
});
