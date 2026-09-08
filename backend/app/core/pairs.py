"""번호쌍 공출현 (PRD §4.4 쌍, §4.2 Genest, §4.9 네트워크)."""

from __future__ import annotations

import numpy as np

from app.core.frequency import binom_two_sided_vec
from app.core.multiple_testing import adjust_all, maxt_pvalues
from app.core.null_model import GAME, Game, mc_pvalue


def cooccurrence(x: np.ndarray) -> np.ndarray:
    xi = x.astype(np.int64)
    return xi.T @ xi


def pair_z_matrix(cooc: np.ndarray, T: int, game: Game = GAME) -> np.ndarray:
    p = game.p_pair
    exp = T * p
    var = T * p * (1 - p)
    z = (cooc - exp) / np.sqrt(var)
    np.fill_diagonal(z, 0.0)
    return z


def max_abs_pair_z_batch(x_batch: np.ndarray, game: Game = GAME) -> np.ndarray:
    """(S, T, N) incidence → (S,) max |z_ij| (i<j)."""
    S, T, N = x_batch.shape
    xb = x_batch.astype(np.float32)
    cooc = np.einsum("sti,stj->sij", xb, xb)
    p = game.p_pair
    z = (cooc - T * p) / np.sqrt(T * p * (1 - p))
    iu = np.triu_indices(N, 1)
    return np.max(np.abs(z[:, iu[0], iu[1]]), axis=1)


def genest_x2_batch(x_batch: np.ndarray, game: Game = GAME) -> np.ndarray:
    S, T, N = x_batch.shape
    xb = x_batch.astype(np.float32)
    cooc = np.einsum("sti,stj->sij", xb, xb)
    iu = np.triu_indices(N, 1)
    e = T * game.p_pair
    return np.sum((cooc[:, iu[0], iu[1]] - e) ** 2 / e, axis=1)


def pair_analysis(
    x: np.ndarray,
    game: Game = GAME,
    alpha: float = 0.05,
    delta: float = 0.25,
    null_max_z: np.ndarray | None = None,
    null_genest: np.ndarray | None = None,
) -> dict:
    T, N = x.shape
    cooc = cooccurrence(x)
    p = game.p_pair
    exp = T * p
    var = T * p * (1 - p)
    iu = np.triu_indices(N, 1)
    obs = cooc[iu]
    z = (obs - exp) / np.sqrt(var)
    lift = (obs / T) / p
    pvals = binom_two_sided_vec(obs, T, p)
    adj = adjust_all(pvals, alpha)
    freq = np.diag(cooc)
    cond = obs / np.maximum(freq[iu[0]], 1)  # P(j | i)
    p_maxt = maxt_pvalues(np.abs(z), null_max_z) if null_max_z is not None and len(null_max_z) else None

    rows = []
    for idx in range(len(obs)):
        i, j = int(iu[0][idx]) + 1, int(iu[1][idx]) + 1
        row = {
            "a": i,
            "b": j,
            "observed": int(obs[idx]),
            "expected": float(exp),
            "calibrated_lift": float(lift[idx]),
            "residual": float(obs[idx] - exp),
            "z": float(z[idx]),
            "cond_prob_b_given_a": float(cond[idx]),
            "cond_prob_null": game.p_conditional(1, 1),
            "p": float(pvals[idx]),
            "p_bonferroni": float(adj["p_bonferroni"][idx]),
            "p_holm": float(adj["p_holm"][idx]),
            "q_bh": float(adj["q_bh"][idx]),
            "q_by": float(adj["q_by"][idx]),
            "sig_bh": bool(adj["q_bh"][idx] < alpha),
        }
        if p_maxt is not None:
            row["p_maxT"] = float(p_maxt[idx])
            row["sig_fwer"] = bool(p_maxt[idx] < alpha)
        rows.append(row)

    X2 = float(np.sum((obs - exp) ** 2 / exp))
    w1, w2, df1, df2 = game.genest_pair_weights()
    genest = {
        "statistic": X2,
        "weights": {"w1": w1, "w2": w2, "df1": df1, "df2": df2},
        "mean_asymptotic": float(w1 * df1 + w2 * df2),
        "note": "점근분포 w1·χ²_{N-1} + w2·χ²_{N(N-3)/2} (Genest et al. 2002); p 는 MC 로 산출",
    }
    if null_genest is not None and len(null_genest):
        genest["p_mc"] = mc_pvalue(null_genest, X2)
    max_idx = int(np.argmax(np.abs(z)))
    summary = {
        "T": int(T),
        "n_pairs": int(len(obs)),
        "expected": float(exp),
        "p_pair": p,
        "naive_lift_null": game.naive_lift_null,
        "corr_null": game.corr_null,
        "n_sig_bh": int(np.sum(adj["q_bh"] < alpha)),
        "n_sig_by": int(np.sum(adj["q_by"] < alpha)),
        "n_raw_p05": int(np.sum(pvals < 0.05)),
        "expected_false_positives_raw": float(0.05 * len(obs)),
        "max_abs_z": float(np.abs(z[max_idx])),
        "max_pair": [int(iu[0][max_idx]) + 1, int(iu[1][max_idx]) + 1],
        "max_pair_p_maxT": None if p_maxt is None else float(p_maxt[max_idx]),
        "n_sig_fwer": None if p_maxt is None else int(np.sum(p_maxt < alpha)),
        "genest": genest,
    }
    # 네트워크 엣지: 보정 유의 ∧ 효과크기. 후보(탐색) 엣지: 상위 |z| 30
    edges = [
        {
            "source": r["a"],
            "target": r["b"],
            "weight": abs(r["z"]),
            "lift": r["calibrated_lift"],
            "z": r["z"],
            "q_bh": r["q_bh"],
            "kind": "significant",
        }
        for r in rows
        if r["sig_bh"] and abs(r["calibrated_lift"] - 1) >= delta
    ]
    top = sorted(rows, key=lambda r: -abs(r["z"]))[:30]
    sig_keys = {(e["source"], e["target"]) for e in edges}
    for r in top:
        if (r["a"], r["b"]) not in sig_keys:
            edges.append(
                {
                    "source": r["a"],
                    "target": r["b"],
                    "weight": abs(r["z"]),
                    "lift": r["calibrated_lift"],
                    "z": r["z"],
                    "q_bh": r["q_bh"],
                    "kind": "exploratory",
                }
            )
    network = {
        "nodes": [
            {
                "id": i + 1,
                "frequency": int(freq[i]),
                "degree_sig": int(
                    sum(1 for e in edges if e["kind"] == "significant" and i + 1 in (e["source"], e["target"]))
                ),
            }
            for i in range(N)
        ],
        "edges": edges,
        "criteria": {"alpha": alpha, "delta": delta, "exploratory_top": 30},
    }
    return {
        "summary": summary,
        "rows": rows,
        "matrix": cooc.tolist(),
        "z_matrix": pair_z_matrix(cooc, T, game).round(3).tolist(),
        "network": network,
    }
