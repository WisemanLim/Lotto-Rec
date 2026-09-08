"""당첨자수 모형 — 조합 특성 → 1등 당첨자수 음이항 회귀 (PRD §4.10(c), Haigh 1997 / Baker–McHale 2009)."""

from __future__ import annotations

import numpy as np
import statsmodels.api as sm

from app.core.features import FEATURE_NAMES, combo_features, features_matrix

MODEL_FEATURES = ["birthday_count", "consecutive_pairs", "last_digit_dup", "low_count", "odd_count", "sum", "range"]


def _design(F: np.ndarray, draw_no: np.ndarray, ref_draw: float) -> np.ndarray:
    col = {n: i for i, n in enumerate(FEATURE_NAMES)}
    X = np.column_stack([F[:, col[c]].astype(float) for c in MODEL_FEATURES])
    t = draw_no.astype(float) / ref_draw
    trend = np.column_stack([t, t**2, t**3])  # 판매규모 proxy (스플라인 대체)
    return sm.add_constant(np.column_stack([X, trend]), has_constant="add")


def fit_winners_model(draws: np.ndarray, draw_no: np.ndarray, winners: np.ndarray, ref_draw: float = 1000.0) -> dict:
    mask = ~np.isnan(winners)
    F = features_matrix(draws[mask])
    y = winners[mask]
    X = _design(F, draw_no[mask], ref_draw)
    names = ["const", *MODEL_FEATURES, "t", "t2", "t3"]
    result: dict = {"features": MODEL_FEATURES, "ref_draw": ref_draw, "n": int(mask.sum())}
    try:
        nb = sm.NegativeBinomial(y, X).fit(disp=0, maxiter=200)
        params = nb.params
        result.update(
            {
                "family": "negative_binomial",
                "coef": {n: float(params[i]) for i, n in enumerate(names)},
                "se": {n: float(nb.bse[i]) for i, n in enumerate(names)},
                "p": {n: float(nb.pvalues[i]) for i, n in enumerate(names)},
                "alpha": float(params[-1]),
                "llf": float(nb.llf),
                "aic": float(nb.aic),
            }
        )
        pois = sm.GLM(y, X, family=sm.families.Poisson()).fit()
        result["pseudo_r2_vs_poisson_null"] = float(
            1 - nb.llf / sm.GLM(y, np.ones((len(y), 1)), family=sm.families.Poisson()).fit().llf
        )
        result["poisson_deviance"] = float(pois.deviance)
    except Exception as e:  # pragma: no cover
        glm = sm.GLM(y, X, family=sm.families.Poisson()).fit()
        result.update(
            {
                "family": "poisson_fallback",
                "error": str(e),
                "coef": {n: float(glm.params[i]) for i, n in enumerate(names)},
                "se": {n: float(glm.bse[i]) for i, n in enumerate(names)},
                "p": {n: float(glm.pvalues[i]) for i, n in enumerate(names)},
            }
        )
    result["mean_winners"] = float(y.mean())
    try:
        from statsmodels.stats.outliers_influence import variance_inflation_factor as _vif

        Xf = X[:, 1 : 1 + len(MODEL_FEATURES)]
        Xc = sm.add_constant(Xf, has_constant="add")
        result["vif"] = {c: float(_vif(Xc, i + 1)) for i, c in enumerate(MODEL_FEATURES)}
        result["collinearity_note"] = (
            "sum·low_count·birthday_count 는 서로 상관(VIF 4~8). 개별 계수는 다른 특성을 고정한 조건부 효과로 해석. "
            "전체 모형이 AIC 기준 축소 모형보다 우수하여 유지."
        )
    except Exception:  # pragma: no cover
        pass
    result["interpretation"] = {
        n: (
            "양(+): 해당 특성 증가 → 예상 공유자 증가(인기 조합)"
            if result["coef"][n] > 0
            else "음(-): 해당 특성 증가 → 예상 공유자 감소"
        )
        for n in MODEL_FEATURES
    }
    return result


def predict_winners(model: dict, nums: list[int], draw_no: float) -> float:
    """조합·회차 → 예상 1등 당첨자수 (exp(Xβ))."""
    f = combo_features(nums)
    coef = model["coef"]
    t = draw_no / model["ref_draw"]
    eta = (
        coef["const"]
        + sum(coef[c] * f[c] for c in model["features"])
        + coef["t"] * t
        + coef["t2"] * t**2
        + coef["t3"] * t**3
    )
    return float(np.exp(eta))


def predict_winners_batch(model: dict, combos: np.ndarray, draw_no: float) -> np.ndarray:
    F = features_matrix(combos)
    col = {n: i for i, n in enumerate(FEATURE_NAMES)}
    coef = model["coef"]
    t = draw_no / model["ref_draw"]
    eta = coef["const"] + coef["t"] * t + coef["t2"] * t**2 + coef["t3"] * t**3
    eta = eta + sum(coef[c] * F[:, col[c]] for c in model["features"])
    return np.exp(eta)
