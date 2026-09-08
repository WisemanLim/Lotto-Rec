"""단일 번호 빈도·전역 균등성 (PRD §4.2, §4.4 단일)."""

from __future__ import annotations

import numpy as np
from scipy import stats

from app.core.multiple_testing import adjust_all
from app.core.null_model import GAME, Game


def binom_two_sided_vec(k: np.ndarray, n: int, p: float) -> np.ndarray:
    """벡터화 양측 이항 p (min-tail doubling, 1 로 절단)."""
    k = np.asarray(k)
    lower = stats.binom.cdf(k, n, p)
    upper = stats.binom.sf(k - 1, n, p)
    return np.minimum(1.0, 2.0 * np.minimum(lower, upper))


def number_frequency(x: np.ndarray, role: str = "main", game: Game = GAME, alpha: float = 0.05) -> dict:
    """x: (T, N) incidence. 번호별 관측·기대·잔차·z·정확 이항 p·보정·예측구간."""
    T, N = x.shape
    p = game.p_single if role == "main" else 1.0 / game.N
    obs = x.sum(axis=0).astype(int)
    exp = T * p
    var = T * p * (1 - p)
    z = (obs - exp) / np.sqrt(var)
    pvals = np.array([stats.binomtest(int(c), n=T, p=p, alternative="two-sided").pvalue for c in obs])
    adj = adjust_all(pvals, alpha)
    lo95, hi95 = stats.binom.ppf(0.025, T, p), stats.binom.ppf(0.975, T, p)
    lo99, hi99 = stats.binom.ppf(0.005, T, p), stats.binom.ppf(0.995, T, p)
    rows = []
    for i in range(N):
        rows.append(
            {
                "number": i + 1,
                "role": role,
                "observed": int(obs[i]),
                "expected": float(exp),
                "residual": float(obs[i] - exp),
                "z": float(z[i]),
                "p": float(pvals[i]),
                "p_bonferroni": float(adj["p_bonferroni"][i]),
                "p_holm": float(adj["p_holm"][i]),
                "q_bh": float(adj["q_bh"][i]),
                "q_by": float(adj["q_by"][i]),
                "sig_bh": bool(adj["q_bh"][i] < alpha),
                "sig_holm": bool(adj["p_holm"][i] < alpha),
            }
        )
    return {
        "role": role,
        "T": int(T),
        "expected": float(exp),
        "sd": float(np.sqrt(var)),
        "pi95": [int(lo95), int(hi95)],
        "pi99": [int(lo99), int(hi99)],
        "rows": rows,
        "n_sig_bh": int(np.sum(adj["q_bh"] < alpha)),
        "n_sig_holm": int(np.sum(adj["p_holm"] < alpha)),
        "max_abs_z": float(np.max(np.abs(z))),
        "argmax_number": int(np.argmax(np.abs(z)) + 1),
    }


def pearson_x2(counts: np.ndarray) -> float:
    counts = np.asarray(counts, dtype=float)
    exp = counts.sum() / len(counts)
    return float(np.sum((counts - exp) ** 2 / exp))


def g_statistic(counts: np.ndarray) -> float:
    counts = np.asarray(counts, dtype=float)
    exp = counts.sum() / len(counts)
    nz = counts > 0
    return float(2.0 * np.sum(counts[nz] * np.log(counts[nz] / exp)))


def global_uniformity(x: np.ndarray, game: Game = GAME, null_x2: np.ndarray | None = None) -> dict:
    """Pearson X²(부적절), Joe 보정 J, G-test, MC p(null_x2 = 시뮬레이션 X² 분포)."""
    counts = x.sum(axis=0)
    N = len(counts)
    X2 = pearson_x2(counts)
    J = game.joe_factor * X2
    G = g_statistic(counts)
    out: dict[str, object] = {
        "pearson_x2": {
            "statistic": X2,
            "df": N - 1,
            "p_naive": float(stats.chi2.sf(X2, N - 1)),
            "note": "비복원추출에서 χ²_{N-1} 부적합 — 참고용",
        },
        "joe_J": {
            "statistic": J,
            "df": N - 1,
            "p_asymptotic": float(stats.chi2.sf(J, N - 1)),
            "factor": game.joe_factor,
        },
        "g_test": {
            "statistic": G,
            "df": N - 1,
            "p_asymptotic_adjusted": float(stats.chi2.sf(game.joe_factor * G, N - 1)),
        },
    }
    if null_x2 is not None and len(null_x2):
        from app.core.null_model import mc_pvalue

        p_mc = mc_pvalue(null_x2, X2)
        px2: dict = out["pearson_x2"]  # type: ignore[assignment]
        pj: dict = out["joe_J"]  # type: ignore[assignment]
        px2["p_mc"] = p_mc
        pj["p_mc"] = p_mc
        out["mc_iterations"] = int(len(null_x2))
    return out
