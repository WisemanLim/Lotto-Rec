"""증분 적재 (PRD §3.4): draw_no 기준 중복 제외, 충돌 보고, import_log, 후처리 훅(자동 재실행·티켓 대조)."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.data_io import DrawRecord, ParseReport, load_source_file, parse_draws, read_table
from app.db.models import Draw, ImportLog

# 신규 회차 삽입 후 호출되는 훅: (session, inserted_draw_nos, trigger) -> run_id|None
PostImportHook = Callable[[Session, list[int], str], str | None]
_post_import_hooks: list[PostImportHook] = []


def register_post_import_hook(hook: PostImportHook) -> None:
    _post_import_hooks.append(hook)


@dataclass
class ImportResult:
    filename: str
    data_hash: str
    inserted: int = 0
    skipped_duplicate: int = 0
    inserted_draws: list[int] = field(default_factory=list)
    conflicts: list[dict] = field(default_factory=list)
    invalid: list[dict] = field(default_factory=list)
    triggered_run_id: str | None = None
    import_id: int | None = None

    def as_dict(self) -> dict:
        return {
            "import_id": self.import_id,
            "filename": self.filename,
            "data_hash": self.data_hash,
            "inserted": self.inserted,
            "skipped_duplicate": self.skipped_duplicate,
            "inserted_draws": self.inserted_draws,
            "conflicts": self.conflicts,
            "invalid": self.invalid,
            "triggered_run_id": self.triggered_run_id,
        }


PRIZE_FIELDS = tuple(f"{k}{i}" for i in (1, 2, 3, 4, 5) for k in ("prize", "winners"))


def _differs(existing: Draw, rec: DrawRecord) -> dict | None:
    diff: dict[str, dict] = {}
    if existing.numbers != rec.numbers:
        diff["numbers"] = {"existing": existing.numbers, "incoming": rec.numbers}
    if existing.bonus != rec.bonus:
        diff["bonus"] = {"existing": existing.bonus, "incoming": rec.bonus}
    for f in PRIZE_FIELDS:
        ev, iv = getattr(existing, f), getattr(rec, f)
        if iv is not None and ev is not None and ev != iv:
            diff[f] = {"existing": ev, "incoming": iv}
    return diff or None


def apply_records(
    session: Session,
    report: ParseReport,
    filename: str,
    *,
    max_draw: int | None = None,
    overwrite: bool = False,
    source: str = "import",
    run_hooks: bool = True,
    trigger: str = "import",
) -> ImportResult:
    """파싱된 레코드를 증분 삽입. max_draw 지정 시 그 이하 회차만(seed 용)."""
    result = ImportResult(filename=filename, data_hash=report.data_hash, invalid=list(report.invalid))
    recs = [r for r in report.records if max_draw is None or r.draw_no <= max_draw]
    if not recs:
        result.import_id = _log(session, result)
        return result

    existing = {
        d.draw_no: d for d in session.scalars(select(Draw).where(Draw.draw_no.in_([r.draw_no for r in recs]))).all()
    }
    for rec in recs:
        ex = existing.get(rec.draw_no)
        if ex is None:
            session.add(Draw(**rec.as_dict(), source=source))
            result.inserted += 1
            result.inserted_draws.append(rec.draw_no)
            continue
        diff = _differs(ex, rec)
        if diff is None:
            result.skipped_duplicate += 1
            # 기존 결측 보강 (당첨 정보만)
            for f in PRIZE_FIELDS:
                if getattr(ex, f) is None and getattr(rec, f) is not None:
                    setattr(ex, f, getattr(rec, f))
            continue
        if overwrite:
            for k, v in rec.as_dict().items():
                setattr(ex, k, v)
            result.conflicts.append({"draw_no": rec.draw_no, "diff": diff, "resolution": "overwritten"})
        else:
            result.skipped_duplicate += 0
            result.conflicts.append({"draw_no": rec.draw_no, "diff": diff, "resolution": "rejected"})
    session.flush()

    if run_hooks and result.inserted_draws:
        for hook in _post_import_hooks:
            rid = hook(session, sorted(result.inserted_draws), trigger)
            if rid and result.triggered_run_id is None:
                result.triggered_run_id = rid
    result.import_id = _log(session, result)
    session.commit()
    return result


def _log(session: Session, r: ImportResult) -> int:
    log = ImportLog(
        filename=r.filename,
        data_hash=r.data_hash,
        inserted=r.inserted,
        skipped_duplicate=r.skipped_duplicate,
        conflicts=r.conflicts,
        invalid=r.invalid,
        inserted_draws=r.inserted_draws,
        triggered_run_id=r.triggered_run_id,
    )
    session.add(log)
    session.flush()
    return int(log.import_id)


def import_bytes(session: Session, content: bytes, filename: str, *, overwrite: bool = False) -> ImportResult:
    df = read_table(content, filename)
    report = parse_draws(df, settings.lotto_pool_size, settings.lotto_main_count)
    return apply_records(session, report, filename, overwrite=overwrite, trigger="import")


def import_single(session: Session, rec: DrawRecord, *, overwrite: bool = False) -> ImportResult:
    from app.core.data_io import ParseReport as PR

    report = PR(records=[rec], invalid=[], data_hash=f"manual-{rec.draw_no}", columns=[])
    return apply_records(
        session, report, f"manual:{rec.draw_no}", overwrite=overwrite, source="manual", trigger="manual"
    )


def seed_from_source(
    session: Session, path: Path | None = None, *, max_draw: int | None = None, run_hooks: bool = False
) -> ImportResult:
    """초기 적재: 원천 xlsx 의 ≤ max_draw(기본 군 A 경계) 회차만. 훅 미실행(대량 초기 적재)."""
    p = path or settings.source_file_path
    report = load_source_file(p, pool_size=settings.lotto_pool_size, main_count=settings.lotto_main_count)
    limit = settings.lotto_train_end_draw if max_draw is None else max_draw
    return apply_records(session, report, p.name, max_draw=limit, source="seed", run_hooks=run_hooks, trigger="seed")
