import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import CrossDraw from './CrossDraw';
import { RunProvider } from '../hooks/RunProvider';

// PRD S2.13 (v1.10): 회차간 교차 공출현 화면 — 창/lag 선택, 경계 회차 안내, 상위 셀 표, 경보.
vi.mock('../components/PlotlyChart', () => ({ default: () => <div data-testid="plot" /> }));

const run = {
  run_id: 'r1', cohort: 'ALL', draw_from: 1, draw_to: 100, n_draws: 100, preset: 'quick', alpha: 0.05, correction: 'fdr_bh',
  mc_iterations: 100, seed: 1, data_hash: 'h', versions: {}, status: 'done', progress: 1, stage: null, error: null, trigger: 'manual',
  created_at: '2026-01-01T00:00:00Z', finished_at: '2026-01-01T00:01:00Z',
};
const N = 45;
const zeros = () => Array.from({ length: N }, () => Array.from({ length: N }, () => 0));
const row = (prev: number, next: number, z: number, sig = false) => ({
  prev, next, observed: 10, expected: 1.7, expected_cond: 1.8, lift: 5.8, cond_lift: 5.5, z, p: sig ? 1e-6 : 0.3, p_holm: sig ? 1e-3 : 1, q_bh: sig ? 1e-3 : 0.9, q_by: 1, sig_bh: sig, p_maxT: sig ? 0.004 : 0.8, sig_fwer: sig,
});
const block = (nPairs: number, maxCell: [number, number], pMaxT: number, rows: ReturnType<typeof row>[]) => ({
  summary: { n_pairs: nPairs, n_cells: N * N, expected: nPairs * (4 / 225), max_abs_z: Math.abs(rows[0].z), max_cell: maxCell, max_cell_p_maxT: pMaxT, n_sig_bh: rows.filter((r) => r.sig_bh).length, n_sig_by: 0, n_sig_fwer: rows.filter((r) => r.sig_fwer).length, n_raw_p05: 100, expected_false_positives_raw: 101.25, repeat: { observed: 80, expected: 79.2, expected_cond: 80.5, z: -0.1 } },
  rows, matrix: zeros(), z_matrix: zeros(),
});
const section = {
  T: 100, N, max_lag: 2, p_cell: 4 / 225, cell_semantics: 's', statistic: 'cond z',
  window: { ...block(197, [1, 6], 0.004, [row(1, 6, 9.1, true), row(2, 3, 1.2)]), lags: [1, 2] },
  lags: [
    { ...block(99, [1, 6], 0.004, [row(1, 6, 8.2, true)]), lag: 1, draw_pairs: { first: [1, 2], last: [99, 100] } },
    { ...block(98, [7, 7], 0.7, [row(7, 7, 2.1)]), lag: 2, draw_pairs: { first: [1, 3], last: [98, 100] } },
  ],
  any_lag: { max_abs_z: 8.2, lag: 1, cell: [1, 6], p_maxT: 0.004, n_tests: 2 * N * N },
  coverage: { draw_from: 1, draw_to: 100, max_lag: 2, effective_max_lag: 2, n_draws_partial_head: 2, n_draws_partial_tail: 2, partial_head: [{ draw_no: 1, as_next: 0 }, { draw_no: 2, as_next: 1 }], partial_tail: [{ draw_no: 99, as_prev: 1 }, { draw_no: 100, as_prev: 0 }], note: '경계 회차는 제외하지 않고 간격 안에 존재하는 전/후 쌍만 센다 (lag ℓ 쌍 수 = T−ℓ).' },
  alerts: ['회차간 교차 창(1..2) 최대 셀 FWER 유의'],
  note: 'n',
};

let envLag = 2;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (u: RequestInfo | URL) => {
      const url = String(u);
      const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.includes('/analysis/runs/r1/cross_draw')) return json(section);
      if (url.includes('/analysis/runs')) return json([run]);
      if (url.includes('/config')) return json({ lotto_cross_draw_lag: envLag });
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
          <CrossDraw />
        </RunProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

test('회차간 연관성: 경보·창 KPI·경계 회차 안내·상위 셀 표(전→후, 재출현 표기)', async () => {
  mount();
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(screen.getByRole('alert')).toHaveTextContent('회차간 교차 창(1..2) 최대 셀 FWER 유의');
  expect(screen.getByText('1..2')).toBeInTheDocument(); // 간격 KPI
  expect(screen.getAllByText(/1 → 6/).length).toBeGreaterThan(0);
  expect(screen.getByText(/앞 2회차\(1, 2\)·뒤 2회차\(99, 100\)/)).toBeInTheDocument();
  expect(screen.getByText(/상위 셀 \(창 합산, 전체 2,025셀\)/)).toBeInTheDocument();
  expect(screen.getAllByText(/197/).length).toBeGreaterThan(0); // 창 쌍 수 = 99 + 98 (KPI·lag 표)
});

test('lag 선택 시 해당 lag 표·쌍 수로 전환 (재출현 셀 표기)', async () => {
  mount();
  await waitFor(() => expect(screen.getByLabelText('lag 선택')).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('lag 선택'), { target: { value: '2' } });
  await waitFor(() => expect(screen.getByText(/상위 셀 \(lag 2, \|z\| 상위 1\)/)).toBeInTheDocument());
  expect(screen.getAllByText(/7 → 7 \(재출현\)/).length).toBeGreaterThan(0);
});

test('설정 L 과 run L 불일치 시 안내(v1.11.1), 일치 시 안내 없음 · KPI 에 설정 L 표시', async () => {
  envLag = 7;
  mount();
  await waitFor(() => expect(screen.getByRole('note', { name: '간격 설정 불일치' })).toBeInTheDocument());
  expect(screen.getByRole('note', { name: '간격 설정 불일치' })).toHaveTextContent('L=2');
  expect(screen.getByRole('note', { name: '간격 설정 불일치' })).toHaveTextContent('LOTTO_CROSS_DRAW_LAG 는 7');
  expect(screen.getByText(/설정 L=7/)).toBeInTheDocument();
  envLag = 2;
});

test('설정 L 과 run L 일치 시 안내 없음', async () => {
  mount();
  await waitFor(() => expect(screen.getByText('1..2')).toBeInTheDocument());
  expect(screen.queryByRole('note', { name: '간격 설정 불일치' })).not.toBeInTheDocument();
});
