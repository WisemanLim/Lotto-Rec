import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import MyNumbers from './MyNumbers';
import { RunProvider } from '../hooks/RunProvider';

// S5.8: '저장된 번호' 헤더 — 대상 회차/시도 버튼 우측 세로 2줄, 타이틀 우측 최근 당첨번호 N회차(N = /config lotto_recent_draws ← LOTTO_RECENT_DRAWS, 표시 전용)
const RECENT_N = 3; // .env LOTTO_RECENT_DRAWS=3 가정 → /config 로 전달
const recentDraws = Array.from({ length: RECENT_N }, (_, i) => ({
  draw_no: 1241 - i,
  numbers: [1 + i, 11 + i, 21 + i, 31 + i, 41, 45].slice(0, 6),
  bonus: 7 + i,
  prize1: null,
  winners1: null,
  prize2: null,
  winners2: null,
  cohort: 'B',
}));
const drawUrls: string[] = [];
function fakeFetch(url: string) {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/user/tickets/draws')) return json({ next_draw: 1242, latest_result_draw: 1241, active_target_draw: 1242, reason: 'next_registered', draws: [{ target_draw_no: 1242, count: 1, evaluated: false }] });
  if (url.includes('/user/tickets')) return json([{ ticket_id: 1, numbers: [1, 2, 3, 4, 5, 6], bonus: null, label: null, target_draw_no: 1242, scorecard: null, created_at: null, outcomes: [] }]);
  if (url.includes('/data/draws')) {
    drawUrls.push(url);
    return json(recentDraws);
  }
  if (url.includes('/data/summary')) return json({ max_draw: 1241 });
  if (url.includes('/analysis/runs/latest')) return new Response('{"detail":"none"}', { status: 404 });
  if (url.includes('/config')) return json({ lotto_number_recommendation_count: 10, lotto_recent_draws: RECENT_N });
  return json([]);
}

beforeEach(() => {
  drawUrls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => fakeFetch(String(u))));
});
afterEach(() => vi.unstubAllGlobals());

test('타이틀 우측 최근 N회차(.env) 당첨번호 + 대상 회차/시도 버튼 우측 세로 정렬', async () => {
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
  const list = await screen.findByRole('list', { name: `최근 당첨번호 ${RECENT_N}회차` });
  const items = within(list).getAllByRole('listitem');
  expect(items).toHaveLength(RECENT_N);
  // 2열 그리드(sm 이상)로 꽉 채움, 3열 없음
  expect(list.className).toMatch(/\bgrid\b/);
  expect(list.className).toMatch(/sm:grid-cols-\[repeat\(2,max-content\)\]/);
  expect(list.className).not.toMatch(/grid-cols-3/);
  expect(items[0].className).toMatch(/whitespace-nowrap/);
  expect(items[0].textContent).toMatch(/^1241회/);
  expect(items[RECENT_N - 1].textContent).toMatch(/^1239회/);
  // 1241회: 1 11 21 31 41 45 + 보너스 7 → 공 7개
  expect(within(items[0]).getAllByText(/^(1|11|21|31|41|45|7)$/)).toHaveLength(7);
  // /config 의 회차 수로 1회만 요청(상수 5 로 선요청 없음)
  expect(drawUrls).toHaveLength(1);
  expect(drawUrls[0]).toMatch(new RegExp(`limit=${RECENT_N}`));
  expect(drawUrls[0]).toMatch(/order=desc/);
  // 헤더 좌측 그룹 = 타이틀 + 최근 당첨번호
  const heading = screen.getByRole('heading', { level: 2, name: /저장된 번호 \(대상 1242회\)/ });
  expect(heading.parentElement).toBe(list.parentElement);
  // 우측 도구: 대상 회차(1줄) → 시도 버튼(2줄), 세로 정렬
  const tools = await screen.findByLabelText('저장된 번호 도구');
  expect(tools.className).toMatch(/flex-col/);
  expect(tools.className).toMatch(/items-end/);
  const select = within(tools).getByRole('combobox', { name: '대상 회차 필터' });
  const btn = within(tools).getByRole('button', { name: '등록된 번호로 추첨 시도' });
  await waitFor(() => expect(select).toBeInTheDocument());
  expect(select.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(tools.children).toHaveLength(2);
  expect(tools.children[0]).toContainElement(select);
  expect(tools.children[1]).toBe(btn);
});
