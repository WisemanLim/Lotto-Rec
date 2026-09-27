"""S4.14 (v1.29) — 제외 번호를 추천 생성('/recommend', '/recommend/sequential')에도 적용."""

from __future__ import annotations

import numpy as np
import pytest

from app.core.null_model import GAME
from app.core.recommend import strategies as strat


def _ctx(T: int = 300, seed: int = 0) -> strat.Context:
    from app.core.features import incidence_from_draws
    from app.core.null_model import simulate_draws

    d = simulate_draws(np.random.default_rng(seed), 1, T, GAME)[0]
    return strat.Context(incidence=incidence_from_draws(d, 45), draw_no_next=T + 1, game=GAME)


@pytest.mark.parametrize(
    "s", ["uniform", "frequency_hot", "frequency_cold", "bayesian_shrink", "pair_association", "analysis_weighted"]
)
def test_generate_never_includes_excluded_numbers(s: str) -> None:
    ctx = _ctx()
    exclude = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
    tickets, meta = strat.generate(s, ctx, 10, seed=5, exclude=exclude)
    assert len(tickets) == 10
    for t in tickets:
        assert not exclude.intersection(t)
    assert "warning" not in meta  # 10개 제외해도 나머지 35개로 충분히 생성 가능


def test_low_competition_and_hybrid_fallback_respect_exclude() -> None:
    ctx = _ctx()
    exclude = {40, 41, 42, 43, 44, 45}
    for s in ("low_competition", "hybrid"):
        tickets, meta = strat.generate(s, ctx, 5, seed=1, exclude=exclude)
        assert len(tickets) == 5 and "fallback" in meta
        for t in tickets:
            assert not exclude.intersection(t)


def test_pattern_typical_respects_exclude() -> None:
    from app.core.groups import null_feature_sample

    ctx = _ctx()
    ctx.null_features = null_feature_sample(0, 20_000, GAME)
    exclude = {11, 12, 13, 14, 15}
    tickets, _ = strat.generate("pattern_typical", ctx, 5, seed=2, exclude=exclude)
    assert len(tickets) == 5
    for t in tickets:
        assert not exclude.intersection(t)


def test_heavy_exclusion_degrades_gracefully_with_warning() -> None:
    """제외 번호가 많아 유효 조합을 찾기 어려우면(거부 표본추출 한계) 크래시 없이 일부만 반환하고 warning 을 남긴다.
    (반환된 티켓이 있다면 반드시 제외 번호를 지킨다 — 개수 보장은 하지 않음, 커버리지 제약과 동일한 성격의 한계)"""
    ctx = _ctx()
    exclude = set(range(1, 40))  # 1~39 제외, 40~45 만 허용 → 유효 조합이 사실상 1개뿐(C(6,6))
    tickets, meta = strat.generate("uniform", ctx, 5, seed=1, exclude=exclude)
    assert len(tickets) <= 5
    for t in tickets:
        assert not exclude.intersection(t)
    if len(tickets) < 5:
        assert "제외 번호" in meta["warning"]


def test_recommend_api_excludes_numbers(seeded: None, client) -> None:  # noqa: ANN001
    body_in = {
        "strategy": "uniform", "count": 20, "include_control": False, "save": False,
        "exclude_numbers": list(range(1, 21)),
    }
    r = client.post("/api/v1/recommend", json=body_in)
    assert r.status_code == 200, r.text
    body = r.json()
    tickets = [t["ticket"] for s in body["sets"] for t in s["tickets"]]
    assert len(tickets) == 20
    for t in tickets:
        assert not set(range(1, 21)).intersection(t)


def test_recommend_sequential_api_excludes_numbers(seeded: None, client) -> None:  # noqa: ANN001
    body_in = {
        "strategies": ["uniform", "frequency_hot"], "count": 10, "save": False,
        "exclude_numbers": [41, 42, 43, 44, 45],
    }
    r = client.post("/api/v1/recommend/sequential", json=body_in)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["failed"] == []
    tickets = [t["ticket"] for res in body["results"] for s in res["sets"] for t in s["tickets"]]
    assert len(tickets) == 20
    for t in tickets:
        assert not {41, 42, 43, 44, 45}.intersection(t)


def test_recommend_exclude_numbers_out_of_range_422(seeded: None, client) -> None:  # noqa: ANN001
    assert client.post("/api/v1/recommend", json={"strategy": "uniform", "exclude_numbers": [0]}).status_code == 422
    assert client.post("/api/v1/recommend", json={"strategy": "uniform", "exclude_numbers": [46]}).status_code == 422
    assert client.post("/api/v1/recommend/sequential", json={"exclude_numbers": [46]}).status_code == 422


def test_recommend_count_allows_up_to_200(seeded: None, client) -> None:  # noqa: ANN001
    body_in = {"strategy": "uniform", "count": 200, "include_control": False, "save": False}
    r = client.post("/api/v1/recommend", json=body_in)
    assert r.status_code == 200, r.text
    assert len(r.json()["sets"][0]["tickets"]) == 200
    assert client.post("/api/v1/recommend", json={"strategy": "uniform", "count": 201}).status_code == 422
