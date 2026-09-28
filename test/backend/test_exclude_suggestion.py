"""S4.15 (v1.31) — 제외 번호 '자동' 추천: 최근 trend_draws 회 동향(최다·최소 각 trend_draws//3 개)
중 직전 recent_draws 회 출현 번호와의 교집합에서 무작위로 제외 번호를 제안."""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


def _isolated_session():  # noqa: ANN201
    """공유 세션-스코프 DB(1~1000 seed)를 오염시키지 않도록 완전히 독립된 in-memory DB 사용."""
    from app.db import models  # noqa: F401  (메타데이터 등록)
    from app.db.base import Base

    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def _add_draw(session, draw_no: int, numbers: list[int]) -> None:  # noqa: ANN001
    from app.db.models import Draw

    assert len(numbers) == 6 and len(set(numbers)) == 6
    bonus = next(n for n in range(1, 11) if n not in numbers)
    n1, n2, n3, n4, n5, n6 = numbers
    session.add(Draw(draw_no=draw_no, n1=n1, n2=n2, n3=n3, n4=n4, n5=n5, n6=n6, bonus=bonus))


# 6 회차(pool=10 으로 축소) — 설계: 1(count6)·2(count5) = hot 후보, 9(count1)·10(count1) = cold 후보.
# 직전 2회(D5,D6)에는 1·2·10 이 나오고 9 는 나오지 않음 → 교집합은 정확히 {1,2,10}.
_DRAWS = {
    1: [1, 3, 4, 5, 6, 7],
    2: [1, 2, 4, 5, 6, 7],
    3: [1, 2, 5, 6, 7, 9],
    4: [1, 2, 3, 6, 7, 8],
    5: [1, 2, 3, 4, 8, 10],
    6: [1, 2, 3, 4, 5, 8],
}


def _seeded_small_pool_session(monkeypatch):  # noqa: ANN001, ANN201
    from app.core.config import settings

    monkeypatch.setattr(settings, "lotto_pool_size", 10)
    s = _isolated_session()
    for draw_no, numbers in _DRAWS.items():
        _add_draw(s, draw_no, numbers)
    s.commit()
    return s


def test_suggest_exclude_numbers_hot_cold_and_intersection(monkeypatch) -> None:  # noqa: ANN001
    from app.services.recommend_service import suggest_exclude_numbers

    s = _seeded_small_pool_session(monkeypatch)
    r = suggest_exclude_numbers(s, trend_draws=6, recent_draws=2, seed=1)
    assert r["trend_draws"] == 6 and r["recent_draws"] == 2 and r["trend_draws_used"] == 6
    assert r["hot_candidates"] == [1, 2]
    assert r["cold_candidates"] == [9, 10]
    assert r["recent_numbers"] == [1, 2, 3, 4, 5, 8, 10]
    assert r["intersection"] == [1, 2, 10]  # 9 는 직전 2회(D5,D6)에 없어 제외
    assert r["seed"] == 1
    assert 0 < len(r["selected"]) <= 2
    assert set(r["selected"]) <= {1, 2, 10}
    assert r["selected"] == sorted(r["selected"])


def test_suggest_exclude_numbers_seed_reproducible(monkeypatch) -> None:  # noqa: ANN001
    from app.services.recommend_service import suggest_exclude_numbers

    s = _seeded_small_pool_session(monkeypatch)
    r1 = suggest_exclude_numbers(s, trend_draws=6, recent_draws=2, seed=7)
    r2 = suggest_exclude_numbers(s, trend_draws=6, recent_draws=2, seed=7)
    assert r1["selected"] == r2["selected"]


def test_suggest_exclude_numbers_without_seed_varies_per_call(monkeypatch) -> None:  # noqa: ANN001
    """seed 미지정 → 호출마다 새 무작위 seed (고정 LOTTO_RANDOM_SEED 로 매번 같은 결과가 나오던 버그 회귀 방지)."""
    from app.services.recommend_service import suggest_exclude_numbers

    s = _seeded_small_pool_session(monkeypatch)
    results = [suggest_exclude_numbers(s, trend_draws=6, recent_draws=2) for _ in range(20)]
    assert len({r["seed"] for r in results}) > 1
    assert len({tuple(r["selected"]) for r in results}) > 1  # 교집합 {1,2,10} 중 2개 — 3가지 조합이 나와야 함
    replay = suggest_exclude_numbers(s, trend_draws=6, recent_draws=2, seed=results[0]["seed"])
    assert replay["selected"] == results[0]["selected"]  # 응답 seed 로 재현 가능


def test_suggest_exclude_numbers_empty_db() -> None:
    from app.services.recommend_service import suggest_exclude_numbers

    s = _isolated_session()
    r = suggest_exclude_numbers(s, trend_draws=30, recent_draws=5, seed=1)
    assert r == {
        "selected": [],
        "trend_draws": 30,
        "recent_draws": 5,
        "trend_draws_used": 0,
        "hot_candidates": [],
        "cold_candidates": [],
        "recent_numbers": [],
        "intersection": [],
        "seed": 1,
        "note": "적재된 회차가 없습니다.",
    }


def test_exclude_suggestion_api_defaults_and_reproducibility(seeded: None, client) -> None:  # noqa: ANN001
    from app.core.config import settings

    r = client.post("/api/v1/recommend/exclude-suggestion", json={})
    assert r.status_code == 200, r.text
    body = r.json()
    # 미지정 시 .env.local 의 LOTTO_EXCLUDE_TREND_DRAWS/LOTTO_EXCLUDE_RECENT_DRAWS 를 따른다(사용자 오버라이드 가능)
    assert body["trend_draws"] == settings.lotto_exclude_trend_draws
    assert body["recent_draws"] == settings.lotto_exclude_recent_draws
    assert all(1 <= n <= 45 for n in body["selected"])
    assert body["selected"] == sorted(body["selected"])

    r1 = client.post("/api/v1/recommend/exclude-suggestion", json={"trend_draws": 9, "recent_draws": 3, "seed": 3})
    r2 = client.post("/api/v1/recommend/exclude-suggestion", json={"trend_draws": 9, "recent_draws": 3, "seed": 3})
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["selected"] == r2.json()["selected"]


def test_exclude_suggestion_out_of_range_422(seeded: None, client) -> None:  # noqa: ANN001
    assert client.post("/api/v1/recommend/exclude-suggestion", json={"trend_draws": 2}).status_code == 422
    assert client.post("/api/v1/recommend/exclude-suggestion", json={"trend_draws": 201}).status_code == 422
    assert client.post("/api/v1/recommend/exclude-suggestion", json={"recent_draws": 0}).status_code == 422
    assert client.post("/api/v1/recommend/exclude-suggestion", json={"recent_draws": 51}).status_code == 422
