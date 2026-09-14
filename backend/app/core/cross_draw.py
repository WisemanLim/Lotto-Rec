"""회차간 교차 공출현 — 전회차 번호 i → 후회차 번호 j (PRD §4.8 S2.13).

회차 t 의 i 와 t+ℓ 의 j 가 함께 나온 횟수 M^(ℓ)_ij (45×45, 방향 있음, 대각 = lag-ℓ 재출현).
독립 영가설: 모든 셀 p× = (k/N)², 기대 = (T-ℓ)·p× (기술 지표).
검정 통계량은 주변빈도(전회차 i 출현수 r_i, 후회차 j 출현수 c_j)를 조건부로 한 2×2 독립성 z:
  E_ij = r_i c_j / n,  V_ij = r_i (n-r_i) c_j (n-c_j) / (n²(n-1)),  z = (M-E)/√V   (n = T-ℓ 쌍 수)
— 무조건 이항 z 는 자주 나온 번호의 셀(특히 대각)을 '따라 나온다'로 오판하므로 사용하지 않는다.
간격 L 안의 lag 1..L 개별 + 창(합산: E·V 를 lag 별로 합) 분석. 셀별 p 는 정규근사, FWER 판정은 조건부 MC maxT.
경계 회차(앞·뒤 L 회)는 버리지 않고 간격 안에 존재하는 쌍 (t, t+ℓ), t+ℓ ≤ T 만 센다.
"""

from __future__ import annotations

import numpy as np
from scipy import stats

from app.core.multiple_testing import adjust_all, maxt_pvalues
from app.core.null_model import GAME, Game

TOP_ROWS_PER_LAG = 50


def p_cross(game: Game = GAME) -> float:
    """독립 영가설의 셀 확률 (k/N)²."""
    return game.p_single**2


def cross_cooccurrence(x: np.ndarray, lag: int) -> np.ndarray:
    """(T,N) incidence → (N,N): [i,j] = #{t : i∈D_t ∧ j∈D_{t+lag}}."""
    xi = x.astype(np.int64)
    return xi[:-lag].T @ xi[lag:]


def n_pairs_for_lag(T: int, lag: int) -> int:
    return max(T - lag, 0)


def cond_moments(x: np.ndarray, lag: int) -> tuple[np.ndarray, np.ndarray, int]:
    """주변빈도 조건부 기대 E (N,N)·분산 V (N,N)·쌍 수 n."""
    a = x[:-lag].astype(np.float64)
    b = x[lag:].astype(np.float64)
    n = a.shape[0]
    r = a.sum(axis=0)
    c = b.sum(axis=0)
    E = np.outer(r, c) / n
    V = np.outer(r * (n - r), c * (n - c)) / (n * n * max(n - 1, 1))
    return E, V, n


def _z(m: np.ndarray, E: np.ndarray, V: np.ndarray) -> np.ndarray:
    with np.errstate(invalid="ignore", divide="ignore"):
        z = (m - E) / np.sqrt(V)
    return np.nan_to_num(z, nan=0.0, posinf=0.0, neginf=0.0)


def max_abs_cross_z_batch(x_batch: np.ndarray, max_lag: int, game: Game = GAME) -> np.ndarray:
    """(S,T,N) → (S, L+1): 열 0..L-1 = lag 1..L 의 max |z| (N² 셀), 열 L = 창 합산의 max |z|. z 는 조건부 독립성 z."""
    S, T, N = x_batch.shape
    xb = x_batch.astype(np.float32)
    out = np.zeros((S, max_lag + 1), dtype=np.float64)
    m_win = np.zeros((S, N, N), dtype=np.float64)
    e_win = np.zeros((S, N, N), dtype=np.float64)
    v_win = np.zeros((S, N, N), dtype=np.float64)
    n_win = 0
    for lag in range(1, max_lag + 1):
        n = n_pairs_for_lag(T, lag)
        if n <= 1:
            continue
        a, b = xb[:, :-lag], xb[:, lag:]
        m = np.einsum("sti,stj->sij", a, b)
        r, c = a.sum(axis=1).astype(np.float64), b.sum(axis=1).astype(np.float64)
        E = np.einsum("si,sj->sij", r, c) / n
        V = np.einsum("si,sj->sij", r * (n - r), c * (n - c)) / (n * n * (n - 1))
        out[:, lag - 1] = np.max(np.abs(_z(m, E, V)), axis=(1, 2))
        m_win += m
        e_win += E
        v_win += V
        n_win += n
    if n_win > 0:
        out[:, max_lag] = np.max(np.abs(_z(m_win, e_win, v_win)), axis=(1, 2))
    return out


