import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScorecardView from './ScorecardView';
import type { Scorecard } from '../api/client';

vi.mock('./PlotlyChart', () => ({ default: () => <div data-testid="plot" /> }));

// 회귀: 보너스 포함 평가 시 백색 화면 — bonus 가 객체로 오면 BallRow 가 객체를 렌더해 크래시했음
const sc: Scorecard = {
  numbers: [3, 14, 21, 29, 38, 45],
  bonus: 7,
  bonus_info: { in_main: false, observed_as_main: 160 },
  history_T: 1240,
  per_number: [3, 14, 21, 29, 38, 45].map((n) => ({ number: n, observed: 160, expected: 165.3, z: -0.4, p: 0.7, current_gap: 2 })),
  pairs: [{ a: 3, b: 14, observed: 21, expected: 22.5, calibrated_lift: 1.0, z: 0.1 }],
  mean_pair_lift: 1.004,
  typicality: { features: { sum: 150 }, per_feature: { sum: { value: 150, percentile: 0.6, null_mean: 138, null_sd: 30 } }, mahalanobis: 1.2, typicality_p: 0.8, note: 'n' },
  history: { exact_6: 0, match_5: 0, match_4: 3, match_3: 60, mean_matches_past: 0.79, expected_mean: 0.8 },
  match_distribution: { '0': 0.43, '1': 0.41, '2': 0.13, '3': 0.02, '4': 0.001, '5': 0.00002, '6': 0.0000001 },
  rank_probabilities: { rank1: 1.2e-7, rank2: 7.4e-7, rank3: 2.8e-5, rank4: 1.4e-3, rank5: 2.2e-2 },
  expected_matches: 0.8,
  winners: { predicted_first_prize_winners: 8.1, uniform_reference_mean: 8.0, relative_index: 1.01, percentile_among_uniform: 0.5, note: 'w' },
  policy: 'p',
} as Scorecard;

test('보너스 포함 스코어카드 렌더 (크래시 없음), 보너스 공·정보 표시', () => {
  render(
    <MemoryRouter>
      <ScorecardView sc={sc} />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText('보너스 7')).toBeInTheDocument();
  expect(screen.getByText(/본번호로 출현 160회/)).toBeInTheDocument();
});

test('bonus 가 잘못된 형태(객체)여도 크래시하지 않음', () => {
  const bad = { ...sc, bonus: { bonus: 7 } as unknown as number, bonus_info: null };
  render(
    <MemoryRouter>
      <ScorecardView sc={bad} />
    </MemoryRouter>,
  );
  expect(screen.queryByLabelText(/보너스/)).toBeNull();
  expect(screen.getByText(/이력 T=1240회/)).toBeInTheDocument();
});
