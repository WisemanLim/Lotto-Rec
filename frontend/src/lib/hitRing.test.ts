import { BALL_HEX } from './colors';
import { hitRingColor, hitRingShadow } from './colors';

// S5.10: 출현 횟수별 테두리 색 — 1회 검정, 2~6회 = 1~10/11~20/21~30/31~40/41+ 공 색, 흰 안쪽 테두리 선행
test('횟수별 테두리 색', () => {
  expect(hitRingColor(0)).toBeNull();
  expect(hitRingColor(1)).toBe('#000000');
  expect(hitRingColor(2)).toBe(BALL_HEX.yellow);
  expect(hitRingColor(3)).toBe(BALL_HEX.blue);
  expect(hitRingColor(4)).toBe(BALL_HEX.red);
  expect(hitRingColor(5)).toBe(BALL_HEX.gray);
  expect(hitRingColor(6)).toBe(BALL_HEX.green);
});

test('흰색 안쪽 테두리 뒤에 색 테두리가 온다', () => {
  expect(hitRingShadow(0)).toBeUndefined();
  expect(hitRingShadow(2)).toBe(`0 0 0 2px #ffffff, 0 0 0 4px ${BALL_HEX.yellow}`);
  expect(hitRingShadow(1)).toBe('0 0 0 2px #ffffff, 0 0 0 4px #000000');
});
