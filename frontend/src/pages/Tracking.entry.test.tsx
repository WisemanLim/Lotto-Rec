import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DrawEntryForms } from './Tracking';

// S1.6 (v1.16): 직접 입력(위)·파일 업로드(아래) 상하 배치, 업로드 도구 한 줄, 1~5등 당첨게임 수·1게임당 당첨금 입력
const posts: unknown[] = [];
beforeEach(() => {
  posts.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== 'POST' && String(u).includes('/data/draws'))
        return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
      if (init?.method === 'POST') posts.push(JSON.parse(String(init.body)));
      return new Response(
        JSON.stringify({ import_id: 1, filename: 'manual', data_hash: 'h', inserted: 1, skipped_duplicate: 0, inserted_draws: [1243], conflicts: [], invalid: [], triggered_run_id: null }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DrawEntryForms />
    </QueryClientProvider>,
  );
}

test('직접 입력 폼이 파일 업로드 폼보다 위에 세로로 배치된다', () => {
  const { container } = mount();
  const direct = screen.getByRole('form', { name: '추첨 결과 직접 입력' });
  const upload = screen.getByRole('form', { name: '파일 업로드' });
  expect(direct.compareDocumentPosition(upload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(container.firstElementChild?.className).not.toMatch(/grid-cols-2/); // 좌우 2열 아님
});

test('파일 선택·덮어쓰기·업로드 버튼이 한 줄(flex-nowrap) 그룹에 있다', () => {
  mount();
  const row = screen.getByRole('group', { name: '파일 업로드 도구' });
  expect(row.className).toMatch(/flex-nowrap/);
  expect(row).toContainElement(screen.getByLabelText('적재 파일'));
  expect(row).toContainElement(screen.getByRole('button', { name: '업로드' }));
  expect(row).toHaveTextContent('충돌 회차 덮어쓰기');
});

test('1~3등은 총 당첨금÷당첨게임 수로 1게임당 당첨금을 자동계산하고, 4·5등은 고정값을 유지한다', async () => {
  mount();
  fireEvent.change(screen.getByLabelText('회차'), { target: { value: '1242' } });
  fireEvent.change(screen.getByLabelText('본번호 6개 (쉼표)'), { target: { value: '2, 4, 10, 16, 31, 41' } });
  fireEvent.change(screen.getByLabelText('보너스'), { target: { value: '9' } });
  fireEvent.change(screen.getByLabelText('1등 등위별 총 당첨금'), { target: { value: '29529263250' } });
  fireEvent.change(screen.getByLabelText('1등 당첨게임 수'), { target: { value: '9' } });
  fireEvent.change(screen.getByLabelText('3등 등위별 총 당첨금'), { target: { value: '4921546630' } });
  fireEvent.change(screen.getByLabelText('3등 당첨게임 수'), { target: { value: '3206' } });
  fireEvent.change(screen.getByLabelText('4등 당첨게임 수'), { target: { value: '165377' } });
  fireEvent.change(screen.getByLabelText('5등 당첨게임 수'), { target: { value: '2729145' } });
  // 자동 계산 표시 (읽기 전용)
  expect(screen.getByLabelText('1등 1게임당 당첨금')).toHaveValue('3,281,029,250');
  expect(screen.getByLabelText('1등 1게임당 당첨금')).toHaveAttribute('readonly');
  expect(screen.getByLabelText('3등 1게임당 당첨금')).toHaveValue('1,535,105');
  expect(screen.getByLabelText('2등 1게임당 당첨금')).toHaveValue(''); // 미입력 → 미계산
  expect(screen.getByLabelText('4등 1게임당 당첨금')).toHaveValue('50,000');
  expect(screen.getByLabelText('5등 1게임당 당첨금')).toHaveValue('5,000');
  expect(screen.getByLabelText('4등 등위별 총 당첨금')).toHaveValue('8,268,850,000'); // 165,377 × 50,000
  expect(screen.getByLabelText('5등 등위별 총 당첨금')).toHaveValue('13,645,725,000'); // 2,729,145 × 5,000
  fireEvent.click(screen.getByRole('button', { name: '결과 입력' }));
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0]).toMatchObject({
    draw_no: 1242,
    numbers: [2, 4, 10, 16, 31, 41],
    bonus: 9,
    winners1: 9,
    prize1: 3281029250,
    prize2: null,
    winners2: null,
    prize3: 1535105,
    winners3: 3206,
    prize4: 50000,
    winners4: 165377,
    prize5: 5000,
    winners5: 2729145,
  });
});

test('업로드 안내 문구는 업로드 버튼과 같은 줄(우측)에 있다', () => {
  mount();
  const row = screen.getByRole('group', { name: '파일 업로드 도구' });
  expect(row).toHaveTextContent('새 회차가 1건 이상 삽입되면');
  const btn = screen.getByRole('button', { name: '업로드' });
  const note = screen.getByText(/새 회차가 1건 이상 삽입되면/);
  expect(btn.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(note.parentElement).toBe(row);
});

test('데이터 요약 영역과 입력·업로드 영역이 패널로 구분된다', () => {
  mount();
  expect(screen.getByRole('form', { name: '추첨 결과 직접 입력' }).className).toMatch(/border/);
  expect(screen.getByRole('form', { name: '파일 업로드' }).className).toMatch(/border/);
});

test('추첨 결과 직접 입력 제목 우측에 과거 6회차 칩이 표시된다 (S1.7)', async () => {
  const mk = (n: number) => ({ draw_no: n, numbers: [1, 2, 3, 4, 5, 6], bonus: 7, cohort: 'B', prize1: null, winners1: null, prize2: null, winners2: null, prize3: null, winners3: null, prize4: null, winners4: null, prize5: null, winners5: null });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify([1242, 1241, 1240, 1239, 1238, 1237].map(mk)), { status: 200, headers: { 'content-type': 'application/json' } })),
  );
  mount();
  const list = await screen.findByRole('list', { name: '과거 6회차 요약' });
  const form = screen.getByRole('form', { name: '추첨 결과 직접 입력' });
  expect(form).toContainElement(list);
  const title = screen.getByRole('heading', { name: '추첨 결과 직접 입력' });
  expect(title.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
