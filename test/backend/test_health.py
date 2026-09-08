"""스캐폴드 스모크 — health / config 엔드포인트."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_config_exposes_recommendation_count() -> None:
    r = client.get("/api/v1/config")
    assert r.status_code == 200
    body = r.json()
    assert 1 <= body["lotto_number_recommendation_count"] <= 50
    assert body["lotto_pool_size"] == 45
    assert body["lotto_main_count"] == 6
    assert body["mc_iterations"]["deep"] == 500_000


def test_timestamps_carry_utc_offset_and_timezone_config(seeded: None) -> None:  # noqa: ANN001
    """PRD §10 LOTTO_TIMEZONE: 모든 ISO 시각은 오프셋 포함(UTC), /config 에 표시 시간대."""
    cfg = client.get("/api/v1/config").json()
    assert cfg["timezone"] == "Asia/Seoul"
    imports = client.get("/api/v1/data/imports").json()
    assert imports and imports[0]["created_at"].endswith("+00:00")
    from datetime import datetime

    from app.core.timeutil import to_iso

    assert to_iso(None) is None
    assert to_iso(datetime(2026, 9, 8, 6, 2, 55)) == "2026-09-08T06:02:55+00:00"
