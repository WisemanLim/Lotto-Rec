"""S2.14 (v1.33) — 서버 재기동으로 중단된 분석 run 이어서 실행: MC 체크포인트·중단 감지·재개 API."""

from __future__ import annotations

import time

import numpy as np
import pytest

from app.core.mc_engine import run_null_simulation
from app.core.null_model import GAME

_FIELDS = ("x2_single", "max_abs_z_single", "q_order", "max_abs_z_pair", "genest_x2", "overlap_mean", "max_abs_lag1", "cusum_max", "max_abs_z_cross")


class _Crash(Exception):
    pass


def _interrupt_after(n_calls: int):  # noqa: ANN202
    calls = {"n": 0}

    def progress(_: float) -> None:
        calls["n"] += 1
        if calls["n"] >= n_calls:
            raise _Crash  # 프로세스 종료 모사 — 이 시점까지의 체크포인트만 남는다

    return progress


def test_checkpoint_resume_is_bit_identical(tmp_path) -> None:  # noqa: ANN001
    T, B, seed, chunk, L = 60, 400, 5, 40, 2
    full = run_null_simulation(T, B, seed, GAME, chunk=chunk, cross_max_lag=L)

    ckpt = tmp_path / "r.mc.npz"
    with pytest.raises(_Crash):
        run_null_simulation(T, B, seed, GAME, chunk=chunk, cross_max_lag=L, progress=_interrupt_after(4), checkpoint=ckpt, checkpoint_every=0)
    assert ckpt.exists()

    seen: list[float] = []
    resumed = run_null_simulation(T, B, seed, GAME, chunk=chunk, cross_max_lag=L, progress=seen.append, checkpoint=ckpt)
    assert 0 < seen[0] < 1  # 처음 보고가 체크포인트 진행률 — 남은 반복만 계산
    assert len(seen) < B // chunk + 1
    for f in _FIELDS:
        np.testing.assert_array_equal(getattr(resumed, f), getattr(full, f), err_msg=f)


def test_checkpoint_with_different_meta_is_ignored(tmp_path) -> None:  # noqa: ANN001
    ckpt = tmp_path / "r.mc.npz"
    with pytest.raises(_Crash):
        run_null_simulation(50, 300, 1, GAME, chunk=30, progress=_interrupt_after(3), checkpoint=ckpt, checkpoint_every=0)
    other = run_null_simulation(50, 300, 2, GAME, chunk=30, checkpoint=ckpt)  # seed 가 다르면 처음부터
    fresh = run_null_simulation(50, 300, 2, GAME, chunk=30)
    np.testing.assert_array_equal(other.x2_single, fresh.x2_single)


def test_corrupt_checkpoint_is_ignored(tmp_path) -> None:  # noqa: ANN001
    ckpt = tmp_path / "r.mc.npz"
    ckpt.write_bytes(b"not an npz")
    nd = run_null_simulation(40, 100, 3, GAME, chunk=25, checkpoint=ckpt)
    np.testing.assert_array_equal(nd.x2_single, run_null_simulation(40, 100, 3, GAME, chunk=25).x2_single)


def _make_orphan_run(seed: int) -> str:
    """이전 프로세스에서 실행 중이던 run 모사 — DB 는 running, 이 프로세스에 스레드 없음."""
    from app.db.base import SessionLocal
    from app.services import analysis_service as svc

    with SessionLocal() as s:
        run = svc.create_run(s, cohort="A", preset="quick", seed=seed, mc_iterations=320)
        run.status = "running"
        run.progress = 0.25
        run.stage = "monte_carlo 40%"
        s.commit()
        return run.run_id


def _poll(client, run_id: str, timeout: float = 60.0) -> dict:  # noqa: ANN001
    t0 = time.monotonic()
    while time.monotonic() - t0 < timeout:
        body = client.get(f"/api/v1/analysis/runs/{run_id}").json()
        if body["status"] in ("done", "error"):
            return body
        time.sleep(0.1)
    raise AssertionError(f"timeout: {body}")


