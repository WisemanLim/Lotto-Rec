"""데이터 API — import(증분)/draws/summary/imports (PRD §11)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.data_io import DrawRecord
from app.core.timeutil import to_iso
from app.db.base import get_session
from app.db.models import Draw, ImportLog
from app.schemas.data import DataSummary, DrawIn, DrawOut, ImportOut
from app.services import import_service
from app.services.draws import cohort_of

router = APIRouter(prefix="/data", tags=["data"])


def _draw_out(d: Draw) -> DrawOut:
    return DrawOut(
        draw_no=d.draw_no,
        numbers=d.numbers,
        bonus=d.bonus,
        prize1=d.prize1,
        winners1=d.winners1,
        prize2=d.prize2,
        winners2=d.winners2,
        cohort=cohort_of(d.draw_no),
    )


@router.post("/import", response_model=ImportOut)
async def import_file(
    file: UploadFile = File(...),
    overwrite: bool = Query(False, description="충돌 회차 덮어쓰기(명시적 선택)"),
    session: Session = Depends(get_session),
) -> ImportOut:
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(413, "파일 크기 제한 20MB")
    try:
        r = import_service.import_bytes(session, content, file.filename or "upload", overwrite=overwrite)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return ImportOut(**r.as_dict())


@router.post("/draws", response_model=ImportOut)
def add_draw(body: DrawIn, session: Session = Depends(get_session)) -> ImportOut:
    if body.bonus in body.numbers:
        raise HTTPException(400, "보너스가 본번호와 중복")
    rec = DrawRecord(
        draw_no=body.draw_no,
        n1=body.numbers[0],
        n2=body.numbers[1],
        n3=body.numbers[2],
        n4=body.numbers[3],
        n5=body.numbers[4],
        n6=body.numbers[5],
        bonus=body.bonus,
        prize1=body.prize1,
        winners1=body.winners1,
        prize2=body.prize2,
        winners2=body.winners2,
    )
    r = import_service.import_single(session, rec, overwrite=body.overwrite)
    return ImportOut(**r.as_dict())


@router.get("/draws", response_model=list[DrawOut])
def list_draws(
    lo: int | None = None,
    hi: int | None = None,
    limit: int = Query(100, ge=1, le=2000),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    session: Session = Depends(get_session),
) -> list[DrawOut]:
    stmt = select(Draw)
    if lo is not None:
        stmt = stmt.where(Draw.draw_no >= lo)
    if hi is not None:
        stmt = stmt.where(Draw.draw_no <= hi)
    stmt = stmt.order_by(Draw.draw_no.desc() if order == "desc" else Draw.draw_no.asc()).limit(limit)
    return [_draw_out(d) for d in session.scalars(stmt).all()]


@router.get("/draws/{draw_no}", response_model=DrawOut)
def get_draw(draw_no: int, session: Session = Depends(get_session)) -> DrawOut:
    d = session.get(Draw, draw_no)
    if d is None:
        raise HTTPException(404, f"회차 {draw_no} 없음")
    return _draw_out(d)


@router.get("/imports")
def list_imports(limit: int = Query(50, ge=1, le=500), session: Session = Depends(get_session)) -> list[dict]:
    rows = session.scalars(select(ImportLog).order_by(ImportLog.import_id.desc()).limit(limit)).all()
    return [
        {
            "import_id": r.import_id,
            "filename": r.filename,
            "data_hash": r.data_hash,
            "inserted": r.inserted,
            "skipped_duplicate": r.skipped_duplicate,
            "conflicts": r.conflicts,
            "invalid": r.invalid,
            "inserted_draws": r.inserted_draws,
            "triggered_run_id": r.triggered_run_id,
            "created_at": to_iso(r.created_at),
        }
        for r in rows
    ]


@router.get("/summary", response_model=DataSummary)
def summary(session: Session = Depends(get_session)) -> DataSummary:
    total = int(session.scalar(select(func.count(Draw.draw_no))) or 0)
    mn = session.scalar(select(func.min(Draw.draw_no)))
    mx = session.scalar(select(func.max(Draw.draw_no)))
    te = settings.lotto_train_end_draw
    a = int(session.scalar(select(func.count(Draw.draw_no)).where(Draw.draw_no <= te)) or 0)
    b = total - a
    missing: list[int] = []
    if mn is not None and mx is not None:
        present = set(session.scalars(select(Draw.draw_no)).all())
        missing = [i for i in range(int(mn), int(mx) + 1) if i not in present][:200]
    rows = session.scalars(select(Draw)).all()
    bad = [
        d.draw_no
        for d in rows
        if len(set(d.numbers)) != 6
        or d.bonus in d.numbers
        or any(not 1 <= x <= settings.lotto_pool_size for x in d.numbers + [d.bonus])
    ]
    latest = session.scalars(select(ImportLog).order_by(ImportLog.import_id.desc()).limit(1)).first()
    return DataSummary(
        total_draws=total,
        min_draw=mn,
        max_draw=mx,
        train_end_draw=te,
        cohort_a_count=a,
        cohort_b_count=b,
        missing_draws=missing,
        integrity={"invalid_rows": bad, "contiguous": not missing, "all_sorted": True},
        latest_import=None
        if latest is None
        else {
            "import_id": latest.import_id,
            "filename": latest.filename,
            "inserted": latest.inserted,
            "skipped_duplicate": latest.skipped_duplicate,
            "conflicts": len(latest.conflicts),
            "created_at": to_iso(latest.created_at),
        },
    )
