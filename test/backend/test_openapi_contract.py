"""OpenAPI 계약 테스트 (COMPLIANCE testing_additions · PRD §11).

1) 스키마 생성 오류 없음, 2) 문서화된 경로 전부 존재, 3) 경로 스냅샷과 일치(의도적 변경 시 스냅샷 갱신),
4) 핵심 응답의 필수 키·타입·시각 형식(ISO, UTC 오프셋) 검증.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

SNAPSHOT = Path(__file__).with_name("openapi_paths.snapshot.json")
ISO_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?\+00:00$")

DOCUMENTED = {
    ("GET", "/health"),
    ("GET", "/api/v1/config"),
    ("POST", "/api/v1/data/import"),
    ("POST", "/api/v1/data/draws"),
    ("GET", "/api/v1/data/draws"),
    ("GET", "/api/v1/data/draws/{draw_no}"),
    ("GET", "/api/v1/data/imports"),
    ("GET", "/api/v1/data/summary"),
    ("POST", "/api/v1/analysis/runs"),
    ("GET", "/api/v1/analysis/runs"),
    ("GET", "/api/v1/analysis/runs/latest"),
    ("GET", "/api/v1/analysis/runs/{run_id}"),
    ("DELETE", "/api/v1/analysis/runs/{run_id}"),
    ("GET", "/api/v1/analysis/runs/{run_id}/{section}"),
    ("POST", "/api/v1/analysis/itemsets/query"),
    ("POST", "/api/v1/validation/runs"),
    ("GET", "/api/v1/validation/runs"),
    ("GET", "/api/v1/validation/runs/latest"),
    ("GET", "/api/v1/validation/runs/{validation_id}"),
    ("GET", "/api/v1/validation/runs/{validation_id}/{kind}"),
    ("GET", "/api/v1/recommend/strategies"),
    ("POST", "/api/v1/recommend"),
    ("GET", "/api/v1/recommend/history"),
    ("GET", "/api/v1/recommend/history/summary"),
    ("POST", "/api/v1/user/tickets/evaluate"),
    ("POST", "/api/v1/user/tickets"),
    ("GET", "/api/v1/user/tickets"),
    ("DELETE", "/api/v1/user/tickets/{ticket_id}"),
    ("GET", "/api/v1/tracking/summary"),
    ("GET", "/api/v1/tracking/outcomes"),
    ("GET", "/api/v1/tracking/outcomes/summary"),
    ("GET", "/api/v1/tracking/pending"),
    ("POST", "/api/v1/tracking/evaluate/{draw_no}"),
    ("GET", "/api/v1/experiments/strategy-params"),
    ("POST", "/api/v1/experiments/runs"),
    ("GET", "/api/v1/experiments/runs"),
    ("GET", "/api/v1/experiments/active"),
    ("GET", "/api/v1/experiments/lineage"),
    ("GET", "/api/v1/experiments/runs/{experiment_id}"),
    ("POST", "/api/v1/experiments/runs/{experiment_id}/activate"),
    ("POST", "/api/v1/experiments/deactivate"),
    ("DELETE", "/api/v1/experiments/runs/{experiment_id}"),
}


def _operations() -> set[tuple[str, str]]:
    from app.main import app

    spec = app.openapi()
    return {(m.upper(), p) for p, ops in spec["paths"].items() for m in ops if m.lower() in ("get", "post", "put", "delete", "patch")}


def test_openapi_schema_generates_and_documents_all_endpoints() -> None:
    from app.main import app

    spec = app.openapi()
    assert spec["openapi"].startswith("3.") and spec["info"]["title"]
    ops = _operations()
    missing = DOCUMENTED - ops
    assert not missing, f"문서화된 엔드포인트 누락: {sorted(missing)}"


def test_openapi_paths_snapshot() -> None:
    """경로 집합 스냅샷 — 변경은 의도적으로만 (스냅샷 파일 갱신 후 커밋)."""
    ops = sorted(f"{m} {p}" for m, p in _operations())
    if not SNAPSHOT.exists():
        SNAPSHOT.write_text(json.dumps(ops, ensure_ascii=False, indent=1), encoding="utf-8")
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    added, removed = sorted(set(ops) - set(snap)), sorted(set(snap) - set(ops))
    assert not removed, f"계약 위반 — 제거된 경로: {removed}"
    assert not added, f"새 경로 추가됨 — 스냅샷 갱신 필요: {added}"


def _check_iso(v: object) -> None:
    assert isinstance(v, str) and ISO_UTC.match(v), f"ISO UTC 오프셋 형식 아님: {v!r}"


def test_core_response_shapes(seeded: None, client) -> None:  # noqa: ANN001
    cfg = client.get("/api/v1/config").json()
    for k, t in (
        ("lotto_number_recommendation_count", int),
        ("lotto_pool_size", int),
        ("lotto_main_count", int),
        ("lotto_train_end_draw", int),
        ("lotto_significance_level", float),
        ("lotto_default_correction", str),
        ("mc_iterations", dict),
        ("timezone", str),
    ):
        assert isinstance(cfg[k], t), (k, cfg[k])
    summ = client.get("/api/v1/data/summary").json()
    assert {"total_draws", "min_draw", "max_draw", "train_end_draw", "cohort_a_count", "cohort_b_count", "integrity"} <= set(summ)
    imps = client.get("/api/v1/data/imports").json()
    assert imps and {"import_id", "filename", "inserted", "skipped_duplicate", "conflicts", "invalid", "created_at"} <= set(imps[0])
    _check_iso(imps[0]["created_at"])
    strategies = client.get("/api/v1/recommend/strategies").json()
    assert len(strategies) >= 9 and all({"id", "label", "basis", "expectation"} <= set(s) for s in strategies)
    run = client.post("/api/v1/analysis/runs", json={"cohort": "A", "mc_iterations": 100, "sync": True}).json()
    for k in ("run_id", "cohort", "draw_from", "draw_to", "n_draws", "preset", "alpha", "correction", "mc_iterations", "seed", "data_hash", "status", "progress", "created_at"):
        assert k in run, k
    _check_iso(run["created_at"])
    assert run["status"] == "done" and run["finished_at"]
    _check_iso(run["finished_at"])
    summary = client.get(f"/api/v1/analysis/runs/{run['run_id']}/summary").json()
    assert {"T", "N", "k", "alpha", "kpi", "verdict", "interpretation_policy"} <= set(summary)
    assert isinstance(summary["verdict"]["consistent_with_uniform_null"], bool)
    bad = client.get(f"/api/v1/analysis/runs/{run['run_id']}/not_a_section")
    assert bad.status_code == 404
