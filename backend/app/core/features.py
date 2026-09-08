"""회차/조합 파생 특성 (PRD §3.2 features, §4.5 그룹 패턴, §4.10(c) 당첨자수 모형 입력)."""

from __future__ import annotations

import numpy as np

PRIMES_45 = frozenset({2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43})
DECADE_EDGES = [(1, 10), (11, 20), (21, 30), (31, 40), (41, 45)]
FEATURE_NAMES = [
    "sum",
    "odd_count",
    "low_count",
    "dec1",
    "dec2",
    "dec3",
    "dec4",
    "dec5",
    "consecutive_pairs",
    "last_digit_dup",
    "birthday_count",
    "prime_count",
    "range",
    "ac_value",
]


def combo_features(nums: list[int] | tuple[int, ...] | np.ndarray, low_max: int = 22) -> dict[str, int]:
    s = sorted(int(x) for x in nums)
    arr = np.asarray(s)
    diffs = np.diff(arr)
    decades = [int(((arr >= lo) & (arr <= hi)).sum()) for lo, hi in DECADE_EDGES]
    # AC value: 서로 다른 양의 차이 개수 - (k-1)
    pair_diffs = {abs(a - b) for i, a in enumerate(s) for b in s[i + 1 :]}
    return {
        "sum": int(arr.sum()),
        "odd_count": int((arr % 2 == 1).sum()),
        "low_count": int((arr <= low_max).sum()),
        "dec1": decades[0],
        "dec2": decades[1],
        "dec3": decades[2],
        "dec4": decades[3],
        "dec5": decades[4],
        "consecutive_pairs": int((diffs == 1).sum()),
        "last_digit_dup": int(len(s) - len({x % 10 for x in s})),
        "birthday_count": int((arr <= 31).sum()),
        "prime_count": int(sum(1 for x in s if x in PRIMES_45)),
        "range": int(arr.max() - arr.min()),
        "ac_value": int(len(pair_diffs) - (len(s) - 1)),
    }


def features_matrix(draws: np.ndarray) -> np.ndarray:
    """draws: (T, k) 정수 배열 → (T, len(FEATURE_NAMES)) 특성 행렬 (벡터화)."""
    d = np.sort(np.asarray(draws, dtype=np.int64), axis=1)
    T, k = d.shape
    out = np.zeros((T, len(FEATURE_NAMES)), dtype=np.int64)
    out[:, 0] = d.sum(axis=1)
    out[:, 1] = (d % 2 == 1).sum(axis=1)
    out[:, 2] = (d <= 22).sum(axis=1)
    for j, (lo, hi) in enumerate(DECADE_EDGES):
        out[:, 3 + j] = ((d >= lo) & (d <= hi)).sum(axis=1)
    out[:, 8] = (np.diff(d, axis=1) == 1).sum(axis=1)
    last = d % 10
    distinct_last = np.array([len(set(row)) for row in last])
    out[:, 9] = k - distinct_last
    out[:, 10] = (d <= 31).sum(axis=1)
    prime_mask = np.isin(d, list(PRIMES_45))
    out[:, 11] = prime_mask.sum(axis=1)
    out[:, 12] = d.max(axis=1) - d.min(axis=1)
    # ac_value: 벡터화 — 모든 쌍 차이의 고유 개수
    iu = np.triu_indices(k, 1)
    pd_ = np.abs(d[:, iu[0]] - d[:, iu[1]])
    out[:, 13] = np.array([len(set(row)) for row in pd_]) - (k - 1)
    return out


def incidence_from_draws(draws: np.ndarray, pool_size: int = 45) -> np.ndarray:
    """(T, k) 번호 배열 → (T, N) 0/1 incidence matrix (int8)."""
    d = np.asarray(draws, dtype=np.int64)
    T = d.shape[0]
    x = np.zeros((T, pool_size), dtype=np.int8)
    x[np.arange(T)[:, None], d - 1] = 1
    return x
