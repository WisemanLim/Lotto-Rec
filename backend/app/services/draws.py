"""draws 조회 → numpy/pandas 변환 (분석 입력)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.features import incidence_from_draws
from app.db.models import Draw


@dataclass
class DrawSet:
    draw_no: np.ndarray  # (T,)
    main: np.ndarray  # (T, 6) sorted
    bonus: np.ndarray  # (T,)
    winners1: np.ndarray  # (T,) float (nan 허용)
    winners2: np.ndarray
    prize1: np.ndarray
    prize2: np.ndarray

    @property
    def T(self) -> int:
        return int(self.main.shape[0])

    @property
    def incidence(self) -> np.ndarray:
        return incidence_from_draws(self.main, settings.lotto_pool_size)

    @property
    def bonus_incidence(self) -> np.ndarray:
        return incidence_from_draws(self.bonus[:, None], settings.lotto_pool_size)

    def slice(self, lo: int | None = None, hi: int | None = None) -> DrawSet:
        m = np.ones_like(self.draw_no, dtype=bool)
        if lo is not None:
            m &= self.draw_no >= lo
        if hi is not None:
            m &= self.draw_no <= hi
        return DrawSet(
            self.draw_no[m],
            self.main[m],
            self.bonus[m],
            self.winners1[m],
            self.winners2[m],
            self.prize1[m],
            self.prize2[m],
        )


def cohort_of(draw_no: int) -> str:
    return "A" if draw_no <= settings.lotto_train_end_draw else "B"


def cohort_range(cohort: str, max_draw: int | None) -> tuple[int, int | None]:
    if cohort == "A":
        return 1, settings.lotto_train_end_draw
    if cohort == "B":
        return settings.lotto_train_end_draw + 1, max_draw
    return 1, max_draw


def load_draws(session: Session, lo: int | None = None, hi: int | None = None) -> DrawSet:
    stmt = select(Draw).order_by(Draw.draw_no)
    if lo is not None:
        stmt = stmt.where(Draw.draw_no >= lo)
    if hi is not None:
        stmt = stmt.where(Draw.draw_no <= hi)
    rows = session.scalars(stmt).all()
    if not rows:
        z = np.zeros((0,))
        return DrawSet(np.zeros((0,), dtype=int), np.zeros((0, 6), dtype=int), np.zeros((0,), dtype=int), z, z, z, z)
    draw_no = np.array([r.draw_no for r in rows])
    main = np.array([[r.n1, r.n2, r.n3, r.n4, r.n5, r.n6] for r in rows])
    bonus = np.array([r.bonus for r in rows])

    def col(attr: str) -> np.ndarray:
        return np.array([np.nan if getattr(r, attr) is None else float(getattr(r, attr)) for r in rows])

    return DrawSet(draw_no, main, bonus, col("winners1"), col("winners2"), col("prize1"), col("prize2"))


def draws_dataframe(session: Session) -> pd.DataFrame:
    rows = session.scalars(select(Draw).order_by(Draw.draw_no)).all()
    return pd.DataFrame(
        [
            {
                "draw_no": r.draw_no,
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
                "cohort": cohort_of(r.draw_no),
            }
            for r in rows
        ]
    )


def max_draw_no(session: Session) -> int | None:
    return session.scalar(select(func.max(Draw.draw_no)))


def count_draws(session: Session) -> int:
    return int(session.scalar(select(func.count(Draw.draw_no))) or 0)
