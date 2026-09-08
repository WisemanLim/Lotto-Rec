"""시간적 무작위성 — overlap·자기상관·runs·gap·Ljung–Box·변화점 (PRD §4.8)."""

from __future__ import annotations

import numpy as np
from scipy import stats

from app.core.multiple_testing import adjust_all, maxt_pvalues
from app.core.null_model import GAME, Game, mc_pvalue


def overlap_series(x: np.ndarray, lag: int = 1) -> np.ndarray:
    return (x[:-lag].astype(np.int64) * x[lag:].astype(np.int64)).sum(axis=1)


def overlap_batch_mean(x_batch: np.ndarray) -> np.ndarray:
    return (x_batch[:, :-1].astype(np.int64) * x_batch[:, 1:].astype(np.int64)).sum(axis=2).mean(axis=1)


def lag_autocorr(x: np.ndarray, lag: int) -> np.ndarray:
    """번호별 lag 자기상관 (T-lag 쌍)."""
    a = x[:-lag].astype(float)
    b = x[lag:].astype(float)
    a = a - a.mean(axis=0)
    b = b - b.mean(axis=0)
    denom = np.sqrt((a**2).sum(axis=0) * (b**2).sum(axis=0))
    with np.errstate(invalid="ignore", divide="ignore"):
        r = (a * b).sum(axis=0) / denom
    return np.nan_to_num(r)


def max_abs_lag1_batch(x_batch: np.ndarray) -> np.ndarray:
    a = x_batch[:, :-1].astype(np.float32)
    b = x_batch[:, 1:].astype(np.float32)
    a = a - a.mean(axis=1, keepdims=True)
    b = b - b.mean(axis=1, keepdims=True)
    num = (a * b).sum(axis=1)
    den = np.sqrt((a**2).sum(axis=1) * (b**2).sum(axis=1))
    with np.errstate(invalid="ignore", divide="ignore"):
        r = np.nan_to_num(num / den)
    return np.max(np.abs(r), axis=1)


def runs_test_binary(seq: np.ndarray) -> dict:
    """Wald–Wolfowitz runs test (불균형 이진열)."""
    s = np.asarray(seq).astype(int)
    n1, n0 = int(s.sum()), int(len(s) - s.sum())
    n = n1 + n0
    if n1 == 0 or n0 == 0:
        return {"runs": 1, "expected": 1.0, "z": 0.0, "p": 1.0}
    runs = 1 + int(np.sum(s[1:] != s[:-1]))
    mu = 1 + 2 * n1 * n0 / n
    var = 2 * n1 * n0 * (2 * n1 * n0 - n) / (n**2 * (n - 1))
    z = (runs - mu) / np.sqrt(var) if var > 0 else 0.0
    return {"runs": runs, "expected": float(mu), "z": float(z), "p": float(2 * stats.norm.sf(abs(z)))}


def cusum_max_batch(x_batch: np.ndarray, p: float) -> np.ndarray:
    """(S,T,N) → (S,) 번호별 표준화 CUSUM 최대 절대값의 최대."""
    S, T, N = x_batch.shape
    dev = np.cumsum(x_batch.astype(np.float32) - p, axis=1) / np.sqrt(T * p * (1 - p))
    return np.max(np.abs(dev), axis=(1, 2))


