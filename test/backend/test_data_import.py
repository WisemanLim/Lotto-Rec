"""E1 — 파싱·검증·증분 적재·충돌·API (PRD §12.3 GWT)."""

from __future__ import annotations

import io
from pathlib import Path

import pandas as pd
import pytest
from sqlalchemy import func, select

SOURCE_XLSX = Path(__file__).resolve().parents[2] / ".docs" / "lotto(~1240).xlsx"


def _csv_bytes(rows: list[dict]) -> bytes:
    df = pd.DataFrame(rows)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode("utf-8")


def test_parse_source_file_clean() -> None:
    from app.core.data_io import load_source_file

    rep = load_source_file(SOURCE_XLSX)
    assert len(rep.records) == 1240
    assert rep.invalid == []
    assert rep.records[0].draw_no == 1 and rep.records[0].numbers == [10, 23, 29, 33, 37, 40]
    assert all(r.numbers == sorted(r.numbers) for r in rep.records)


def test_parse_rejects_bad_rows() -> None:
    from app.core.data_io import parse_draws

    df = pd.DataFrame(
        [
            {"회차": 1, "번호1": 1, "번호2": 2, "번호3": 3, "번호4": 4, "번호5": 5, "번호6": 6, "보너스": 7},
            {"회차": 2, "번호1": 1, "번호2": 1, "번호3": 3, "번호4": 4, "번호5": 5, "번호6": 6, "보너스": 7},  # dup
            {"회차": 3, "번호1": 1, "번호2": 2, "번호3": 3, "번호4": 4, "번호5": 5, "번호6": 46, "보너스": 7},  # range
            {
                "회차": 4,
                "번호1": 1,
                "번호2": 2,
                "번호3": 3,
                "번호4": 4,
                "번호5": 5,
                "번호6": 6,
                "보너스": 6,
            },  # bonus dup
            {
                "회차": 1,
                "번호1": 9,
                "번호2": 2,
                "번호3": 3,
                "번호4": 4,
                "번호5": 5,
                "번호6": 6,
                "보너스": 7,
            },  # file dup
        ]
    )
    rep = parse_draws(df)
    assert [r.draw_no for r in rep.records] == [1]
    reasons = [i["reason"] for i in rep.invalid]
    assert len(reasons) == 4
    assert any("중복" in r for r in reasons) and any("범위" in r for r in reasons)


def test_seed_loads_cohort_a_only(seeded: None, session) -> None:  # noqa: ANN001
    from app.db.models import Draw

    n = session.scalar(select(func.count(Draw.draw_no)))
    mx = session.scalar(select(func.max(Draw.draw_no)))
    assert n == 1000 and mx == 1000


def test_incremental_import_skips_duplicates_and_inserts_new(seeded: None, client) -> None:  # noqa: ANN001
    """Given 1~1000 적재, When 998~1003 CSV 업로드, Then 3건 삽입·3건 중복 제외."""
    from app.core.data_io import load_source_file

    recs = {r.draw_no: r for r in load_source_file(SOURCE_XLSX).records}
    rows = []
    for d in range(998, 1004):
        r = recs[d]
        rows.append(
            {
                "draw_no": d,
                "n1": r.n1,
                "n2": r.n2,
                "n3": r.n3,
                "n4": r.n4,
                "n5": r.n5,
                "n6": r.n6,
                "bonus": r.bonus,
                "prize1": r.prize1,
                "winners1": r.winners1,
                "prize2": r.prize2,
                "winners2": r.winners2,
            }
        )
    res = client.post("/api/v1/data/import", files={"file": ("inc.csv", _csv_bytes(rows), "text/csv")})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["inserted"] == 3 and body["inserted_draws"] == [1001, 1002, 1003]
    assert body["skipped_duplicate"] == 3 and body["conflicts"] == []

    # 재업로드 → 전부 중복
    res2 = client.post("/api/v1/data/import", files={"file": ("inc.csv", _csv_bytes(rows), "text/csv")})
    assert res2.json()["inserted"] == 0 and res2.json()["skipped_duplicate"] == 6


def test_conflict_is_reported_not_overwritten(seeded: None, client) -> None:  # noqa: ANN001
    """Given 1000회 존재, When 번호가 다른 1000회 업로드, Then 삽입 0 + 충돌 1, 기존 불변."""
    before = client.get("/api/v1/data/draws/1000").json()
    rows = [{"draw_no": 1000, "n1": 1, "n2": 2, "n3": 3, "n4": 4, "n5": 5, "n6": 6, "bonus": 7}]
    res = client.post("/api/v1/data/import", files={"file": ("c.csv", _csv_bytes(rows), "text/csv")})
    body = res.json()
    assert body["inserted"] == 0 and len(body["conflicts"]) == 1
    assert body["conflicts"][0]["draw_no"] == 1000 and body["conflicts"][0]["resolution"] == "rejected"
    after = client.get("/api/v1/data/draws/1000").json()
    assert before["numbers"] == after["numbers"]


def test_manual_draw_input_and_summary(seeded: None, client) -> None:  # noqa: ANN001
    res = client.post("/api/v1/data/draws", json={"draw_no": 1004, "numbers": [3, 9, 14, 22, 37, 44], "bonus": 1})
    assert res.status_code == 200 and res.json()["inserted"] == 1
    bad = client.post("/api/v1/data/draws", json={"draw_no": 1005, "numbers": [3, 3, 14, 22, 37, 44], "bonus": 1})
    assert bad.status_code == 422
    s = client.get("/api/v1/data/summary").json()
    assert s["cohort_a_count"] == 1000 and s["cohort_b_count"] >= 4
    assert s["integrity"]["invalid_rows"] == [] and s["integrity"]["contiguous"] is True
    imports = client.get("/api/v1/data/imports").json()
    assert imports and imports[0]["filename"].startswith("manual:")


@pytest.mark.parametrize("name", ["x.pdf", "x.json"])
def test_unsupported_format(client, name: str) -> None:  # noqa: ANN001
    res = client.post("/api/v1/data/import", files={"file": (name, b"abc", "application/octet-stream")})
    assert res.status_code == 400
