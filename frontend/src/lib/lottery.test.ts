import { pickPositions } from './lottery';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

test('pickPositions: rounds×pick 만큼 집계, 비복원(라운드당 같은 위치 1회), 빈도 상위 pick 오름차순', () => {
  const r = pickPositions(10, 5, 1241, seeded(7));
  expect(r.pick).toBe(5);
  expect(r.counts.slice(1).reduce((a, b) => a + b, 0)).toBe(1241 * 5);
  expect(r.counts.slice(1).every((c) => c <= 1241)).toBe(true);
  expect(r.selected).toHaveLength(5);
  expect(r.selected).toEqual([...r.selected].sort((a, b) => a - b));
  const order = Array.from({ length: 10 }, (_, i) => i + 1).sort((a, b) => r.counts[b] - r.counts[a] || a - b);
  expect([...order.slice(0, 5)].sort((a, b) => a - b)).toEqual(r.selected);
  // 같은 seed → 같은 결과
  expect(pickPositions(10, 5, 1241, seeded(7)).selected).toEqual(r.selected);
});

test('pickPositions: pool < pick 이면 pick 을 pool 로 줄이고, pool 0 이면 빈 선택', () => {
  expect(pickPositions(3, 5, 100, seeded(1)).selected).toEqual([1, 2, 3]);
  expect(pickPositions(0, 5, 100).selected).toEqual([]);
});