def test_orphan_marked_interrupted_and_resume_api(seeded: None, client) -> None:  # noqa: ANN001
    from app.db.base import SessionLocal
    from app.services import analysis_service as svc

    rid = _make_orphan_run(seed=77)
    with SessionLocal() as s:
        assert rid in svc.mark_interrupted_runs(s)
    r = client.get(f"/api/v1/analysis/runs/{rid}").json()
    assert r["status"] == "interrupted" and r["stage"] == svc.INTERRUPTED_STAGE
    assert client.get(f"/api/v1/analysis/runs/{rid}/summary").status_code == 409

    res = client.post(f"/api/v1/analysis/runs/{rid}/resume")
    assert res.status_code == 200, res.text
    assert res.json()["run_id"] == rid
    done = _poll(client, rid)
    assert done["status"] == "done" and done["progress"] == 1.0
    assert client.get(f"/api/v1/analysis/runs/{rid}/global").status_code == 200
    assert not svc.checkpoint_path(rid).exists()  # 완료 시 체크포인트 삭제

    assert client.post(f"/api/v1/analysis/runs/{rid}/resume").status_code == 409  # 완료 run 은 재개 불가
    assert client.post("/api/v1/analysis/runs/does-not-exist/resume").status_code == 404


def test_resumed_run_equals_uninterrupted_run(seeded: None, client) -> None:  # noqa: ANN001
    """같은 seed·B 로 (a) 한 번에 실행, (b) MC 중간 체크포인트 후 이어서 실행 → MC 기반 결과 동일."""
    from app.db.base import SessionLocal
    from app.services import analysis_service as svc
    from app.services.draws import load_draws

    a = client.post("/api/v1/analysis/runs", json={"cohort": "A", "mc_iterations": 320, "seed": 91, "sync": True}).json()

    rid = _make_orphan_run(seed=91)
    with SessionLocal() as s:
        run = s.get(svc.AnalysisRun, rid)
        ds = load_draws(s, run.draw_from, run.draw_to)
        from app.core.config import settings

        with pytest.raises(_Crash):
            run_null_simulation(ds.T, run.mc_iterations, run.seed, GAME, chunk=64, cross_max_lag=settings.lotto_cross_draw_lag,
                                progress=_interrupt_after(2), checkpoint=svc.checkpoint_path(rid), checkpoint_every=0)
        svc.mark_interrupted_runs(s)
    assert svc.checkpoint_path(rid).exists()
    assert client.post(f"/api/v1/analysis/runs/{rid}/resume").status_code == 200
    assert _poll(client, rid)["status"] == "done"
    for sec in ("null_summary", "global"):
        assert client.get(f"/api/v1/analysis/runs/{rid}/{sec}").json() == client.get(f"/api/v1/analysis/runs/{a['run_id']}/{sec}").json(), sec


def test_startup_hook_respects_auto_resume_flag(seeded: None, client, monkeypatch) -> None:  # noqa: ANN001
    from app.core.config import settings
    from app.services import analysis_service as svc

    monkeypatch.setattr(settings, "lotto_auto_resume_runs", False)
    rid = _make_orphan_run(seed=78)
    assert rid in svc.resume_interrupted_runs()
    assert client.get(f"/api/v1/analysis/runs/{rid}").json()["status"] == "interrupted"  # 수동 대기
    assert client.delete(f"/api/v1/analysis/runs/{rid}").status_code == 200  # 중단된 run 은 삭제 가능

    monkeypatch.setattr(settings, "lotto_auto_resume_runs", True)
    rid2 = _make_orphan_run(seed=79)
    assert rid2 in svc.resume_interrupted_runs()
    assert _poll(client, rid2)["status"] == "done"


def test_config_exposes_auto_resume(client) -> None:  # noqa: ANN001
    assert isinstance(client.get("/api/v1/config").json()["lotto_auto_resume_runs"], bool)
