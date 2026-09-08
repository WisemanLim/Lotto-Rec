"""`make db-seed` — 원천 xlsx 의 1~LOTTO_TRAIN_END_DRAW(군 A) 회차를 증분 적재 (PRD §3.3, 사용자 지시 1)."""

from __future__ import annotations

import argparse

from app.core.config import settings
from app.db.base import SessionLocal
from app.services.import_service import seed_from_source


def main() -> None:
    ap = argparse.ArgumentParser(description="Lotto-Rec seed (군 A 적재)")
    ap.add_argument("--max-draw", type=int, default=None, help="적재 상한 회차 (기본: LOTTO_TRAIN_END_DRAW)")
    ap.add_argument("--all", action="store_true", help="원천 파일 전체 회차 적재 (군 B 포함)")
    args = ap.parse_args()

    src = settings.source_file_path
    if not src.exists():
        raise SystemExit(f"원천 파일 없음: {src}")
    max_draw = 10**9 if args.all else args.max_draw
    with SessionLocal() as s:
        r = seed_from_source(s, src, max_draw=max_draw)
    print(
        f"seed 완료: {src.name} → inserted={r.inserted}, skipped={r.skipped_duplicate}, "
        f"conflicts={len(r.conflicts)}, invalid={len(r.invalid)} "
        f"(상한 {settings.lotto_train_end_draw if max_draw is None else max_draw}회)"
    )


if __name__ == "__main__":
    main()
