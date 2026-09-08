import { render, screen } from '@testing-library/react';
import PValueBadge from './PValueBadge';

describe('PValueBadge', () => {
  test('보정 후 유의 → 유의 배지', () => {
    render(<PValueBadge p={0.0001} q={0.01} alpha={0.05} />);
    expect(screen.getByText(/유의/)).toHaveAttribute('data-state', 'significant');
    expect(screen.getByText(/1\.00e-4/)).toBeInTheDocument();
  });

  test('원시 p<0.05 이나 보정 후 비유의 → 탐색 후보', () => {
    render(<PValueBadge p={0.02} q={0.4} alpha={0.05} />);
    expect(screen.getByText(/탐색 후보/)).toHaveAttribute('data-state', 'exploratory');
  });

  test('비유의 → 값만 표시', () => {
    render(<PValueBadge p={0.43} />);
    const el = screen.getByText('0.430');
    expect(el).toHaveAttribute('data-state', 'null');
  });

  test('서버 sig 플래그가 우선한다', () => {
    render(<PValueBadge p={0.001} sig={false} />);
    expect(screen.getByText(/탐색 후보/)).toBeInTheDocument();
  });

  test('null → 대시', () => {
    render(<PValueBadge p={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
