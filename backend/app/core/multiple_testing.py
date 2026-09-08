"""다중검정 보정 (PRD §4.7) — Bonferroni/Holm/BH/BY + maxT 헬퍼."""

from __future__ import annotations

import numpy as np
from statsmodels.stats.multitest import multipletests

METHODS = {"bonferroni": "bonferroni", "holm": "holm", "fdr_bh": "fdr_bh", "fdr_by": "fdr_by"}


def adjust_all(p: np.ndarray, alpha: float = 0.05) -> dict[str, np.ndarray]:
    """네 가지 보정을 모두 계산해 dict 로 반환(빈 배열 안전)."""
    p = np.asarray(p, dtype=float)
    out: dict[str, np.ndarray] = {}
    if p.size == 0:
        return {k: p.copy() for k in ("p_bonferroni", "p_holm", "q_bh", "q_by")}
    p_clip = np.clip(np.nan_to_num(p, nan=1.0), 0.0, 1.0)
    for col, m in (("p_bonferroni", "bonferroni"), ("p_holm", "holm"), ("q_bh", "fdr_bh"), ("q_by", "fdr_by")):
        _, adj, _, _ = multipletests(p_clip, alpha=alpha, method=m)
        out[col] = adj
    return out


def adjusted_column(method: str) -> str:
    return {"bonferroni": "p_bonferroni", "holm": "p_holm", "fdr_bh": "q_bh", "fdr_by": "q_by"}[method]


def maxt_pvalues(observed_abs: np.ndarray, null_max: np.ndarray) -> np.ndarray:
    """Westfall–Young 단일 단계 maxT: 각 관측 |T_i| 에 대해 P(max_b >= |T_i|)."""
    null_sorted = np.sort(np.asarray(null_max, dtype=float))
    B = len(null_sorted)
    obs = np.abs(np.asarray(observed_abs, dtype=float))
    # count of null_max >= obs
    idx = np.searchsorted(null_sorted, obs, side="left")
    cnt = B - idx
    return (1 + cnt) / (B + 1)
