import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RecentDrawChips from './RecentDrawChips';

// S1.7: 과거 6회차 칩(내림차순) + 툴팁 표(당첨번호·등위별 총 당첨금·당첨게임 수·1게임당 당첨금)
const mk = (n: number, extra: object = {}) => ({
  draw_no: n, numbers: [2, 4, 10, 16, 31, 41], bonus: 9, cohort: 'B',
  prize1: null, winners1: null, prize2: null, winners2: null, prize3: null, winners3: null, prize4: null, winners4: null, prize5: null, winners5: null,
  ...extra,
});
const full = mk(1242, {
  prize1: 3281029250, winners1: 9, prize2: 47322538, winners2: 104, prize3: 1535105, winners3: 3206, winners4: 165377, winners5: 2729145,
});
const urls: string[] = [];

beforeEach(() => {
  urls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL) => {
      urls.push(String(u));
      const list = [full, ...[1241, 1240, 1239, 1238, 1237].map((n) => mk(n))];
      return new Response(JSON.stringify(list), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RecentDrawChips />
    </QueryClientProvider>,
  );
}

test('최신 6회차 번호를 내림차순 칩으로 표시하고 limit=6&order=desc 로 조회한다', async () => {
  mount();
  const list = await screen.findByRole('list', { name: '과거 6회차 요약' });
  const chips = within(list).getAllByRole('button').map((b) => b.textContent);
  expect(chips).toEqual(['1242', '1241', '1240', '1239', '1238', '1237']);
  expect(urls[0]).toMatch(/limit=6/);
  expect(urls[0]).toMatch(/order=desc/);
});

test('툴팁 표에 당첨번호와 등위별 총 당첨금·당첨게임 수·1게임당 당첨금이 있다', async () => {
  mount();
  await screen.findByRole('list', { name: '과거 6회차 요약' });
  const tip = screen.getAllByRole('tooltip', { hidden: true })[0];
  expect(tip).toHaveTextContent('1242회 당첨결과');
  const rows = within(tip).getAllByRole('row', { hidden: true });
  const cell = (r: number) => rows[r].textContent ?? '';
  expect(cell(1)).toContain('29,529,263,250원'); // 1등 총액 = 3,281,029,250 × 9
  expect(cell(1)).toContain('3,281,029,250원');
  expect(cell(2)).toContain('4,921,543,952원'); // 47,322,538 × 104
  expect(cell(3)).toContain('4,921,546,630원'); // 1,535,105 × 3,206
  expect(cell(4)).toContain('8,268,850,000원'); // 165,377 × 50,000 (고정값)
  expect(cell(5)).toContain('13,645,725,000원'); // 2,729,145 × 5,000
  expect(cell(5)).toContain('5,000원');
  // 값이 없는 회차는 '—'
  const other = screen.getAllByRole('tooltip', { hidden: true })[1];
  expect(within(other).getAllByRole('row', { hidden: true })[1]).toHaveTextContent('—');
});
