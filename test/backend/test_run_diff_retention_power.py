"""impl 8th — S8.4 run 차이 요약, Q5 run 보존, §12.2 편향 주입 검정력."""

from __future__ import annotations

import numpy as np
from scipy import stats

from app.core.features import incidence_from_draws
from app.core.null_model import GAME, simulate_biased_draws, simulate_draws


def test_diff_vs_previous_and_settings_field(seeded: None, client) -> None:  # noqa: ANN001
    a = client.post("/api/v1/analysis/runs", json={"cohort": "A", "mc_iterations": 120, "seed": 21, "sync": True}).json()
    d0 = client.get(f"/api/v1/analysis/runs/{a['run_id']}/diff_vs_previous").json()
    # 첫 run 이거나 이전 run 존재 — 어느 쪽이든 summary 존재
    assert "summary" in d0
    b = client.post("/api/v1/analysis/runs", json={"cohort": "A", "mc_iterations": 120, "seed": 22, "sync": True}).json()
    d = client.get(f"/api/v1/analysis/runs/{b['run_id']}/diff_vs_previous").json()
    assert d["previous_run_id"] is not None
    assert "global_p_joe" in d and d["global_p_joe"]["current"] is not None
    assert "sig_pairs" in d and set(d["sig_pairs"]) >= {"added", "removed", "n_prev", "n_cur"}
    assert "J p" in d["summary"] and "유의 쌍" in d["summary"]
    assert b["diff_summary"] == d["summary"]
    lst = client.get("/api/v1/analysis/runs?limit=5").json()
    assert any(r["diff_summary"] for r in lst)


def test_prune_runs_respects_retention_and_protection(seeded: None, client, monkeypatch) -> None:  # noqa: ANN001
    from app.core.config import settings
    from app.db.base import SessionLocal
    from app.services import analysis_service as svc

    ids = []
    for i in range(3):
        r = client.post("/api/v1/analysis/runs", json={"cohort": "A", "mc_iterations": 100, "seed": 30 + i, "sync": True})
        assert r.status_code == 200, r.text
        ids.append(r.json()["run_id"])
    monkeypatch.setattr(settings, "lotto_run_retention", 2)
    with SessionLocal() as s:
        removed = svc.prune_runs(s)
        done = [r for r in svc.list_runs(s, 500) if r.status == "done"]
        assert len(done) <= 2 + 2  # 군별 최신(A/B/ALL) 보호 포함 여유
        latest_a = svc.latest_done_run(s, "A")
        assert latest_a is not None and latest_a.run_id == ids[-1]  # 군 A 최신 보존
        assert removed  # 무언가 정리됨
        # 결과 섹션도 함께 삭제
        for rid in removed:
            assert svc.get_section(s, rid, "summary") is None
    monkeypatch.setattr(settings, "lotto_run_retention", 0)
    with SessionLocal() as s:
        assert svc.prune_runs(s) == []  # 0 = 무제한


def _calibrate_weight(target_incl: float, number: int = 7, n: int = 20000, seed: int = 0) -> float:
    """A-Res 가중치 w 를 이분탐색해 번호의 포함확률이 target 이 되게 한다 (가중치 ≠ 포함확률)."""
    rng = np.random.default_rng(seed)
    lo, hi = 1.0, 6.0
    for _ in range(14):
        mid = (lo + hi) / 2
        w = np.ones(45)
        w[number - 1] = mid
        d = simulate_biased_draws(rng, n, w, GAME)
        incl = float((d == number).any(axis=1).mean())
        lo, hi = (mid, hi) if incl < target_incl else (lo, mid)
    return (lo + hi) / 2


def test_power_under_injected_bias() -> None:
    """번호 7 의 포함확률을 1.3배(0.1333→0.1733)로 주입, T=1000, 60세트:
    검정력 리포트 — 미보정 단일 번호 정확검정 ≥ 0.85, Holm(45개) 보정 ≥ 0.45(이론 ≈0.65), omnibus Joe J ≥ 0.2(≈0.3)."""
    from statsmodels.stats.multitest import multipletests

    p1 = GAME.p_single
    w7 = _calibrate_weight(1.3 * p1)
    assert w7 > 1.3  # 가중치는 포함확률보다 크게 잡아야 함(희석)
    rng = np.random.default_rng(123)
    w = np.ones(45)
    w[6] = w7
    T, n, alpha = 1000, 100, 0.05
    rej_J = rej_single = rej_raw = rej_null_single = 0
    e = T * p1
    for _ in range(n):
        d = simulate_biased_draws(rng, T, w, GAME)
        assert d.shape == (T, 6) and np.all(np.diff(d, axis=1) > 0)
        counts = incidence_from_draws(d, 45).sum(axis=0)
        J = GAME.joe_factor * float(np.sum((counts - e) ** 2 / e))
        rej_J += int(stats.chi2.sf(J, 44) < alpha)
        pv = np.array([stats.binomtest(int(c), T, p1).pvalue for c in counts])
        rej_raw += int(pv[6] < alpha)
        rej_single += int(multipletests(pv, alpha=alpha, method="holm")[0][6])
        c0 = incidence_from_draws(simulate_draws(rng, 1, T, GAME)[0], 45).sum(axis=0)
        pv0 = np.array([stats.binomtest(int(c), T, p1).pvalue for c in c0])
        rej_null_single += int(multipletests(pv0, alpha=alpha, method="holm")[0].any())
    report = {"raw_single": rej_raw / n, "holm_single": rej_single / n, "joe_J": rej_J / n, "null_fwer": rej_null_single / n}
    print("power report (1.3x inclusion, T=1000):", report)
    assert report["raw_single"] >= 0.85, report
    assert report["holm_single"] >= 0.45, report
    assert report["joe_J"] >= 0.2, report
    assert rej_null_single / n <= 0.2  # 균등: FWER ≈ α
