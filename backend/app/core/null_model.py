"""균등 k-of-N 비복원추출 영가설 — 조합 확률·기대값·Monte-Carlo 시뮬레이터 (PRD §4.1, §4.6, §4.10(a))."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from math import comb

import numpy as np


@dataclass(frozen=True)
class Game:
    N: int = 45
    k: int = 6

    # --- 기본 확률 ---
    @property
    def p_single(self) -> float:
        return self.k / self.N

    def p_subset(self, r: int) -> float:
        """크기 r 집합이 한 회차 본번호에 모두 포함될 확률 (k)_r/(N)_r."""
        if r > self.k:
            return 0.0
        return comb(self.N - r, self.k - r) / comb(self.N, self.k)

    @property
    def p_pair(self) -> float:
        return self.p_subset(2)

    def p_conditional(self, given: int, extra: int) -> float:
        """given 개가 포함된 조건에서 extra 개가 더 포함될 확률 (k-g)_e/(N-g)_e."""
        num = 1.0
        for i in range(extra):
            num *= (self.k - given - i) / (self.N - given - i)
        return num

    @property
    def naive_lift_null(self) -> float:
        """일반 lift 의 H0 값 N(k-1)/(k(N-1)) — 1 이 아니므로 설계 보정 lift 사용."""
        return self.N * (self.k - 1) / (self.k * (self.N - 1))

    @property
    def corr_null(self) -> float:
        return -1.0 / (self.N - 1)

    @property
    def joe_factor(self) -> float:
        """Joe(1993)/Bellhouse(1982): J = (N-1)/(N-k) · X² ~ χ²_{N-1}."""
        return (self.N - 1) / (self.N - self.k)

    def genest_pair_weights(self) -> tuple[float, float, int, int]:
        """Genest–Lockhart–Stephens(2002) 쌍 X² 점근분포 w1·χ²_{N-1} + w2·χ²_{N(N-3)/2}."""
        N, k = self.N, self.k
        w1 = (k - 1) * comb(N - 3, k - 2) / comb(N - 2, k - 2)
        w2 = comb(N - 4, k - 2) / comb(N - 2, k - 2)
        return w1, w2, N - 1, N * (N - 3) // 2

    # --- 순서통계량 (Coronel-Brizio et al. 2008) ---
    def order_stat_mean(self) -> np.ndarray:
        return np.array([(self.N + 1) * i / (self.k + 1) for i in range(1, self.k + 1)])

    def order_stat_cov(self) -> np.ndarray:
        N, k = self.N, self.k
        V = np.zeros((k, k))
        for i in range(1, k + 1):
            for j in range(i, k + 1):
                v = i * (k - j + 1) * (N + 1) * (N - k) / ((k + 1) ** 2 * (k + 2))
                V[i - 1, j - 1] = V[j - 1, i - 1] = v
        return V

    # --- 일치수 분포 ---
    def match_distribution(self) -> np.ndarray:
        tot = comb(self.N, self.k)
        return np.array([comb(self.k, i) * comb(self.N - self.k, self.k - i) / tot for i in range(self.k + 1)])

    def rank_probabilities(self) -> dict[str, float]:
        """한국 로또 등수 확률: 1등 6, 2등 5+보너스, 3등 5, 4등 4, 5등 3."""
        tot = comb(self.N, self.k)
        p5 = comb(self.k, 5) * comb(self.N - self.k, 1) / tot
        return {
            "rank1": 1 / tot,
            "rank2": comb(self.k, 5) * 1 / tot,
            "rank3": p5 - comb(self.k, 5) * 1 / tot,
            "rank4": comb(self.k, 4) * comb(self.N - self.k, 2) / tot,
            "rank5": comb(self.k, 3) * comb(self.N - self.k, 3) / tot,
        }

    @property
    def expected_overlap(self) -> float:
        return self.k * self.k / self.N

    def overlap_pmf(self) -> np.ndarray:
        """인접 회차 중복수 O ~ Hypergeom(N, k, k)."""
        tot = comb(self.N, self.k)
        return np.array([comb(self.k, r) * comb(self.N - self.k, self.k - r) / tot for r in range(self.k + 1)])


GAME = Game()


def mc_pvalue(null_stats: np.ndarray, observed: float, two_sided: bool = False) -> float:
    """(1 + #{|T_b| >= |T_obs|}) / (B + 1)."""
    s = np.asarray(null_stats, dtype=float)
    if two_sided:
        cnt = int(np.sum(np.abs(s) >= abs(observed)))
    else:
        cnt = int(np.sum(s >= observed))
    return (1 + cnt) / (len(s) + 1)


def simulate_draws(rng: np.random.Generator, n_sims: int, T: int, game: Game = GAME) -> np.ndarray:
    """(n_sims, T, k) 정렬된 본번호(1..N). 균등 비복원: 균일난수 argpartition."""
    u = rng.random((n_sims, T, game.N), dtype=np.float32)
    idx = np.argpartition(u, game.k - 1, axis=2)[:, :, : game.k]
    return np.sort(idx + 1, axis=2).astype(np.int16)


def draws_to_incidence(draws: np.ndarray, N: int) -> np.ndarray:
    """(S, T, k) → (S, T, N) int8."""
    S, T, k = draws.shape
    x = np.zeros((S, T, N), dtype=np.int8)
    s_idx = np.arange(S)[:, None, None]
    t_idx = np.arange(T)[None, :, None]
    x[s_idx, t_idx, draws.astype(np.int64) - 1] = 1
    return x


def iter_null_chunks(
    seed: int, n_sims: int, T: int, game: Game = GAME, chunk: int = 64, rng: np.random.Generator | None = None
) -> Iterator[tuple[np.ndarray, np.ndarray]]:
    """청크 단위 (draws, incidence) 생성기 — 메모리 제한 하에 B 회 반복.

    `rng` 를 주면 seed 대신 그 생성기를 이어서 쓴다(체크포인트 재개 — S2.14)."""
    rng = np.random.default_rng(seed) if rng is None else rng
    done = 0
    while done < n_sims:
        s = min(chunk, n_sims - done)
        d = simulate_draws(rng, s, T, game)
        yield d, draws_to_incidence(d, game.N)
        done += s


def simulate_biased_draws(rng: np.random.Generator, T: int, weights: np.ndarray, game: Game = GAME) -> np.ndarray:
    """편향 주입 시뮬레이터 (§12.2 검정력): 번호별 가중 비복원(A-Res). weights 길이 N. 반환 (T, k) 정렬."""
    w = np.clip(np.asarray(weights, dtype=float), 1e-12, None)
    u = rng.random((T, game.N))
    keys = u ** (1.0 / w)
    idx = np.argpartition(-keys, game.k - 1, axis=1)[:, : game.k]
    return np.sort(idx + 1, axis=1).astype(np.int16)
