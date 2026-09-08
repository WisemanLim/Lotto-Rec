"""그룹 패턴 — 다변량 하이퍼지오메트릭 + MC 특성 영분포 (PRD §4.5)."""

from __future__ import annotations

import numpy as np
from scipy import stats

from app.core.features import FEATURE_NAMES, features_matrix
from app.core.null_model import GAME, Game

GROUP_SCHEMES: dict[str, tuple[str, int]] = {
    # 이름: (특성 컬럼, 그룹 내 번호 수 n_g) — 주변 분포 Hypergeom(N, n_g, k)
    "odd_count": ("odd_count", 23),
    "low_count": ("low_count", 22),
    "dec1": ("dec1", 10),
    "dec2": ("dec2", 10),
    "dec3": ("dec3", 10),
    "dec4": ("dec4", 10),
    "dec5": ("dec5", 5),
    "birthday_count": ("birthday_count", 31),
    "prime_count": ("prime_count", 14),
}
MC_SCHEMES = ["sum", "consecutive_pairs", "last_digit_dup", "range", "ac_value"]


def _gof(observed_counts: np.ndarray, expected_probs: np.ndarray, T: int) -> dict:
    """χ² 적합도 (기대도수 <5 셀 병합)."""
    exp = expected_probs * T
    obs = observed_counts.astype(float)
    # 병합: 기대 < 5 인 셀을 인접 셀과 합침 (끝에서부터)
    o, e = list(obs), list(exp)
    i = len(e) - 1
    while i > 0 and len(e) > 2:
        if e[i] < 5:
            e[i - 1] += e[i]
            o[i - 1] += o[i]
            del e[i]
            del o[i]
        i -= 1
    i = 0
    while len(e) > 2 and e[0] < 5:
        e[1] += e[0]
        o[1] += o[0]
        del e[0]
        del o[0]
    o_a, e_a = np.array(o), np.array(e)
    e_a = e_a * o_a.sum() / e_a.sum()
    chi2 = float(np.sum((o_a - e_a) ** 2 / e_a))
    df = max(len(e_a) - 1, 1)
    return {"chi2": chi2, "df": df, "p": float(stats.chi2.sf(chi2, df)), "cells_after_merge": len(e_a)}


def group_analysis(draws: np.ndarray, game: Game = GAME, null_features: np.ndarray | None = None) -> dict:
    """draws: (T, k). 하이퍼지오메트릭 주변분포 + MC 영분포 기반 특성 비교."""
    T = draws.shape[0]
    F = features_matrix(draws)
    col = {n: i for i, n in enumerate(FEATURE_NAMES)}
    out: dict[str, dict] = {}
    for name, (feat, n_g) in GROUP_SCHEMES.items():
        vals = F[:, col[feat]]
        support = np.arange(0, game.k + 1)
        pmf = stats.hypergeom.pmf(support, game.N, n_g, game.k)
        obs_counts = np.array([(vals == s).sum() for s in support])
        gof = _gof(obs_counts, pmf, T)
        out[name] = {
            "kind": "hypergeom",
            "n_group": n_g,
            "support": support.tolist(),
            "observed_counts": obs_counts.tolist(),
            "expected_counts": (pmf * T).round(2).tolist(),
            "observed_mean": float(vals.mean()),
            "expected_mean": float(game.k * n_g / game.N),
            **gof,
        }
    if null_features is not None and len(null_features):
        for feat in MC_SCHEMES:
            vals = F[:, col[feat]]
            nv = null_features[:, col[feat]]
            lo, hi = int(min(vals.min(), nv.min())), int(max(vals.max(), nv.max()))
            bins = np.arange(lo, hi + 2)
            obs_h, _ = np.histogram(vals, bins=bins)
            null_h, _ = np.histogram(nv, bins=bins)
            probs = null_h / null_h.sum()
            # 히스토그램 셀 병합 GOF
            gof = _gof(obs_h, probs, T)
            q = np.quantile(nv, [0.025, 0.1, 0.5, 0.9, 0.975])
            out[feat] = {
                "kind": "mc",
                "support": bins[:-1].tolist(),
                "observed_counts": obs_h.tolist(),
                "expected_counts": (probs * T).round(2).tolist(),
                "observed_mean": float(vals.mean()),
                "expected_mean": float(nv.mean()),
                "null_quantiles": {
                    "q025": float(q[0]),
                    "q10": float(q[1]),
                    "q50": float(q[2]),
                    "q90": float(q[3]),
                    "q975": float(q[4]),
                },
                **gof,
            }
    return {"T": int(T), "schemes": out, "feature_names": FEATURE_NAMES}


