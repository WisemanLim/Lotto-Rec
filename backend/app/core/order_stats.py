"""정렬 결과벡터 공정성 검정 — Coronel-Brizio, Hernández-Montoya, Rapallo & Scalas (2008). PRD §4.3."""

from __future__ import annotations

import numpy as np
from scipy import stats

from app.core.null_model import GAME, Game, mc_pvalue


def q_statistic(sorted_draws: np.ndarray, game: Game = GAME) -> float:
    """sorted_draws: (T, k) 오름차순 본번호. Q = m (ȳ-μ)' V⁻¹ (ȳ-μ)."""
    m = sorted_draws.shape[0]
    ybar = sorted_draws.mean(axis=0)
    mu = game.order_stat_mean()
    Vinv = np.linalg.inv(game.order_stat_cov())
    d = ybar - mu
    return float(m * d @ Vinv @ d)


def q_statistic_batch(sorted_draws: np.ndarray, game: Game = GAME) -> np.ndarray:
    """(S, T, k) → (S,) Q 값."""
    m = sorted_draws.shape[1]
    ybar = sorted_draws.mean(axis=1)  # (S, k)
    d = ybar - game.order_stat_mean()
    Vinv = np.linalg.inv(game.order_stat_cov())
    return m * np.einsum("si,ij,sj->s", d, Vinv, d)


def order_stat_test(sorted_draws: np.ndarray, game: Game = GAME, null_q: np.ndarray | None = None) -> dict:
    Q = q_statistic(sorted_draws, game)
    out = {
        "statistic": Q,
        "df": game.k,
        "p_asymptotic": float(stats.chi2.sf(Q, game.k)),
        "mean_observed": sorted_draws.mean(axis=0).tolist(),
        "mean_null": game.order_stat_mean().tolist(),
        "sd_null_single": np.sqrt(np.diag(game.order_stat_cov())).tolist(),
        "T": int(sorted_draws.shape[0]),
    }
    if null_q is not None and len(null_q):
        out["p_mc"] = mc_pvalue(null_q, Q)
    return out
