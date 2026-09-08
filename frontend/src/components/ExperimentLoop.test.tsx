import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ExperimentLoop from './ExperimentLoop';
import { fmtParams } from '../lib/format';

const exp = {
  experiment_id: 'abcdef12-0000', name: 'x', strategy: 'analysis_weighted', params: { beta: 1.0355, lift_power: 0.567, window: 516 }, parent_id: null,
  iteration: 1, tune_from: 1001, tune_to: 1120, holdout_from: 1121, holdout_to: 1240, n_tickets: 10, seed: 1, search: 'random', n_candidates: 8,
  candidates: [{ index: 0, params: { beta: 0.5, lift_power: 0, window: 0 }, mean_matches: 0.8, diff_vs_uniform: 0.0, n_ge3: 20, brier_mean: 0.1 }],
  metrics_tune: { n_tickets: 1200, n_draws: 120, mean_matches: 0.8067, expected_matches: 0.8, z: 0.2, p: 0.8, match_hist: [], n_ge3: 30, expected_ge3: 28.6, best_index: 0, diff_vs_uniform: { mean: 0.0067, ci95: [-0.07, 0.09], n_draws: 120, p_paired_t: 0.87, verdict: '균등과 차이 없음' } },
  metrics_holdout: { n_tickets: 1200, n_draws: 120, mean_matches: 0.7792, expected_matches: 0.8, z: -0.92, p: 0.36, match_hist: [], n_ge3: 25, expected_ge3: 28.6, optimism: 0.0275, verdict: '홀드아웃에서 개선 소멸(평균 회귀) — 튠 성과는 선택 편향/우연', diff_vs_uniform: { mean: -0.0208, ci95: [-0.096, 0.059], n_draws: 120, p_paired_t: 0.6, verdict: '균등과 차이 없음' } },
  h0_benchmark: { sd_single_diff: 0.032, expected_best_diff: 0.0455, q50: 0.044, q90: 0.07, q95: 0.079, q99: 0.096, k: 8, n_sims: 20000, observed_best_diff: 0.0067, percentile_of_observed: 0.0126, p_best_of_k: 0.987, note: 'n' },
  status: 'done', progress: 1, stage: 'done', error: null, is_active: true, created_at: null, finished_at: null,
};

function fake(url: string) {
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('/experiments/strategy-params'))
    return json({ strategies: [{ id: 'analysis_weighted', label: '군 A 분석 가중', basis: 'b', expectation: 'e', params: { beta: { default: 0.5, min: 0, max: 2, type: 'float', desc: 'z 가중' } }, defaults: { beta: 0.5 } }] });
  if (url.includes('/experiments/runs')) return json([exp]);
  if (url.includes('/experiments/active')) return json({ analysis_weighted: exp });
  if (url.includes('/experiments/lineage'))
    return json({ strategy: 'analysis_weighted', points: [{ experiment_id: exp.experiment_id, iteration: 1, created_at: null, params: exp.params, is_active: true, tune_diff: 0.0067, tune_mean: 0.8067, holdout_diff: -0.0208, holdout_ci95: [-0.096, 0.059], holdout_mean: 0.7792, holdout_z: -0.92, optimism: 0.0275, p_best_of_k: 0.987, cum_holdout_mean: 0.7792, cum_holdout_z: -0.92 }], trend: null, note: 'note' });
  return json([]);
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn(async (u: RequestInfo | URL) => fake(String(u)))));
afterEach(() => vi.unstubAllGlobals());

test('fmtParams 는 파라미터를 요약한다', () => {
  expect(fmtParams({ beta: 1.0355, window: 516 })).toBe('beta=1.036 · window=516');
  expect(fmtParams({})).toBe('기본(파라미터 없음)');
});

test('활성 버전·실험 목록·판정을 렌더한다', async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ExperimentLoop strategy="analysis_weighted" tickets={10} trainEnd={1000} seed={1} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('active-card')).toHaveTextContent('v1'));
  expect(screen.getByTestId('active-card')).toHaveTextContent('beta=1.036');
  await waitFor(() => expect(screen.getAllByText(/개선 소멸/).length).toBeGreaterThan(0));
  expect(screen.getByRole('form', { name: '새 실험' })).toBeInTheDocument();
  expect(screen.getByLabelText('기준 beta')).toHaveValue(0.5);
});
