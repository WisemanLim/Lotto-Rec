"""원천 데이터 파싱·검증 (xlsx/csv → DrawRecord). PRD §3.1, §E1 S1.2."""

from __future__ import annotations

import hashlib
import io
from dataclasses import asdict, dataclass
from pathlib import Path

import pandas as pd

COLUMN_ALIASES: dict[str, str] = {
    "회차": "draw_no",
    "draw_no": "draw_no",
    "drwno": "draw_no",
    "round": "draw_no",
    "번호1": "n1",
    "번호2": "n2",
    "번호3": "n3",
    "번호4": "n4",
    "번호5": "n5",
    "번호6": "n6",
    "n1": "n1",
    "n2": "n2",
    "n3": "n3",
    "n4": "n4",
    "n5": "n5",
    "n6": "n6",
    "drwtno1": "n1",
    "drwtno2": "n2",
    "drwtno3": "n3",
    "drwtno4": "n4",
    "drwtno5": "n5",
    "drwtno6": "n6",
    "보너스": "bonus",
    "bonus": "bonus",
    "bnusno": "bonus",
    "1등 당첨금": "prize1",
    "prize1": "prize1",
    "1등당첨금": "prize1",
    "1등 당첨수": "winners1",
    "winners1": "winners1",
    "1등당첨수": "winners1",
    "2등 당첨금": "prize2",
    "prize2": "prize2",
    "2등당첨금": "prize2",
    "2등 당첨수": "winners2",
    "winners2": "winners2",
    "2등당첨수": "winners2",
}
REQUIRED = ["draw_no", "n1", "n2", "n3", "n4", "n5", "n6", "bonus"]
OPTIONAL = ["prize1", "winners1", "prize2", "winners2"]


@dataclass(frozen=True)
class DrawRecord:
    draw_no: int
    n1: int
    n2: int
    n3: int
    n4: int
    n5: int
    n6: int
    bonus: int
    prize1: int | None = None
    winners1: int | None = None
    prize2: int | None = None
    winners2: int | None = None

    @property
    def numbers(self) -> list[int]:
        return [self.n1, self.n2, self.n3, self.n4, self.n5, self.n6]

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class ParseReport:
    records: list[DrawRecord]
    invalid: list[dict]  # {"row": int, "draw_no": int|None, "reason": str}
    data_hash: str
    columns: list[str]


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    mapping: dict[str, str] = {}
    for col in df.columns:
        key = str(col).strip().lower().replace(" ", "")
        key_sp = str(col).strip().lower()
        if key_sp in COLUMN_ALIASES:
            mapping[col] = COLUMN_ALIASES[key_sp]
        elif key in COLUMN_ALIASES:
            mapping[col] = COLUMN_ALIASES[key]
    return df.rename(columns=mapping)


def read_table(source: bytes | Path, filename: str) -> pd.DataFrame:
    """xlsx/xls/csv 를 DataFrame 으로. 첫 시트 사용."""
    name = filename.lower()
    if isinstance(source, Path):
        buf: io.BytesIO | Path = source
    else:
        buf = io.BytesIO(source)
    if name.endswith((".xlsx", ".xlsm", ".xls")):
        return pd.read_excel(buf, sheet_name=0)
    if name.endswith((".csv", ".txt")):
        if isinstance(buf, io.BytesIO):
            raw = buf.getvalue()
            for enc in ("utf-8-sig", "utf-8", "cp949"):
                try:
                    return pd.read_csv(io.StringIO(raw.decode(enc)))
                except UnicodeDecodeError:
                    continue
            raise ValueError("CSV 인코딩 해석 실패 (utf-8/cp949)")
        return pd.read_csv(buf)
    raise ValueError(f"지원하지 않는 파일 형식: {filename}")


def _to_int(v: object) -> int | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    try:
        return int(float(str(v).replace(",", "")))
    except (TypeError, ValueError):
        return None


def parse_draws(df: pd.DataFrame, pool_size: int = 45, main_count: int = 6) -> ParseReport:
    """컬럼 정규화 → 행 단위 검증 → DrawRecord 목록. 위반 행은 invalid 에 사유와 함께 기록."""
    df = _normalize_columns(df)
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"필수 컬럼 누락: {missing} (인식 컬럼: {list(df.columns)})")

    records: list[DrawRecord] = []
    invalid: list[dict] = []
    seen: set[int] = set()
    main_cols = ["n1", "n2", "n3", "n4", "n5", "n6"][:main_count]

    for idx, row in enumerate(df.itertuples(index=False), start=2):  # 헤더 다음 행 = 2
        r = row._asdict()
        draw_no = _to_int(r.get("draw_no"))
        if draw_no is None or draw_no < 1:
            invalid.append({"row": idx, "draw_no": None, "reason": "회차 없음/비정상"})
            continue
        if draw_no in seen:
            invalid.append({"row": idx, "draw_no": draw_no, "reason": "파일 내 중복 회차"})
            continue
        main = [_to_int(r.get(c)) for c in main_cols]
        bonus = _to_int(r.get("bonus"))
        if any(m is None for m in main) or bonus is None:
            invalid.append({"row": idx, "draw_no": draw_no, "reason": "본번호/보너스 결측"})
            continue
        main_i = [int(m) for m in main if m is not None]
        if any(not (1 <= m <= pool_size) for m in main_i + [bonus]):
            invalid.append({"row": idx, "draw_no": draw_no, "reason": f"번호 범위 위반(1~{pool_size})"})
            continue
        if len(set(main_i)) != main_count:
            invalid.append({"row": idx, "draw_no": draw_no, "reason": "본번호 중복"})
            continue
        if bonus in main_i:
            invalid.append({"row": idx, "draw_no": draw_no, "reason": "보너스가 본번호와 중복"})
            continue
        main_sorted = sorted(main_i)  # 집합 표현 — 오름차순 저장 (PRD §3.1)
        seen.add(draw_no)
        records.append(
            DrawRecord(
                draw_no=draw_no,
                n1=main_sorted[0],
                n2=main_sorted[1],
                n3=main_sorted[2],
                n4=main_sorted[3],
                n5=main_sorted[4],
                n6=main_sorted[5],
                bonus=bonus,
                prize1=_to_int(r.get("prize1")),
                winners1=_to_int(r.get("winners1")),
                prize2=_to_int(r.get("prize2")),
                winners2=_to_int(r.get("winners2")),
            )
        )
    records.sort(key=lambda x: x.draw_no)
    h = hashlib.sha256()
    for rec in records:
        h.update(repr(rec.as_dict()).encode())
    return ParseReport(records=records, invalid=invalid, data_hash=h.hexdigest()[:16], columns=list(df.columns))


def load_source_file(path: Path, **kw: int) -> ParseReport:
    return parse_draws(read_table(path, path.name), **kw)
