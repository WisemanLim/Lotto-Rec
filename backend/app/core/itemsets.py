"""3-집합·조건부·집합쌍 관계 (PRD §4.4 C/D). 후보 한정 + 최소 기대빈도 인지."""

from __future__ import annotations

from itertools import combinations

import numpy as np

from app.core.frequency import binom_two_sided_vec
from app.core.multiple_testing import adjust_all
from app.core.null_model import GAME, Game


def subset_count(x: np.ndarray, items: list[int]) -> int:
    idx = [i - 1 for i in items]
    return int(np.all(x[:, idx] == 1, axis=1).sum())


def itemset_stats(x: np.ndarray, items: list[int], game: Game = GAME) -> dict:
    """집합 S 의 관측·기대·Lift*·양측 이항 p."""
    T = x.shape[0]
    r = len(items)
    obs = subset_count(x, items)
    p = game.p_subset(r)
    exp = T * p
    pval = float(binom_two_sided_vec(np.array([obs]), T, p)[0]) if p > 0 else 1.0
    return {
        "itemset": sorted(items),
        "size": r,
        "observed": obs,
        "expected": float(exp),
        "null_prob": p,
        "calibrated_lift": float((obs / T) / p) if p > 0 else None,
        "p": pval,
        "power_note": "기대빈도 < 5 — 검정력 낮음, 탐색용" if exp < 5 else None,
    }


def conditional_stats(x: np.ndarray, target: list[int], given: list[int], game: Game = GAME) -> dict:
    """P(target ⊆ D | given ⊆ D) 관측 vs H0 (k-g)_t/(N-g)_t. 예: 1 | (2,3), (3,4) | (1,2)."""
    if set(target) & set(given):
        raise ValueError("target 과 given 이 겹침 — 합집합 사건으로 분석하세요")
    T = x.shape[0]
    n_given = subset_count(x, given)
    n_both = subset_count(x, sorted(set(target) | set(given)))
    p_null = game.p_conditional(len(given), len(target))
    cond = n_both / n_given if n_given else None
    pval = float(binom_two_sided_vec(np.array([n_both]), n_given, p_null)[0]) if n_given else None
    return {
        "target": sorted(target),
        "given": sorted(given),
        "n_given": n_given,
        "n_both": n_both,
        "cond_prob": cond,
        "cond_prob_null": p_null,
        "conditional_lift": (cond / p_null) if cond is not None and p_null > 0 else None,
        "p": pval,
        "union": itemset_stats(x, sorted(set(target) | set(given)), game),
        "T": int(T),
    }


def candidate_triples(
    pair_rows: list[dict], x: np.ndarray, game: Game = GAME, alpha: float = 0.05, top_pairs: int = 20, N: int = 45
) -> dict:
    """쌍 분석 상위 |z| 쌍 × 제3 번호 → 후보 삼중항. BY-FDR 보정, 조건부 lift 포함."""
    T = x.shape[0]
    top = sorted(pair_rows, key=lambda r: -abs(r["z"]))[:top_pairs]
    seen: set[tuple[int, int, int]] = set()
    trip: list[tuple[int, int, int]] = []
    for r in top:
        for c in range(1, N + 1):
            if c in (r["a"], r["b"]):
                continue
            t = tuple(sorted((r["a"], r["b"], c)))
            if t not in seen:
                seen.add(t)
                trip.append(t)
    if not trip:
        return {"rows": [], "summary": {"n_candidates": 0}}
    idx = np.array(trip) - 1
    obs = np.array([int(np.all(x[:, list(t)] == 1, axis=1).sum()) for t in idx])
    p3 = game.p_subset(3)
    exp = T * p3
    pvals = binom_two_sided_vec(obs, T, p3)
    adj = adjust_all(pvals, alpha)
    p_cond_null = game.p_conditional(2, 1)
    rows = []
    for n, t in enumerate(trip):
        a, b, c = t
        n_ab = subset_count(x, [a, b])
        cond = obs[n] / n_ab if n_ab else None
        rows.append(
            {
                "itemset": [a, b, c],
                "observed": int(obs[n]),
                "expected": float(exp),
                "null_prob": p3,
                "calibrated_lift": float((obs[n] / T) / p3),
                "p": float(pvals[n]),
                "q_by": float(adj["q_by"][n]),
                "q_bh": float(adj["q_bh"][n]),
                "sig_by": bool(adj["q_by"][n] < alpha),
                "cond_given_pair": [a, b],
                "cond_prob": cond,
                "cond_prob_null": p_cond_null,
                "conditional_lift": (cond / p_cond_null) if cond is not None else None,
            }
        )
    rows.sort(key=lambda r: float(str(r["p"])))
    return {
        "rows": rows[:200],
        "summary": {
            "n_candidates": len(trip),
            "expected_count": float(exp),
            "n_sig_by": int(np.sum(adj["q_by"] < alpha)),
            "n_raw_p05": int(np.sum(pvals < 0.05)),
            "top_pairs_used": top_pairs,
            "note": "1,000회에서 3-집합 기대 ≈ 1.4회 — 유의 판정보다 탐색용",
        },
    }


def all_size_expectations(T: int, game: Game = GAME) -> list[dict]:
    return [{"size": r, "prob": game.p_subset(r), "expected": T * game.p_subset(r)} for r in range(1, game.k + 1)]


def enumerate_pairs_in(items: list[int]) -> list[tuple[int, int]]:
    return list(combinations(sorted(items), 2))
