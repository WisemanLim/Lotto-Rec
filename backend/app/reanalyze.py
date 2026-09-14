"""`make reanalyze` — DB 백업 후 군 A·B·ALL 재분석 (PRD v1.10 사용자 지시 4).

기존 데이터(run·결과·티켓 전부)는 `data/backup/lotto_<UTC시각>.db` 로 파일 복사한 뒤 새 run 을 추가한다.
기존 run 은 삭제하지 않고 `LOTTO_RUN_RETENTION` 규칙으로 정리된다.
"""

from __future__ import annotations

import argparse
import shutil
import time
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import settings
from app.db.base import SessionLocal
from app.services import analysis_service as svc


def backup_db() -> Path:
    src = settings.project_root / settings.lotto_db_path
    if not src.exists():
        raise SystemExit(f"DB 없음: {src}")
    dst_dir = src.parent / "backup"
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / f"{src.stem}_{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.db"
    shutil.copy2(src, dst)
    return dst


def main() -> None:
    ap = argparse.ArgumentParser(description="Lotto-Rec 재분석 (백업 → 군별 run)")
    ap.add_argument("--preset", default="quick", choices=["quick", "report", "deep"])
    ap.add_argument("--cohorts", default="A,B,ALL", help="쉼표 구분 (A|B|ALL)")
    ap.add_argument("--no-backup", action="store_true")
    args = ap.parse_args()

    if not args.no_backup:
        print(f"backup → {backup_db()}")
    for cohort in [c.strip() for c in args.cohorts.split(",") if c.strip()]:
        t0 = time.time()
        with SessionLocal() as s:
            run = svc.create_run(s, cohort=cohort, preset=args.preset, trigger="reanalyze")
            rid = run.run_id
        svc.execute_run(rid)
        with SessionLocal() as s:
            done = svc.get_run(s, rid)
            assert done is not None
            run = done
            summ = svc.get_section(s, rid, "summary") or {}
            kpi = summ.get("kpi", {})
            print(
                f"[{cohort}] {run.status} {run.draw_from}~{run.draw_to} (T={run.n_draws}, {args.preset}, "
                f"{time.time() - t0:.1f}s) run_id={rid}"
            )
            if run.status != "done":
                print(f"  error: {run.error}")
                continue
            verdict = summ.get("verdict", {})
            print(
                f"  J p={kpi.get('global_p_joe'):.3f} · max pair {kpi.get('max_pair')} "
                f"maxT={kpi.get('max_pair_p_maxT')} · cross(L={kpi.get('cross_draw_lag')}) "
                f"max cell {kpi.get('cross_draw_max_cell')} z={kpi.get('cross_draw_max_z'):.2f} "
                f"maxT={kpi.get('cross_draw_p_maxT')} any-lag maxT={kpi.get('cross_draw_any_lag_p_maxT')} · "
                f"uniform={verdict.get('consistent_with_uniform_null')} flags={verdict.get('flags')}"
            )


if __name__ == "__main__":
    main()
