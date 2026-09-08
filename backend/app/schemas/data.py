from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class DrawIn(BaseModel):
    draw_no: int = Field(ge=1)
    numbers: list[int] = Field(min_length=6, max_length=6)
    bonus: int = Field(ge=1, le=45)
    prize1: int | None = None
    winners1: int | None = None
    prize2: int | None = None
    winners2: int | None = None
    overwrite: bool = False

    @field_validator("numbers")
    @classmethod
    def _valid_numbers(cls, v: list[int]) -> list[int]:
        if len(set(v)) != 6 or any(not (1 <= x <= 45) for x in v):
            raise ValueError("본번호는 1~45 범위의 서로 다른 6개")
        return sorted(v)


class DrawOut(BaseModel):
    draw_no: int
    numbers: list[int]
    bonus: int
    prize1: int | None
    winners1: int | None
    prize2: int | None
    winners2: int | None
    cohort: str


class ImportOut(BaseModel):
    import_id: int | None
    filename: str
    data_hash: str
    inserted: int
    skipped_duplicate: int
    inserted_draws: list[int]
    conflicts: list[dict]
    invalid: list[dict]
    triggered_run_id: str | None


class DataSummary(BaseModel):
    total_draws: int
    min_draw: int | None
    max_draw: int | None
    train_end_draw: int
    cohort_a_count: int
    cohort_b_count: int
    missing_draws: list[int]
    integrity: dict
    latest_import: dict | None
