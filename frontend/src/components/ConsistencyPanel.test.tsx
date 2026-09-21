import { render, screen } from '@testing-library/react';
import { ConsistencyView } from './ConsistencyPanel';
import type { ConsistencyReport } from '../api/client';

// S8.8: 추천 정합성 분석 표·판정·다음 실험 제안 렌더
const strat = (verdict: 'consistent' | 'deviation', minQ: number) => ({
  n_tickets: 120,
  n_draws: 12,
  insufficient: false,
  rank_dist: [0, 1, 2, 3, 4, 5].map((rank) => ({ rank, observed: rank === 5 ? 4 : 0, expected: rank === 5 ? 3.1 : 0.5, share: 0, expected_share: 0, p: 0.5 })),
  match_gof: { stat: 1.2, df: 3, p: 0.75, bins: 4 },
  number_corr: { mean_r: 0.012, n_draws: 12, t: 0.4, p: 0.7, per_draw: [] },
  pair_corr: { pairs: 900, hits: 14, expected_hits: 13.6, p0: 0.01515, mean_excess_rate: 0.0004, n_draws: 12, t: 0.2, p: 0.8 },
  min_q: minQ,
  verdict,
});
const base: ConsistencyReport = {
  alpha: 0.05,
  n_tests: 12,
  origin: 'user',
  source: 'recommendation',
  latest_draw: 1242,
  strategies: { uniform: strat('consistent', 0.6), hybrid: strat('deviation', 0.01) },
  feedback: {
    summary: '1개 전략에서 유의 편차 — 재튜닝 후보(반드시 홀드아웃 재검증).',
    n_deviation: 1,
    actions: ['hybrid: 유의 편차(q<0.05) — 재튜닝 후보.'],
    next_experiment: [{ strategy: 'hybrid', tune_to: 1242, note: 'n' }],
  },
  policy: '모든 티켓의 이론 당첨확률은 동일하다.',
};

test('전략별 표, 판정, 다음 실험 제안을 표시한다', () => {
  render(<ConsistencyView report={base} />);
  expect(screen.getByRole('status', { name: '추천 정합성 판정' })).toHaveTextContent('1개 전략에서 유의 편차');
  expect(screen.getByRole('status', { name: '추천 정합성 판정' })).toHaveTextContent('다음 실험 제안');
  expect(screen.getByText('유의 편차')).toBeInTheDocument();
  expect(screen.getByText('균등과 일치')).toBeInTheDocument();
  expect(screen.getAllByText(/5등 4\/3\.1/).length).toBe(2);
});

test('전략이 없으면 안내 문구', () => {
  render(<ConsistencyView report={{ ...base, strategies: {} }} />);
  expect(screen.getByText(/대조된 추천 티켓이 없습니다/)).toBeInTheDocument();
});