def _rows(
    m: np.ndarray,
    E: np.ndarray,
    V: np.ndarray,
    n_pairs: int,
    p: float,
    alpha: float,
    null_max_z: np.ndarray | None,
    top: int | None,
) -> dict:
    N = m.shape[0]
    obs = m.ravel().astype(np.int64)
    exp_h0 = n_pairs * p
    e_c = E.ravel()
    z = _z(obs.astype(np.float64), e_c, V.ravel())
    pvals = 2 * stats.norm.sf(np.abs(z))
    adj = adjust_all(pvals, alpha)
    p_maxt = maxt_pvalues(np.abs(z), null_max_z) if null_max_z is not None and len(null_max_z) else None
    order = np.argsort(-np.abs(z), kind="stable")
    if top is not None:
        order = order[:top]
    rows = []
    for idx in order:
        i, j = divmod(int(idx), N)
        row = {
            "prev": i + 1,
            "next": j + 1,
            "observed": int(obs[idx]),
            "expected": float(exp_h0),
            "expected_cond": float(e_c[idx]),
            "lift": float(obs[idx] / exp_h0) if exp_h0 > 0 else None,
            "cond_lift": float(obs[idx] / e_c[idx]) if e_c[idx] > 0 else None,
            "z": float(z[idx]),
            "p": float(pvals[idx]),
            "p_holm": float(adj["p_holm"][idx]),
            "q_bh": float(adj["q_bh"][idx]),
            "q_by": float(adj["q_by"][idx]),
            "sig_bh": bool(adj["q_bh"][idx] < alpha),
        }
        if p_maxt is not None:
            row["p_maxT"] = float(p_maxt[idx])
            row["sig_fwer"] = bool(p_maxt[idx] < alpha)
        rows.append(row)
    mx = int(np.argmax(np.abs(z)))
    d_obs, d_e, d_v = float(np.trace(m)), float(np.trace(E)), float(np.trace(V))
    summary = {
        "n_pairs": int(n_pairs),
        "n_cells": int(obs.size),
        "expected": float(exp_h0),
        "max_abs_z": float(abs(z[mx])),
        "max_cell": [mx // N + 1, mx % N + 1],
        "max_cell_p_maxT": None if p_maxt is None else float(p_maxt[mx]),
        "n_sig_bh": int(np.sum(adj["q_bh"] < alpha)),
        "n_sig_by": int(np.sum(adj["q_by"] < alpha)),
        "n_sig_fwer": None if p_maxt is None else int(np.sum(p_maxt < alpha)),
        "n_raw_p05": int(np.sum(pvals < 0.05)),
        "expected_false_positives_raw": float(0.05 * obs.size),
        "repeat": {  # 대각 합 = 같은 번호가 ℓ 회 뒤 재출현 (창이면 lag 합산)
            "observed": int(d_obs),
            "expected": float(N * exp_h0),
            "expected_cond": d_e,
            "z": float((d_obs - d_e) / np.sqrt(d_v)) if d_v > 0 else 0.0,
        },
    }
    return {
        "summary": summary,
        "rows": rows,
        "matrix": m.astype(np.int64).tolist(),
        "z_matrix": _z(m.astype(np.float64), E, V).round(3).tolist(),
    }


def cross_draw_analysis(
    x: np.ndarray,
    draw_no: np.ndarray,
    max_lag: int,
    game: Game = GAME,
    alpha: float = 0.05,
    null_max_z: np.ndarray | None = None,
) -> dict:
    """null_max_z: (B, L+1) — max_abs_cross_z_batch 와 같은 열 구조. 없으면 maxT 생략."""
    T, N = x.shape
    p = p_cross(game)
    L = int(min(max_lag, max(T - 2, 0)))
    nz: np.ndarray | None = None
    if null_max_z is not None and null_max_z.ndim == 2 and null_max_z.shape[1] == max_lag + 1:
        nz = null_max_z
    lags = []
    m_win = np.zeros((N, N), dtype=np.int64)
    e_win = np.zeros((N, N))
    v_win = np.zeros((N, N))
    n_win = 0
    for lag in range(1, L + 1):
        m = cross_cooccurrence(x, lag)
        E, V, n = cond_moments(x, lag)
        r = _rows(m, E, V, n, p, alpha, nz[:, lag - 1] if nz is not None else None, TOP_ROWS_PER_LAG)
        r["lag"] = lag
        r["draw_pairs"] = {
            "first": [int(draw_no[0]), int(draw_no[lag])],
            "last": [int(draw_no[-1 - lag]), int(draw_no[-1])],
        }
        lags.append(r)
        m_win += m
        e_win += E
        v_win += V
        n_win += n
    nz_win = nz[:, max_lag] if nz is not None and L == max_lag else None
    window = _rows(m_win, e_win, v_win, n_win, p, alpha, nz_win, None)
    window["lags"] = list(range(1, L + 1))
    # 전 lag 최대 (family = L × N² 셀)
    any_lag = None
    if nz is not None and L >= 1:
        per = [r["summary"]["max_abs_z"] for r in lags]
        arg = int(np.argmax(per))
        null_any = np.max(nz[:, :L], axis=1)
        any_lag = {
            "max_abs_z": float(per[arg]),
            "lag": lags[arg]["lag"],
            "cell": lags[arg]["summary"]["max_cell"],
            "p_maxT": float(np.mean(null_any >= per[arg])),
            "n_tests": int(L * N * N),
        }
    # 경계 커버리지: 각 회차가 '후회차' 역할로 참여한 쌍 수(앞 L 회차는 L 미만) / '전회차' 역할(뒤 L 회차는 L 미만)
    idx = np.arange(T)
    as_prev = np.minimum(L, T - 1 - idx)
    as_next = np.minimum(L, idx)
    coverage = {
        "draw_from": int(draw_no[0]),
        "draw_to": int(draw_no[-1]),
        "max_lag": int(max_lag),
        "effective_max_lag": L,
        "n_draws_partial_head": int(np.sum(as_next < L)),
        "n_draws_partial_tail": int(np.sum(as_prev < L)),
        "partial_head": [{"draw_no": int(draw_no[t]), "as_next": int(as_next[t])} for t in range(min(L, T))],
        "partial_tail": [{"draw_no": int(draw_no[t]), "as_prev": int(as_prev[t])} for t in range(max(T - L, 0), T)],
        "note": "경계 회차는 제외하지 않고 간격 안에 존재하는 전/후 쌍만 센다 (lag ℓ 쌍 수 = T−ℓ).",
    }
    alerts = []
    if window["summary"]["max_cell_p_maxT"] is not None and window["summary"]["max_cell_p_maxT"] < alpha:
        alerts.append(f"회차간 교차 창(1..{L}) 최대 셀 FWER 유의")
    if any_lag is not None and any_lag["p_maxT"] < alpha:
        alerts.append(f"회차간 교차 lag {any_lag['lag']} 최대 셀 FWER 유의")
    return {
        "T": int(T),
        "N": int(N),
        "max_lag": int(max_lag),
        "p_cell": p,
        "cell_semantics": "matrix[i-1][j-1] = 전회차에 i, 후회차에 j 가 함께 나온 횟수 (i=j 는 재출현)",
        "statistic": (
            "주변빈도 조건부 2×2 독립성 z (자주 나온 번호의 셀이 부풀려지지 않음). 기대(H0)=(T−ℓ)(k/N)² 는 기술 지표"
        ),
        "window": window,
        "lags": lags,
        "any_lag": any_lag,
        "coverage": coverage,
        "alerts": alerts,
        "note": (
            "독립 영가설에서 셀 확률은 (k/N)² 로 모두 같고 상관은 0 이다 (회차 내 쌍의 구조적 음상관 −1/44 과 다름). "
            f"{N * N}셀 탐색 시 약 {int(0.05 * N * N)}개의 우연 후보(p<0.05)가 정상. "
            "셀별 p 는 정규근사, FWER 판정은 MC maxT."
        ),
    }
