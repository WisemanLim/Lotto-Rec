"""추천 정합성 분석 (PRD S8.7) — 추천 티켓 전체 vs 실제 추첨 결과.

순수 계산 모듈(DB 비의존). 검정 단위:
- 등수 분포: 등수별 이항 양측 p, 일치수(0~6) 카이제곱 적합도 (티켓을 독립으로 근사)
- 번호 상관: 회차별 (추천 빈도 × 당첨 여부) 상관 r_d 의 회차 평균 t 검정 (회차는 영가설에서 독립)
- 번호쌍 상관: 회차별 고유 추천쌍 중 양쪽 당첨 비율의 기대 대비 초과분 평균 t 검정
전략×검정 전체에 BH 보정(q)을 적용한다.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from itertools import combinations
from math import comb

import numpy as np
from scipy import stats

from app.core.multiple_testing import adjust_all
from app.core.null_model import GAME

MIN_DRAWS = 5  # 회차 단위 검정 최소 표본
RANKS = (0, 1, 2, 3, 4, 5)


def _rank_expected_probs() -> list[float]:
    rp = GAME.rank_probabilities()
    p = [rp[f"rank{k}"] for k in range(1, 6)]
    return [1.0 - sum(p), *p]


def _rank_dist(ranks: Sequence[int]) -> list[dict]:
    n = len(ranks)
    probs = _rank_expected_probs()
    out = []
    for k, pk in zip(RANKS, probs, strict=True):
        obs = int(sum(1 for r in ranks if r == k))
        p = float(stats.binomtest(obs, n, pk).pvalue) if n else 1.0
        share = obs / n if n else 0.0
        out.append({"rank": k, "observed": obs, "expected": pk * n, "share": share, "expected_share": pk, "p": p})
    return out


def _match_gof(matches: Sequence[int]) -> dict:
    """일치수 0..6 카이제곱 적합도. 기대도수 < 5 셀은 인접 셀(윗쪽 꼬리)로 병합."""
    n = len(matches)
    md = GAME.match_distribution()
    obs = np.array([sum(1 for m in matches if m == i) for i in range(len(md))], dtype=float)
    exp = np.asarray(md, dtype=float) * n
    o_b: list[float] = []
    e_b: list[float] = []
    acc_o = acc_e = 0.0
    for o, e in zip(obs[::-1], exp[::-1], strict=True):  # 꼬리부터 병합
        acc_o += o
        acc_e += e
        if acc_e >= 5:
            o_b.append(acc_o)
            e_b.append(acc_e)
            acc_o = acc_e = 0.0
    if acc_e > 0:  # 남은 잔여는 마지막(가장 큰 기대도수) 빈에 흡수
        if e_b:
            o_b[-1] += acc_o
            e_b[-1] += acc_e
        else:
            o_b, e_b = [acc_o], [acc_e]
    o_a, e_a = np.array(o_b[::-1]), np.array(e_b[::-1])
    if len(o_a) < 2 or n == 0:
        return {"stat": None, "df": 0, "p": None, "bins": len(o_a)}
    stat = float(((o_a - e_a) ** 2 / e_a).sum())
    df = len(o_a) - 1
    return {"stat": stat, "df": df, "p": float(stats.chi2.sf(stat, df)), "bins": len(o_a)}


def _t_test(values: Sequence[float]) -> dict:
    v = np.asarray(values, dtype=float)
    if len(v) < MIN_DRAWS or float(v.std(ddof=1)) == 0.0:
        return {"n_draws": int(len(v)), "mean": float(v.mean()) if len(v) else None, "t": None, "p": None}
    res = stats.ttest_1samp(v, 0.0)
    return {"n_draws": int(len(v)), "mean": float(v.mean()), "t": float(res.statistic), "p": float(res.pvalue)}


def _number_corr(by_draw: dict[int, list[Sequence[int]]], winners: dict[int, set[int]]) -> dict:
    per_draw = []
    for d in sorted(by_draw):
        tks = by_draw[d]
        x = np.zeros(GAME.N)
        for t in tks:
            for n in t:
                x[n - 1] += 1
        x /= len(tks)
        y = np.zeros(GAME.N)
        for n in winners[d]:
            y[n - 1] = 1.0
        if float(x.std()) == 0.0:  # 전 티켓 동일/균등 → 상관 정의 불가
            continue
        per_draw.append({"draw_no": d, "r": float(np.corrcoef(x, y)[0, 1])})
    res = _t_test([r["r"] for r in per_draw])
    return {"mean_r": res["mean"], "n_draws": res["n_draws"], "t": res["t"], "p": res["p"], "per_draw": per_draw}


def _pair_corr(by_draw: dict[int, list[Sequence[int]]], winners: dict[int, set[int]]) -> dict:
    p0 = comb(GAME.k, 2) / comb(GAME.N, 2)
    excess = []
    pairs_total = hits_total = 0
    for d in sorted(by_draw):
        uniq = {pair for t in by_draw[d] for pair in combinations(sorted(t), 2)}
        if not uniq:
            continue
        hit = sum(1 for a, b in uniq if a in winners[d] and b in winners[d])
        pairs_total += len(uniq)
        hits_total += hit
        excess.append(hit / len(uniq) - p0)
    res = _t_test(excess)
    return {
        "pairs": pairs_total,
        "hits": hits_total,
        "expected_hits": pairs_total * p0,
        "p0": p0,
        "mean_excess_rate": res["mean"],
        "n_draws": res["n_draws"],
        "t": res["t"],
        "p": res["p"],
    }


def analyze_strategy(rows: Sequence[tuple[int, Sequence[int], int, int]], winners: dict[int, set[int]]) -> dict:
    """rows: (draw_no, ticket, main_matches, rank) — 한 전략의 대조된 티켓들."""
    by_draw: dict[int, list[Sequence[int]]] = {}
    for d, t, _m, _r in rows:
        by_draw.setdefault(d, []).append(t)
    n_draws = len(by_draw)
    return {
        "n_tickets": len(rows),
        "n_draws": n_draws,
        "insufficient": n_draws < MIN_DRAWS,
        "rank_dist": _rank_dist([r for *_x, r in rows]),
        "match_gof": _match_gof([m for _d, _t, m, _r in rows]),
        "number_corr": _number_corr(by_draw, winners),
        "pair_corr": _pair_corr(by_draw, winners),
    }


def _p_slots(res: dict) -> list[tuple[dict, str]]:
    """BH 대상 p 값을 가진 (dict, key) 목록 — 결과 dict 에 q 를 직접 써넣기 위함."""
    slots: list[tuple[dict, str]] = []
    for r in res["rank_dist"]:
        if r["rank"] >= 1:  # 낙첨(0등) 은 나머지 등수의 여집합이라 중복 검정 제외
            slots.append((r, "p"))
    slots.append((res["match_gof"], "p"))
    slots.append((res["number_corr"], "p"))
    slots.append((res["pair_corr"], "p"))
    return [(d, k) for d, k in slots if d.get(k) is not None]


def analyze(
    rows_by_strategy: Mapping[str, Sequence[tuple[int, Sequence[int], int, int]]],
    winners: dict[int, set[int]],
    *,
    alpha: float = 0.05,
    latest_draw: int | None = None,
) -> dict:
    strategies = {s: analyze_strategy(rows, winners) for s, rows in rows_by_strategy.items() if rows}
    slots = [(s, d, k) for s, res in strategies.items() if not res["insufficient"] for d, k in _p_slots(res)]
    if slots:
        q = adjust_all(np.array([d[k] for _s, d, k in slots]), alpha)["q_bh"]
        for (_s, d, _k), qv in zip(slots, q, strict=True):
            d["q"] = float(qv)
    n_tests = len(slots)
    actions, nexts = [], []
    for s, res in strategies.items():
        qs = [d["q"] for d, _k in _p_slots(res) if "q" in d]
        res["min_q"] = min(qs) if qs else None
        if res["insufficient"]:
            res["verdict"] = "insufficient"
        elif res["min_q"] is not None and res["min_q"] < alpha:
            res["verdict"] = "deviation"
            if s == "uniform":
                actions.append(f"{s}: 기준선(control)에서 유의 편차 — 전략이 아니라 데이터·평가 로직 점검 필요")
            else:
                actions.append(f"{s}: 유의 편차(q<{alpha}) — 재튜닝 후보. 홀드아웃 재검증 전에는 활성화하지 않음")
                note = "튠 구간 끝을 최신 회차로 확장한 실험 실행(E9)"
                nexts.append({"strategy": s, "tune_to": latest_draw, "note": note})
        else:
            res["verdict"] = "consistent"
    n_dev = sum(1 for r in strategies.values() if r["verdict"] == "deviation")
    if not strategies:
        summary = "대조된 추천 티켓이 없습니다."
    elif n_tests == 0:
        summary = f"표본 부족(회차 {MIN_DRAWS}개 미만) — 정합성 판정을 보류합니다. 결과가 쌓이면 자동 분석됩니다."
    elif n_dev == 0:
        summary = f"모든 전략이 균등 영가설과 구별되지 않습니다 — 로직 변경 근거 없음(검정 수 {n_tests}, BH 보정)."
    else:
        summary = f"{n_dev}개 전략에서 유의 편차 — 재튜닝 후보(반드시 홀드아웃 재검증)."
    return {
        "alpha": alpha,
        "n_tests": n_tests,
        "strategies": strategies,
        "feedback": {"summary": summary, "n_deviation": n_dev, "actions": actions, "next_experiment": nexts},
        "policy": (
            "모든 티켓의 이론 당첨확률은 동일하다. "
            "유의 편차는 표본 변동·다중검정 가능성을 함께 보고 홀드아웃 검증으로만 채택한다."
        ),
    }
