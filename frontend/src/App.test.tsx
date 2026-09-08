import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './hooks/ThemeProvider';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderApp(path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

test('앱 셸이 제목과 주 메뉴를 렌더한다', () => {
  renderApp();
  expect(screen.getAllByText('Lotto number').length).toBeGreaterThan(0);
  expect(screen.getAllByText('recommender').length).toBeGreaterThan(0);
  const nav = screen.getByRole('navigation', { name: '주 메뉴' });
  for (const label of ['개요', '번호 빈도', '조합 연관성', '그룹 패턴', '시간 분석', '검증 (A→B)', '추천', '내 번호', '성과 추적', '설정/실행', '용어 사전']) {
    expect(nav).toHaveTextContent(label);
  }
});

test('개요에 해석 원칙 고지가 항상 표시된다', () => {
  renderApp('/');
  expect(screen.getByRole('note')).toHaveTextContent('통계적 유의성은 예측력·조작·인과의 증거가 아니다');
});

test('추천 화면은 정책 문구를 표시한다', () => {
  renderApp('/recommend');
  expect(screen.getByText(/균등 무작위와 동일한 당첨확률/)).toBeInTheDocument();
});
