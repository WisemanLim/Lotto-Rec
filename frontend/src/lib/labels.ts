// 화면 공통 라벨 (컴포넌트 파일 밖에 두어 Fast Refresh 경고 회피).
export const APP_NAME_LINES = ['Lotto number', 'recommender'] as const;

export const NAV = [
  { to: '/', label: '개요' },
  { to: '/frequency', label: '번호 빈도' },
  { to: '/pairs', label: '조합 연관성' },
  { to: '/groups', label: '그룹 패턴' },
  { to: '/temporal', label: '시간 분석' },
  { to: '/cross-draw', label: '회차간 연관성' },
  { to: '/validation', label: '검증 (A→B)' },
  { to: '/recommend', label: '추천' },
  { to: '/my-numbers', label: '내 번호' },
  { to: '/tracking', label: '성과 추적' },
  { to: '/settings', label: '설정/실행' },
  { to: '/glossary', label: '용어 사전' },
];

export const STATUS_LABEL: Record<string, string> = { pending: '대기', running: '실행 중', done: '완료', error: '오류', interrupted: '중단됨' };

export const STRATEGY_LABEL: Record<string, string> = {
  uniform: '균등 무작위 (기준선)',
  frequency_hot: '고빈도(핫)',
  frequency_cold: '저빈도/콜드',
  bayesian_shrink: '베이즈 축소',
  pair_association: '쌍 연관 순차',
  pattern_typical: '전형성 필터',
  low_competition: '저경쟁',
  hybrid: '혼합',
  user: '사용자 번호',
};
export const labelOf = (s: string, perf?: { label?: string }) => perf?.label ?? STRATEGY_LABEL[s] ?? s;

export const FEATURE_LABEL: Record<string, string> = {
  sum: '합',
  odd_count: '홀수 개수',
  low_count: '저번호(1–22) 개수',
  dec1: '1–10 구간',
  dec2: '11–20 구간',
  dec3: '21–30 구간',
  dec4: '31–40 구간',
  dec5: '41–45 구간',
  consecutive_pairs: '연속쌍',
  last_digit_dup: '끝수 중복',
  birthday_count: '생일수(≤31) 개수',
  prime_count: '소수 개수',
  range: '범위(최대-최소)',
  ac_value: 'AC 값',
};