def temporal_analysis(
    x: np.ndarray,
    draws: np.ndarray,
    draw_no: np.ndarray,
    game: Game = GAME,
    alpha: float = 0.05,
    max_lag: int = 10,
    null_overlap_mean: np.ndarray | None = None,
    null_max_lag1: np.ndarray | None = None,
    null_cusum_max: np.ndarray | None = None,
) -> dict:
    T, N = x.shape
    p = game.p_single
    # 1) overlap
    ov = overlap_series(x, 1)
    pmf = game.overlap_pmf()
    support = np.arange(game.k + 1)
    obs_counts = np.array([(ov == r).sum() for r in support])
    exp_counts = pmf * len(ov)
    # 병합 GOF (기대<5)
    keep = exp_counts >= 5
    o_m = np.append(obs_counts[keep], obs_counts[~keep].sum())
    e_m = np.append(exp_counts[keep], exp_counts[~keep].sum())
    chi2 = float(np.sum((o_m - e_m) ** 2 / e_m))
    overlap = {
        "series": ov.tolist(),
        "draw_no": draw_no[1:].tolist(),
        "support": support.tolist(),
        "observed_counts": obs_counts.tolist(),
        "expected_counts": exp_counts.round(2).tolist(),
        "mean": float(ov.mean()),
        "expected_mean": game.expected_overlap,
        "chi2": chi2,
        "df": int(len(e_m) - 1),
        "p_chi2": float(stats.chi2.sf(chi2, len(e_m) - 1)),
        "lag_means": [float(overlap_series(x, L).mean()) for L in range(1, min(max_lag, T - 1) + 1)],
        "max_overlap": int(ov.max()),
        "n_ge3": int((ov >= 3).sum()),
        "p_ge3_null": float(pmf[3:].sum()),
        "expected_ge3": float(pmf[3:].sum() * len(ov)),
    }
    if null_overlap_mean is not None and len(null_overlap_mean):
        overlap["p_mc_mean"] = mc_pvalue(
            null_overlap_mean - game.expected_overlap, ov.mean() - game.expected_overlap, two_sided=True
        )

    # 2) lag autocorr per number
    lags = list(range(1, max_lag + 1))
    ac = np.array([lag_autocorr(x, L) for L in lags])  # (L, N)
    se = 1 / np.sqrt(T - np.array(lags))[:, None]
    z = ac / se
    pv = 2 * stats.norm.sf(np.abs(z))
    adj = adjust_all(pv.ravel(), alpha)
    q_bh = adj["q_bh"].reshape(pv.shape)
    lag1_maxT = None
    if null_max_lag1 is not None and len(null_max_lag1):
        lag1_maxT = maxt_pvalues(np.abs(ac[0]), null_max_lag1)
    autocorr = {
        "lags": lags,
        "matrix": ac.round(4).tolist(),
        "q_bh_matrix": q_bh.round(4).tolist(),
        "n_sig_bh": int((q_bh < alpha).sum()),
        "n_tests": int(pv.size),
        "max_abs_lag1": float(np.max(np.abs(ac[0]))),
        "argmax_lag1_number": int(np.argmax(np.abs(ac[0])) + 1),
        "lag1_p_maxT": None if lag1_maxT is None else lag1_maxT.round(4).tolist(),
        "lag1_maxT_min_p": None if lag1_maxT is None else float(lag1_maxT.min()),
    }
    # 3) runs per number
    runs = [{"number": i + 1, **runs_test_binary(x[:, i])} for i in range(N)]
    rp = np.array([r["p"] for r in runs])
    radj = adjust_all(rp, alpha)
    for i, r in enumerate(runs):
        r["q_bh"] = float(radj["q_bh"][i])
    # 4) gaps — 전체 번호 출현 간격 vs 기하분포(p=k/N)
    gaps: list[int] = []
    for i in range(N):
        t = np.flatnonzero(x[:, i])
        gaps.extend(np.diff(t).tolist())
    g = np.array(gaps)
    geo_mean = 1 / p
    gap = {
        "n": int(len(g)),
        "mean": float(g.mean()) if len(g) else None,
        "expected_mean": geo_mean,
        "max": int(g.max()) if len(g) else None,
        "current_gaps": [int(T - 1 - np.flatnonzero(x[:, i])[-1]) if x[:, i].any() else int(T) for i in range(N)],
    }
    if len(g):
        ks = stats.kstest(g, stats.geom(p).cdf)
        gap["ks_p"] = float(ks.pvalue)
    # 5) Ljung–Box on 회차 특성 시계열 (합, 홀수개수)
    from statsmodels.stats.diagnostic import acorr_ljungbox

    from app.core.features import features_matrix

    F = features_matrix(draws)
    lb = {}
    for name, ci in (("sum", 0), ("odd_count", 1), ("low_count", 2)):
        r = acorr_ljungbox(F[:, ci].astype(float), lags=[10], return_df=True)
        lb[name] = {"lb_stat": float(r["lb_stat"].iloc[0]), "p": float(r["lb_pvalue"].iloc[0]), "lags": 10}
    # 6) 변화점 — CUSUM(번호별, MC maxT) + PELT(특성 시계열)
    dev = np.cumsum(x.astype(float) - p, axis=0) / np.sqrt(T * p * (1 - p))
    cusum_max = float(np.max(np.abs(dev)))
    cusum_arg = np.unravel_index(np.argmax(np.abs(dev)), dev.shape)
    cp: dict = {
        "cusum_max": cusum_max,
        "cusum_number": int(cusum_arg[1] + 1),
        "cusum_draw_no": int(draw_no[cusum_arg[0]]),
    }
    if null_cusum_max is not None and len(null_cusum_max):
        cp["cusum_p_mc"] = mc_pvalue(null_cusum_max, cusum_max)
    try:
        import ruptures as rpt

        sig = (F[:, :3].astype(float) - F[:, :3].mean(axis=0)) / (F[:, :3].std(axis=0) + 1e-9)
        algo = rpt.Pelt(model="rbf", min_size=50).fit(sig)
        bkps = algo.predict(pen=3 * np.log(T))
        cp["pelt_breakpoints_draw_no"] = [int(draw_no[b - 1]) for b in bkps[:-1]]
        cp["pelt_note"] = "특성(합·홀수·저번호) 표준화 시계열, rbf, pen=3·log T. 다중시점 탐색 — 확증 아님"
    except Exception as exc:  # pragma: no cover
        cp["pelt_error"] = str(exc)
    # rolling window 빈도 편향 점수
    win = 100
    roll = []
    for s in range(0, T - win + 1, 20):
        c = x[s : s + win].sum(axis=0)
        e = win * p
        roll.append(
            {
                "start_draw_no": int(draw_no[s]),
                "end_draw_no": int(draw_no[s + win - 1]),
                "x2": float(np.sum((c - e) ** 2 / e)),
                "max_abs_z": float(np.max(np.abs(c - e)) / np.sqrt(win * p * (1 - p))),
            }
        )
    alerts = []
    if overlap.get("p_mc_mean", 1) < alpha:
        alerts.append("인접 회차 중복수 평균 이상")
    if autocorr["lag1_maxT_min_p"] is not None and autocorr["lag1_maxT_min_p"] < alpha:
        alerts.append("lag-1 자기상관 maxT 유의")
    if cp.get("cusum_p_mc", 1) < alpha:
        alerts.append("CUSUM 변화점 유의")
    return {
        "T": int(T),
        "overlap": overlap,
        "autocorr": autocorr,
        "runs": runs,
        "runs_n_sig_bh": int((radj["q_bh"] < alpha).sum()),
        "gap": gap,
        "ljung_box": lb,
        "changepoint": cp,
        "rolling": roll,
        "alerts": alerts,
    }
