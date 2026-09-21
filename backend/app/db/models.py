"""SQLAlchemy 모델 — PRD §9. 분석 결과는 섹션별 JSON payload 로 저장(로컬 단일 사용자, 단순성 우선)."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(UTC)


class Draw(Base):
    __tablename__ = "draws"

    draw_no: Mapped[int] = mapped_column(Integer, primary_key=True)
    n1: Mapped[int] = mapped_column(Integer, nullable=False)
    n2: Mapped[int] = mapped_column(Integer, nullable=False)
    n3: Mapped[int] = mapped_column(Integer, nullable=False)
    n4: Mapped[int] = mapped_column(Integer, nullable=False)
    n5: Mapped[int] = mapped_column(Integer, nullable=False)
    n6: Mapped[int] = mapped_column(Integer, nullable=False)
    bonus: Mapped[int] = mapped_column(Integer, nullable=False)
    prize1: Mapped[int | None] = mapped_column(Integer)
    winners1: Mapped[int | None] = mapped_column(Integer)
    prize2: Mapped[int | None] = mapped_column(Integer)
    winners2: Mapped[int | None] = mapped_column(Integer)
    prize3: Mapped[int | None] = mapped_column(Integer)
    winners3: Mapped[int | None] = mapped_column(Integer)
    prize4: Mapped[int | None] = mapped_column(Integer)
    winners4: Mapped[int | None] = mapped_column(Integer)
    prize5: Mapped[int | None] = mapped_column(Integer)
    winners5: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(32), default="import")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    @property
    def numbers(self) -> list[int]:
        return [self.n1, self.n2, self.n3, self.n4, self.n5, self.n6]


class ImportLog(Base):
    __tablename__ = "import_log"

    import_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255))
    data_hash: Mapped[str] = mapped_column(String(64))
    inserted: Mapped[int] = mapped_column(Integer, default=0)
    skipped_duplicate: Mapped[int] = mapped_column(Integer, default=0)
    conflicts: Mapped[list] = mapped_column(JSON, default=list)
    invalid: Mapped[list] = mapped_column(JSON, default=list)
    inserted_draws: Mapped[list] = mapped_column(JSON, default=list)
    triggered_run_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AnalysisRun(Base):
    __tablename__ = "analysis_run"

    run_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    cohort: Mapped[str] = mapped_column(String(8))  # A | B | ALL
    draw_from: Mapped[int] = mapped_column(Integer)
    draw_to: Mapped[int] = mapped_column(Integer)
    n_draws: Mapped[int] = mapped_column(Integer)
    preset: Mapped[str] = mapped_column(String(16))
    alpha: Mapped[float] = mapped_column(Float)
    correction: Mapped[str] = mapped_column(String(16))
    mc_iterations: Mapped[int] = mapped_column(Integer)
    seed: Mapped[int] = mapped_column(Integer)
    data_hash: Mapped[str] = mapped_column(String(64))
    versions: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|running|done|error
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    stage: Mapped[str] = mapped_column(String(64), default="")
    error: Mapped[str | None] = mapped_column(Text)
    trigger: Mapped[str] = mapped_column(String(32), default="manual")  # manual|auto_import
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AnalysisResult(Base):
    __tablename__ = "analysis_result"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("analysis_run.run_id", ondelete="CASCADE"), index=True)
    section: Mapped[str] = mapped_column(String(32), index=True)
    payload: Mapped[dict] = mapped_column(JSON)


class ValidationRun(Base):
    __tablename__ = "validation_run"

    validation_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id_a: Mapped[str | None] = mapped_column(String(36))
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    stage: Mapped[str] = mapped_column(String(64), default="")
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ValidationResult(Base):
    __tablename__ = "validation_result"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    validation_id: Mapped[str] = mapped_column(
        ForeignKey("validation_run.validation_id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(32), index=True)
    payload: Mapped[dict] = mapped_column(JSON)


class Recommendation(Base):
    __tablename__ = "recommendation"

    rec_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(String(36), index=True)
    run_id: Mapped[str | None] = mapped_column(String(36))
    strategy: Mapped[str] = mapped_column(String(32), index=True)
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    seed: Mapped[int] = mapped_column(Integer)
    ticket: Mapped[list] = mapped_column(JSON)
    scorecard: Mapped[dict] = mapped_column(JSON, default=dict)
    target_draw_no: Mapped[int] = mapped_column(Integer, index=True)
    origin: Mapped[str] = mapped_column(String(16), default="user")  # user | backtest
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class UserTicket(Base):
    __tablename__ = "user_ticket"

    ticket_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    numbers: Mapped[list] = mapped_column(JSON)
    bonus: Mapped[int | None] = mapped_column(Integer)
    label: Mapped[str | None] = mapped_column(String(64))
    target_draw_no: Mapped[int] = mapped_column(Integer, index=True)
    scorecard: Mapped[dict] = mapped_column(JSON, default=dict)
    dup_count: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1"
    )  # 같은 번호·회차 중복 등록 횟수 (S5.5)
    dup_labels: Mapped[list] = mapped_column(JSON, default=list)  # 병합된 등록의 라벨 누적
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class TicketOutcome(Base):
    __tablename__ = "ticket_outcome"

    outcome_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(16), index=True)  # recommendation | user
    ticket_ref: Mapped[int] = mapped_column(Integer, index=True)
    strategy: Mapped[str] = mapped_column(String(32), index=True)
    origin: Mapped[str] = mapped_column(String(16), default="user")
    draw_no: Mapped[int] = mapped_column(Integer, index=True)
    ticket: Mapped[list] = mapped_column(JSON)
    main_matches: Mapped[int] = mapped_column(Integer)
    bonus_match: Mapped[bool] = mapped_column(Boolean, default=False)
    rank: Mapped[int] = mapped_column(Integer)  # 1..5, 0 = 낙첨
    prize_amount: Mapped[int] = mapped_column(Integer, default=0)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Experiment(Base):
    """전략 개선 루프 실험 (PRD §E9)."""

    __tablename__ = "experiment"

    experiment_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    strategy: Mapped[str] = mapped_column(String(32), index=True)
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    parent_id: Mapped[str | None] = mapped_column(String(36))
    iteration: Mapped[int] = mapped_column(Integer, default=1)
    tune_from: Mapped[int] = mapped_column(Integer)
    tune_to: Mapped[int] = mapped_column(Integer)
    holdout_from: Mapped[int] = mapped_column(Integer)
    holdout_to: Mapped[int] = mapped_column(Integer)
    n_tickets: Mapped[int] = mapped_column(Integer)
    seed: Mapped[int] = mapped_column(Integer)
    search: Mapped[str] = mapped_column(String(16), default="random")
    n_candidates: Mapped[int] = mapped_column(Integer, default=8)
    candidates: Mapped[list] = mapped_column(JSON, default=list)
    metrics_tune: Mapped[dict] = mapped_column(JSON, default=dict)
    metrics_holdout: Mapped[dict] = mapped_column(JSON, default=dict)
    h0_benchmark: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    stage: Mapped[str] = mapped_column(String(64), default="")
    error: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
