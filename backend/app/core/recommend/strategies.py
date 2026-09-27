"""추천 전략 구현 (파라미터화, PRD §4.10(d), §E4, §E9 S9.1).

모든 전략은 균등 무작위와 동일한 당첨확률을 가지며(공정 추첨 가정), 차이는 검증으로만 판단한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from app.core.null_model import GAME, Game
from app.core.pairs import cooccurrence

STRATEGIES: dict[str, dict] = {
    "uniform": {"label": "균등 무작위 (기준선)", "basis": "영가설 자체 — control", "expectation": "기준선"},
    "frequency_hot": {
        "label": "고빈도(핫)",
        "basis": "w ∝ (누적 출현수+1)^γ — 빈도 편향 가설 검정용",
        "expectation": "개선 없음 예상",
    },
    "frequency_cold": {
        "label": "저빈도/장기 미출현(콜드)",
        "basis": "w ∝ (현재 미출현 간격+1)^γ — 도박사의 오류 검정용",
        "expectation": "개선 없음 예상",
    },
    "bayesian_shrink": {
        "label": "베이즈 축소",
        "basis": "Beta-Binomial 사후평균 (C_i+a)/(T+a+b), a+b=strength",
        "expectation": "균등 수렴",
    },
    "pair_association": {
        "label": "쌍 연관 순차",
        "basis": "선택 번호와의 설계 보정 lift^λ 로 순차 조건부 가중",
        "expectation": "개선 없음 예상",
    },
    "pattern_typical": {
        "label": "전형성 필터",
        "basis": "균등 표본 후 특성이 영분포 HDR 안인 조합만",
        "expectation": "기준선과 동일 확률",
    },
    "low_competition": {
        "label": "저경쟁(공유자 최소)",
        "basis": "당첨자수 모형 예측 E[W] 최소 조합 우선 (Haigh 1997)",
        "expectation": "기대 분배금 ↑",
    },
    "hybrid": {
        "label": "혼합",
        "basis": "베이즈 가중 × 전형성 필터 → 저경쟁 순 선택",
        "expectation": "검증으로 판단",
    },
    "analysis_weighted": {
        "label": "군 A 분석 가중",
        "basis": "이력(t−1) 번호별 표준화 잔차 z 에 w ∝ exp(β·z), 선택 번호와의 Lift*^λ — β=λ=0 이면 균등",
        "expectation": "튠 루프가 0 으로 회귀하는지 자체가 검정",
    },
}

# 전략별 튜닝 파라미터 스키마 (PRD S9.1): name → {default, min, max, type, desc}
STRATEGY_PARAMS: dict[str, dict[str, dict]] = {
    "uniform": {},
    "frequency_hot": {
        "gamma": {"default": 1.0, "min": 0.25, "max": 3.0, "type": "float", "desc": "빈도 가중 지수"},
        "window": {"default": 0, "min": 0, "max": 1000, "type": "int", "desc": "최근 W 회만 사용 (0=전체)"},
    },
    "frequency_cold": {
        "gamma": {"default": 1.0, "min": 0.25, "max": 3.0, "type": "float", "desc": "간격 가중 지수"},
        "window": {"default": 0, "min": 0, "max": 1000, "type": "int", "desc": "최근 W 회만 사용 (0=전체)"},
    },
    "bayesian_shrink": {
        "strength": {"default": 500.0, "min": 10.0, "max": 5000.0, "type": "float", "desc": "사전 강도 a+b"},
    },
    "pair_association": {
        "lift_power": {"default": 1.0, "min": 0.25, "max": 3.0, "type": "float", "desc": "Lift* 지수 λ"},
        "floor": {"default": 0.05, "min": 0.01, "max": 0.5, "type": "float", "desc": "Lift 하한"},
        "strength": {"default": 500.0, "min": 10.0, "max": 5000.0, "type": "float", "desc": "첫 번호 베이즈 강도"},
    },
    "pattern_typical": {
        "hdr": {"default": 0.8, "min": 0.5, "max": 0.95, "type": "float", "desc": "전형성 HDR 수준"},
    },
    "low_competition": {
        "candidate_pool": {"default": 3000, "min": 500, "max": 5000, "type": "int", "desc": "후보 조합 수"},
    },
    "hybrid": {
        "strength": {"default": 500.0, "min": 10.0, "max": 5000.0, "type": "float", "desc": "베이즈 강도"},
        "hdr": {"default": 0.8, "min": 0.5, "max": 0.95, "type": "float", "desc": "전형성 HDR"},
        "candidate_pool": {"default": 3000, "min": 500, "max": 5000, "type": "int", "desc": "후보 조합 수"},
    },
    "analysis_weighted": {
        "beta": {"default": 0.5, "min": 0.0, "max": 2.0, "type": "float", "desc": "z 가중 β (0=균등)"},
        "lift_power": {"default": 0.0, "min": 0.0, "max": 2.0, "type": "float", "desc": "Lift* 지수 λ (0=무시)"},
        "window": {"default": 0, "min": 0, "max": 1000, "type": "int", "desc": "최근 W 회만 사용 (0=전체)"},
    },
}


def default_params(strategy: str) -> dict:
    return {k: v["default"] for k, v in STRATEGY_PARAMS.get(strategy, {}).items()}


def merge_params(strategy: str, params: dict | None) -> dict:
    """기본값 병합 + 범위 절단 + 타입 정규화."""
    schema = STRATEGY_PARAMS.get(strategy, {})
    out = default_params(strategy)
    for k, v in (params or {}).items():
        if k not in schema or v is None:
            continue
        spec = schema[k]
        val = float(v)
        val = min(max(val, spec["min"]), spec["max"])
        out[k] = int(round(val)) if spec["type"] == "int" else float(val)
    return out


@dataclass
class Context:
    """전략 입력 — 회차 t 예측 시 t-1 까지의 이력만 사용."""

    incidence: np.ndarray  # (T, N) 본번호
    draw_no_next: int
    game: Game = GAME
    winners_model: dict | None = None
    null_features: np.ndarray | None = None
    extra: dict = field(default_factory=dict)

    @property
    def T(self) -> int:
        return int(self.incidence.shape[0])

    def counts(self, window: int = 0) -> np.ndarray:
        x = self.incidence if not window or window >= self.T else self.incidence[-int(window) :]
        return x.sum(axis=0).astype(float)

    def z_scores(self, window: int = 0) -> np.ndarray:
        """번호별 표준화 잔차 (이항 근사) — 군 A 분석의 z 와 동일 정의."""
        x = self.incidence if not window or window >= self.T else self.incidence[-int(window) :]
        T = x.shape[0]
        if T == 0:
            return np.zeros(self.game.N)
        p = self.game.p_single
        return (x.sum(axis=0) - T * p) / np.sqrt(T * p * (1 - p))

    @property
    def current_gaps(self) -> np.ndarray:
        T, N = self.incidence.shape
        gaps = np.full(N, T, dtype=float)
        for i in range(N):
            hits = np.flatnonzero(self.incidence[:, i])
            if len(hits):
                gaps[i] = T - 1 - hits[-1]
        return gaps

    def lift_matrix(self) -> np.ndarray:
        x = self.incidence
        T = max(x.shape[0], 1)
        cooc = cooccurrence(x).astype(float)
        lift = (cooc / T) / self.game.p_pair
        np.fill_diagonal(lift, 0.0)
        return lift


def weighted_sample_without_replacement(rng: np.random.Generator, w: np.ndarray, k: int) -> np.ndarray:
    """Efraimidis–Spirakis A-Res: key = u^(1/w) 상위 k."""
    w = np.clip(np.asarray(w, dtype=float), 1e-12, None)
    u = rng.random(len(w))
    keys = u ** (1.0 / w)
    return np.sort(np.argpartition(-keys, k - 1)[:k] + 1)


# --- 가중치 함수 (params 반영) ---
def w_uniform(ctx: Context, p: dict) -> np.ndarray:
    return np.ones(ctx.game.N)


def w_hot(ctx: Context, p: dict) -> np.ndarray:
    return (ctx.counts(p.get("window", 0)) + 1.0) ** p.get("gamma", 1.0)


def w_cold(ctx: Context, p: dict) -> np.ndarray:
    return (ctx.current_gaps + 1.0) ** p.get("gamma", 1.0)


def w_bayes(ctx: Context, p: dict) -> np.ndarray:
    strength = p.get("strength", 500.0)
    p0 = ctx.game.p_single
    a, b = strength * p0, strength * (1 - p0)
    return (ctx.counts() + a) / (ctx.T + a + b)


def w_analysis(ctx: Context, p: dict) -> np.ndarray:
    z = ctx.z_scores(p.get("window", 0))
    return np.exp(p.get("beta", 0.5) * z)


WEIGHT_FUNCS = {
    "uniform": w_uniform,
    "frequency_hot": w_hot,
    "frequency_cold": w_cold,
    "bayesian_shrink": w_bayes,
    "pair_association": w_bayes,
    "pattern_typical": w_uniform,
    "low_competition": w_uniform,
    "hybrid": w_bayes,
    "analysis_weighted": w_analysis,
}


def probability_vector(ctx: Context, strategy: str, params: dict | None = None) -> np.ndarray:
    """번호별 출현확률 예보 (Σ=k) — 스코어링 규칙 평가용. 조합 단위 전략은 가중 함수 기준."""
    p = merge_params(strategy, params)
    w = WEIGHT_FUNCS.get(strategy, w_uniform)(ctx, p)
    pv = w / w.sum() * ctx.game.k
    return np.clip(pv, 1e-6, 1 - 1e-6)


# --- 티켓 생성 ---
def _passes_coverage(ticket: np.ndarray, chosen: list[np.ndarray], max_shared: int) -> bool:
    return all(len(np.intersect1d(ticket, c)) <= max_shared for c in chosen)


def _typical(ticket: np.ndarray, ctx: Context, hdr: float) -> bool:
    if ctx.null_features is None:
        return True
    from app.core.groups import typicality

    return typicality(list(ticket), ctx.null_features)["typicality_p"] >= (1 - hdr)


def _sequential_with_lift(
    rng: np.random.Generator, ctx: Context, base_w: np.ndarray, lift: np.ndarray, power: float, floor: float
) -> np.ndarray:
    """첫 번호 base_w, 이후는 base_w × Π clip(Lift*(선택, 후보), floor)^power."""
    N = ctx.game.N
    chosen: list[int] = []
    for _ in range(ctx.game.k):
        ww = base_w.copy()
        for c in chosen:
            ww *= np.clip(lift[c - 1], floor, None) ** power
        for c in chosen:
            ww[c - 1] = 0.0
        ww = np.clip(ww, 0, None)
        if ww.sum() <= 0:
            ww = np.ones(N)
            for c in chosen:
                ww[c - 1] = 0.0
        pick = int(rng.choice(np.arange(1, N + 1), p=ww / ww.sum()))
        chosen.append(pick)
    return np.array(sorted(chosen))


def generate(
    strategy: str,
    ctx: Context,
    n_tickets: int,
    seed: int,
    max_shared: int | None = None,
    params: dict | None = None,
    exclude: set[int] | None = None,
) -> tuple[list[list[int]], dict]:
    """전략별 티켓 n 개. 반환: (tickets, meta). params 는 STRATEGY_PARAMS 기준 병합.

    exclude 가 있으면 그 번호가 하나라도 포함된 조합은 생성하지 않는다(거부 표본추출, S4.14).
    """
    if strategy not in STRATEGIES:
        raise ValueError(f"알 수 없는 전략: {strategy}")
    p = merge_params(strategy, params)
    rng = np.random.default_rng(seed)
    k = ctx.game.k
    tickets: list[np.ndarray] = []
    meta: dict = {
        "strategy": strategy,
        "seed": seed,
        "history_T": ctx.T,
        "target_draw_no": ctx.draw_no_next,
        "params": p,
    }
    max_shared = k if max_shared is None else max_shared

    if strategy in ("low_competition", "hybrid"):
        if ctx.winners_model is None or "coef" not in ctx.winners_model:
            strategy_eff = "uniform" if strategy == "low_competition" else "bayesian_shrink"
            tks, m2 = generate(
                strategy_eff, ctx, n_tickets, seed, max_shared, p if strategy == "hybrid" else None, exclude
            )
            m2.update({"strategy": strategy, "params": p, "fallback": f"winners_model 없음 → {strategy_eff}"})
            return tks, m2
        from app.core.winners_model import predict_winners_batch

        base_w = w_bayes(ctx, p) if strategy == "hybrid" else w_uniform(ctx, p)
        pool = int(p.get("candidate_pool", 3000))
        cands = np.array([weighted_sample_without_replacement(rng, base_w, k) for _ in range(pool)])
        if exclude:  # 제외 번호는 항상 강제(하드 제약) — 부족하면 후보가 n_tickets 보다 적게 남을 수 있음
            keep_ex = np.array([not exclude.intersection(c.tolist()) for c in cands])
            cands = cands[keep_ex]
        if strategy == "hybrid" and ctx.null_features is not None and len(cands) > 0:
            keep = np.array([_typical(c, ctx, p.get("hdr", 0.8)) for c in cands])
            if keep.sum() >= n_tickets:
                cands = cands[keep]
        pred = predict_winners_batch(ctx.winners_model, cands, float(ctx.draw_no_next))
        order = np.argsort(pred)
        meta["predicted_winners_pool_mean"] = float(pred.mean())
        picked_pred: list[float] = []
        for idx in order:
            t = cands[idx]
            if any(np.array_equal(t, c) for c in tickets):
                continue
            if _passes_coverage(t, tickets, max_shared):
                tickets.append(t)
                picked_pred.append(float(pred[idx]))
            if len(tickets) >= n_tickets:
                break
        meta["predicted_winners_selected_mean"] = float(np.mean(picked_pred)) if picked_pred else None
        return [t.tolist() for t in tickets], meta

    base_w = WEIGHT_FUNCS[strategy](ctx, p)
    lift = None
    lift_power = float(p.get("lift_power", 0.0)) if strategy in ("pair_association", "analysis_weighted") else 0.0
    if strategy == "pair_association" or lift_power > 0:
        lift = ctx.lift_matrix()
    floor = float(p.get("floor", 0.05))
    attempts = 0
    while len(tickets) < n_tickets and attempts < n_tickets * 500:
        attempts += 1
        if lift is not None:
            t = _sequential_with_lift(rng, ctx, base_w, lift, lift_power if lift_power > 0 else 1.0, floor)
        else:
            t = weighted_sample_without_replacement(rng, base_w, k)
        if exclude and exclude.intersection(t.tolist()):
            continue
        if strategy == "pattern_typical" and not _typical(t, ctx, p.get("hdr", 0.8)):
            continue
        if any(np.array_equal(t, c) for c in tickets):
            continue
        if not _passes_coverage(t, tickets, max_shared):
            continue
        tickets.append(t)
    meta["attempts"] = attempts
    if len(tickets) < n_tickets:
        reason = "제외 번호·커버리지 제약" if exclude else "커버리지 제약"
        meta["warning"] = f"{reason}으로 {len(tickets)}개만 생성"
    return [t.tolist() for t in tickets], meta
