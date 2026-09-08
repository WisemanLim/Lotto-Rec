"""티켓 스코어카드 (PRD §E5 S5.2) — 이력 기반 번호/쌍 통계, 전형성, 일치수 분포, 예상 공유자."""

from __future__ import annotations

from itertools import combinations

import numpy as np
from scipy import stats

from app.core.features import combo_features
from app.core.frequency import binom_two_sided_vec
from app.core.groups import typicality
from app.core.null_model import GAME, Game
from app.core.pairs import cooccurrence


def scorecard(
    nums: list[int],
    incidence: np.ndarray,
    draws: np.ndarray,
    *,
    game: Game = GAME,
    null_features: np.ndarray | None = None,
    winners_model: dict | None = None,
    draw_no_next: int | None = None,
    bonus: int | None = None,
) -> dict:
    nums = sorted(int(n) for n in nums)
    T, N = incidence.shape
    p1 = game.p_single
    counts = incidence.sum(axis=0)
    cooc = cooccurrence(incidence)
    # 번호별
    per_number = []
    for n in nums:
        c = int(counts[n - 1])
        z = (c - T * p1) / np.sqrt(T * p1 * (1 - p1)) if T else 0.0
        hits = np.flatnonzero(incidence[:, n - 1])
        per_number.append(
            {
                "number": n,
                "observed": c,
                "expected": T * p1,
                "z": float(z),
                "p": float(binom_two_sided_vec(np.array([c]), T, p1)[0]) if T else 1.0,
                "current_gap": int(T - 1 - hits[-1]) if len(hits) else T,
            }
        )
    # 쌍 15개
    pp = game.p_pair
    pair_rows = []
    for a, b in combinations(nums, 2):
        o = int(cooc[a - 1, b - 1])
        z = (o - T * pp) / np.sqrt(T * pp * (1 - pp)) if T else 0.0
        pair_rows.append(
            {
                "a": a,
                "b": b,
                "observed": o,
                "expected": T * pp,
                "calibrated_lift": (o / T) / pp if T else None,
                "z": float(z),
            }
        )
    mean_lift = float(np.mean([r["calibrated_lift"] for r in pair_rows])) if T else None
    # 전형성
    typ = typicality(nums, null_features) if null_features is not None else {"features": combo_features(nums)}
    # 과거 일치 이력
    hist = incidence[:, [n - 1 for n in nums]].sum(axis=1) if T else np.zeros(0)
    history = {
        "exact_6": int((hist == 6).sum()),
        "match_5": int((hist == 5).sum()),
        "match_4": int((hist == 4).sum()),
        "match_3": int((hist == 3).sum()),
        "mean_matches_past": float(hist.mean()) if T else None,
        "expected_mean": game.expected_overlap,
    }
    # 일치수 분포 (모든 조합 동일)
    md = game.match_distribution()
    ranks = game.rank_probabilities()
    # 예상 공유자
    winners = None
    if winners_model and "coef" in winners_model:
        from app.core.winners_model import predict_winners, predict_winners_batch

        dn = float(draw_no_next or T + 1)
        pred = predict_winners(winners_model, nums, dn)
        rng = np.random.default_rng(0)
        u = rng.random((2000, N), dtype=np.float32)
        ref = np.sort(np.argpartition(u, game.k - 1, axis=1)[:, : game.k] + 1, axis=1)
        ref_pred = predict_winners_batch(winners_model, ref, dn)
        winners = {
            "predicted_first_prize_winners": pred,
            "uniform_reference_mean": float(ref_pred.mean()),
            "relative_index": float(pred / ref_pred.mean()),
            "percentile_among_uniform": float((ref_pred < pred).mean()),
            "note": "예상 공유자 ↓ = 당첨 시 기대 분배금 ↑ (당첨확률은 불변)",
        }
    bonus_info = None
    if bonus is not None:
        bc = int(incidence.shape[0] and 0)
        bonus_info = {
            "bonus": bonus,
            "in_main": bonus in nums,
            "observed_as_main": int(counts[bonus - 1]) if 1 <= bonus <= N else None,
            "_": bc,
        }
    return {
        "numbers": nums,
        "bonus": bonus_info,
        "history_T": int(T),
        "per_number": per_number,
        "pairs": pair_rows,
        "mean_pair_lift": mean_lift,
        "typicality": typ,
        "history": history,
        "match_distribution": {str(i): float(md[i]) for i in range(len(md))},
        "rank_probabilities": ranks,
        "expected_matches": game.expected_overlap,
        "winners": winners,
        "policy": "모든 조합의 당첨확률은 동일(1/8,145,060). 위 지표는 설명·검증용이며 예측력을 의미하지 않음.",
    }


def hypergeom_match_var(game: Game = GAME) -> float:
    N, k = game.N, game.k
    return k * (k / N) * (1 - k / N) * (N - k) / (N - 1)


def sf_at_least(m: int, game: Game = GAME) -> float:
    return float(game.match_distribution()[m:].sum())


__all__ = ["scorecard", "hypergeom_match_var", "sf_at_least", "stats"]
