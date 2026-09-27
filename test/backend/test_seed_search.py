"""S4.13 (v1.22) — 추천 'SEED 값 생성' 무작위 탐색."""

from __future__ import annotations

import time

STRATEGY_IDS = {
    "uniform", "frequency_hot", "frequency_cold", "bayesian_shrink", "pair_association",
    "pattern_typical", "low_competition", "hybrid", "analysis_weighted",
}


def _poll(client, job_id: str, timeout: float = 20.0) -> dict:  # noqa: ANN001
    t0 = time.monotonic()
    while time.monotonic() - t0 < timeout:
        body = client.get(f"/api/v1/recommend/seed-search/{job_id}").json()
        if body["status"] != "running":
            return body
        time.sleep(0.05)
    raise AssertionError(f"timed out polling job {job_id}: {body}")


def test_seed_search_rank5_completes_and_fills_seed(seeded: None, client) -> None:  # noqa: ANN001
    """희망 등수 5등(3개 일치)은 기대 시행 수가 적어 빠르게 끝난다."""
    r = client.post("/api/v1/recommend/seed-search", json={"target_draw_no": 1000, "target_rank": 5})
    assert r.status_code == 200
    start = r.json()
    assert start["status"] == "running"
    assert start["target_draw_no"] == 1000 and start["compare_draw_no"] == 999
    assert start["target_rank"] == 5 and start["iterations"] == 0 and start["seed"] is None

    done = _poll(client, start["job_id"])
    assert done["status"] == "done"
    assert isinstance(done["seed"], int) and done["seed"] >= 1
    assert done["iterations"] == done["seed"]
    assert done["matched_strategy"] in STRATEGY_IDS
    assert done["matched_ticket"] is not None and len(done["matched_ticket"]) == 6
    assert done["matched_ticket"] == sorted(done["matched_ticket"])
    assert done["elapsed_seconds"] >= 0


def test_seed_search_default_target_draw_is_latest_plus_one(seeded: None, client) -> None:  # noqa: ANN001
    latest = client.get("/api/v1/user/tickets/draws").json()["latest_result_draw"]
    r = client.post("/api/v1/recommend/seed-search", json={"target_rank": 5})
    body = r.json()
    assert body["target_draw_no"] == latest + 1 and body["compare_draw_no"] == latest
    ssvc_stop = client.post(f"/api/v1/recommend/seed-search/{body['job_id']}/stop")
    assert ssvc_stop.status_code == 200


def test_seed_search_rejects_missing_previous_draw(seeded: None, client) -> None:  # noqa: ANN001
    r1 = client.post("/api/v1/recommend/seed-search", json={"target_draw_no": 1, "target_rank": 5})
    assert r1.status_code == 400 and "직전 회차" in r1.json()["detail"]
    r2 = client.post("/api/v1/recommend/seed-search", json={"target_draw_no": 999_999, "target_rank": 5})
    assert r2.status_code == 400 and "직전 회차" in r2.json()["detail"]


def test_seed_search_invalid_target_rank_422(seeded: None, client) -> None:  # noqa: ANN001
    r = client.post("/api/v1/recommend/seed-search", json={"target_draw_no": 1000, "target_rank": 6})
    assert r.status_code == 422


def test_seed_search_stop_before_match(seeded: None, client) -> None:  # noqa: ANN001
    """희망 등수 1등(6개 일치)은 기대 시행 수가 매우 커 즉시 중지해도 done 이 아니다."""
    r = client.post("/api/v1/recommend/seed-search", json={"target_draw_no": 1000, "target_rank": 1})
    job_id = r.json()["job_id"]
    stopped = client.post(f"/api/v1/recommend/seed-search/{job_id}/stop").json()
    assert stopped["job_id"] == job_id
    final = _poll(client, job_id, timeout=5.0)
    assert final["status"] == "stopped" and final["stop_reason"] == "user"
    assert final["seed"] is None and final["matched_ticket"] is None


def test_seed_search_unknown_job_404(seeded: None, client) -> None:  # noqa: ANN001
    assert client.get("/api/v1/recommend/seed-search/does-not-exist").status_code == 404
    assert client.post("/api/v1/recommend/seed-search/does-not-exist/stop").status_code == 404


def test_seed_search_done_updates_env_local(seeded: None, client, monkeypatch, tmp_path) -> None:  # noqa: ANN001
    """v1.24: 일치(status=done) 시 .env.local 의 LOTTO_RANDOM_SEED 를 그 시행 횟수로 갱신한다."""
    from app.core import env_file

    p = tmp_path / ".env.local"
    p.write_text("LOTTO_POOL_SIZE=45\nLOTTO_RANDOM_SEED=20260908\nLOTTO_MAIN_COUNT=6\n", encoding="utf-8")
    monkeypatch.setattr(env_file, "ENV_LOCAL_PATH", p)

    r = client.post("/api/v1/recommend/seed-search", json={"target_draw_no": 1000, "target_rank": 5})
    done = _poll(client, r.json()["job_id"])
    assert done["status"] == "done" and done["env_updated"] is True
    text = p.read_text(encoding="utf-8")
    assert f"LOTTO_RANDOM_SEED={done['seed']}" in text
    assert "LOTTO_POOL_SIZE=45" in text and "LOTTO_MAIN_COUNT=6" in text  # 다른 줄 보존


def test_seed_search_env_update_skipped_when_file_missing(seeded: None, client, monkeypatch, tmp_path) -> None:  # noqa: ANN001
    from app.core import env_file

    monkeypatch.setattr(env_file, "ENV_LOCAL_PATH", tmp_path / "does-not-exist" / ".env.local")
    r = client.post("/api/v1/recommend/seed-search", json={"target_draw_no": 1000, "target_rank": 5})
    done = _poll(client, r.json()["job_id"])
    assert done["status"] == "done" and done["env_updated"] is False
