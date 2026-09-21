// dataviz 스킬 기준 팔레트 (색약 안전 순서 고정). 계열 색은 항목에 고정 — 순번에 따라 재배정하지 않음.
export const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

// 전략 → 고정 색 슬롯 (필터로 계열 수가 바뀌어도 색 유지)
export const STRATEGY_ORDER = [
  'uniform',
  'frequency_hot',
  'frequency_cold',
  'bayesian_shrink',
  'pair_association',
  'pattern_typical',
  'low_competition',
  'hybrid',
  'user',
] as const;

export function strategyColor(strategy: string, dark: boolean): string {
  const idx = STRATEGY_ORDER.indexOf(strategy as (typeof STRATEGY_ORDER)[number]);
  const pal = dark ? SERIES.dark : SERIES.light;
  if (idx < 0) return '#898781';
  if (strategy === 'user') return dark ? '#c3c2b7' : '#52514e';
  return pal[idx % pal.length];
}

export const INK = {
  light: { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' },
  dark: { primary: '#ffffff', secondary: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835' },
};

// 관측 vs 기대: 관측 = 계열1(파랑), 기대 = 회색 참조선
export const OBSERVED = { light: '#2a78d6', dark: '#3987e5' };
export const EXPECTED = { light: '#898781', dark: '#898781' };
export const ACCENT = { light: '#eb6834', dark: '#d95926' };

// 발산 척도 (z, lift): 파랑 – 회색 – 주황 (색약 안전, 중간은 무채색)
export function divergingScale(dark: boolean): Array<[number, string]> {
  const mid = dark ? '#383835' : '#f0efec';
  return [
    [0, '#0d366b'],
    [0.25, '#3987e5'],
    [0.5, mid],
    [0.75, '#eb6834'],
    [1, '#7a2a0c'],
  ];
}

// 순차 척도 (공출현 횟수 등): 단일 색상 파랑, 연→진
export function sequentialScale(dark: boolean): Array<[number, string]> {
  return [
    [0, dark ? '#1a1a19' : '#fcfcfb'],
    [0.2, '#cde2fb'],
    [0.5, '#6da7ec'],
    [0.8, '#256abf'],
    [1, '#0d366b'],
  ];
}

// 상태 색 (판정 배지 전용)
export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };

// 로또 공 색 (한국 로또 공식 구간색)
export type BallTone = 'yellow' | 'blue' | 'red' | 'gray' | 'green';
export function ballTone(n: number): BallTone {
  if (n <= 10) return 'yellow';
  if (n <= 20) return 'blue';
  if (n <= 30) return 'red';
  if (n <= 40) return 'gray';
  return 'green';
}
export const BALL_HEX: Record<BallTone, string> = {
  yellow: '#fbc400',
  blue: '#69c8f2',
  red: '#ff7272',
  gray: '#aaaaaa',
  green: '#b0d840',
};

/**
 * S5.10 최근 6회차 1등 번호 출현 횟수별 테두리 색: 1회 검정, 2회 1~10번 색, 3회 11~20번, 4회 21~30번, 5회 31~40번, 6회 41번 이상.
 * 공 색과 구별되도록 흰색 안쪽 테두리를 먼저 두른 뒤 바깥에 색 테두리를 추가한다 (box-shadow 이중 링).
 */
export function hitRingColor(count: number): string | null {
  if (count < 1) return null;
  if (count === 1) return '#000000';
  const rep = [5, 15, 25, 35, 45][Math.min(count, 6) - 2];
  return BALL_HEX[ballTone(rep)];
}
export function hitRingShadow(count: number): string | undefined {
  const c = hitRingColor(count);
  return c ? `0 0 0 2px #ffffff, 0 0 0 4px ${c}` : undefined;
}
