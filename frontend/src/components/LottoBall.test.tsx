import { render, screen } from '@testing-library/react';
import LottoBall, { BallRow } from './LottoBall';
import { BALL_HEX, ballTone } from '../lib/colors';

describe('LottoBall', () => {
  test('구간별 색 매핑 (1–10 노랑, 11–20 파랑, 21–30 빨강, 31–40 회색, 41–45 초록)', () => {
    expect(ballTone(1)).toBe('yellow');
    expect(ballTone(10)).toBe('yellow');
    expect(ballTone(11)).toBe('blue');
    expect(ballTone(20)).toBe('blue');
    expect(ballTone(21)).toBe('red');
    expect(ballTone(30)).toBe('red');
    expect(ballTone(31)).toBe('gray');
    expect(ballTone(40)).toBe('gray');
    expect(ballTone(41)).toBe('green');
    expect(ballTone(45)).toBe('green');
  });

  test('공 배경색이 구간색과 일치한다', () => {
    render(<LottoBall n={25} />);
    const el = screen.getByLabelText('25');
    expect(el).toHaveAttribute('data-tone', 'red');
    expect(el.style.backgroundColor).toBe('rgb(255, 114, 114)');
    expect(BALL_HEX.red).toBe('#ff7272');
  });

  test('BallRow 는 보너스를 별도 표시한다', () => {
    render(<BallRow numbers={[3, 11, 19, 27, 35, 43]} bonus={7} />);
    expect(screen.getByLabelText('보너스 7')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/^\d+$/)).toHaveLength(6);
  });
});