def null_feature_sample(seed: int, n: int = 200_000, game: Game = GAME) -> np.ndarray:
    """균등 조합 n 개의 특성 행렬 (MC 영분포). 캐시 대상."""
    rng = np.random.default_rng(seed)
    u = rng.random((n, game.N), dtype=np.float32)
    idx = np.argpartition(u, game.k - 1, axis=1)[:, : game.k] + 1
    return features_matrix(np.sort(idx, axis=1))


_TYP_CACHE: dict[int, dict] = {}
_TYP_FEATURES = ["sum", "odd_count", "low_count", "consecutive_pairs", "last_digit_dup", "range"]
_TYP_REPORT = [
    "sum",
    "odd_count",
    "low_count",
    "consecutive_pairs",
    "last_digit_dup",
    "range",
    "ac_value",
    "birthday_count",
]


def _typ_model(null_features: np.ndarray) -> dict:
    """영분포 통계 캐시 — 호출마다 200k 행 재계산 방지."""
    key = id(null_features)
    m = _TYP_CACHE.get(key)
    if m is not None:
        return m
    col = {n: i for i, n in enumerate(FEATURE_NAMES)}
    X = null_features[:, [col[c] for c in _TYP_FEATURES]].astype(float)
    mu = X.mean(axis=0)
    cov = np.cov(X, rowvar=False) + 1e-9 * np.eye(len(_TYP_FEATURES))
    inv = np.linalg.inv(cov)
    d_null = np.sort(np.einsum("ij,jk,ik->i", X - mu, inv, X - mu))
    per = {n: np.sort(null_features[:, col[n]].astype(float)) for n in _TYP_REPORT}
    stats_ = {n: (float(per[n].mean()), float(per[n].std())) for n in _TYP_REPORT}
    m = {"mu": mu, "inv": inv, "d_null": d_null, "per_sorted": per, "stats": stats_, "n": len(d_null)}
    if len(_TYP_CACHE) > 4:
        _TYP_CACHE.clear()
    _TYP_CACHE[key] = m
    return m


def typicality(nums: list[int], null_features: np.ndarray) -> dict:
    """조합의 특성별 영분포 분위수 + 종합 전형성 (마할라노비스 → MC p). 영분포 통계는 캐시."""
    from app.core.features import combo_features

    f = combo_features(nums)
    m = _typ_model(null_features)
    per: dict[str, dict] = {}
    for name in _TYP_REPORT:
        arr = m["per_sorted"][name]
        v = float(f[name])
        lo = np.searchsorted(arr, v, side="left")
        hi = np.searchsorted(arr, v, side="right")
        per[name] = {
            "value": int(v),
            "percentile": float((lo + 0.5 * (hi - lo)) / len(arr)),
            "null_mean": m["stats"][name][0],
            "null_sd": m["stats"][name][1],
        }
    v = np.array([f[c] for c in _TYP_FEATURES], dtype=float) - m["mu"]
    d_obs = float(v @ m["inv"] @ v)
    p = float((m["n"] - np.searchsorted(m["d_null"], d_obs, side="left")) / m["n"])
    return {
        "features": f,
        "per_feature": per,
        "mahalanobis": d_obs,
        "typicality_p": p,
        "note": "전형성은 당첨확률과 무관 — 모든 조합의 당첨확률은 동일",
    }
