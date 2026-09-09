/** S4.10/S5.5 무작위 빈도 위치 선택 규칙 — 1..pool 중 pick 개 비복원 추출을 rounds 회 반복, 빈도 상위 pick 위치(동률은 작은 번호). */
export interface LotteryPick {
  pool: number;
  pick: number;
  rounds: number;
  counts: number[]; // index 1..pool
  selected: number[]; // 오름차순 위치(1-based)
}

export function pickPositions(pool: number, pick: number, rounds: number, rng: () => number = Math.random): LotteryPick {
  const k = Math.min(pick, pool);
  const counts = new Array<number>(pool + 1).fill(0);
  if (pool <= 0 || k <= 0) return { pool, pick: k, rounds, counts, selected: [] };
  const idx = Array.from({ length: pool }, (_, i) => i + 1);
  for (let r = 0; r < rounds; r++) {
    // 부분 Fisher–Yates: 앞 k 개가 비복원 표본
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(rng() * (pool - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
      counts[idx[i]] += 1;
    }
  }
  const order = Array.from({ length: pool }, (_, i) => i + 1).sort((a, b) => counts[b] - counts[a] || a - b);
  return { pool, pick: k, rounds, counts, selected: order.slice(0, k).sort((a, b) => a - b) };
}
