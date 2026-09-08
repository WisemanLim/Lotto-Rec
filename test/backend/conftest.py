"""공통 픽스처 — 격리된 임시 SQLite DB + TestClient. 실 DB(data/lotto.db) 미사용."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SOURCE_XLSX = ROOT / ".docs" / "lotto(~1240).xlsx"

# 테스트 모듈이 import 시점에 app.main 을 로드하므로 conftest 모듈 로드 시 환경을 먼저 고정한다.
_TEST_DB = Path(tempfile.mkdtemp(prefix="lotto-rec-test-")) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB.as_posix()}"
os.environ["LOTTO_AUTO_RERUN_PRESET"] = "off"
os.environ["LOTTO_MC_ITERATIONS"] = "300"


@pytest.fixture(scope="session")
def engine():  # noqa: ANN201
    from app.db import models  # noqa: F401  (메타데이터 등록)
    from app.db.base import Base, engine

    Base.metadata.create_all(engine)
    return engine


@pytest.fixture()
def session(engine):  # noqa: ANN001, ANN201
    from app.db.base import SessionLocal

    s = SessionLocal()
    try:
        yield s
    finally:
        s.rollback()
        s.close()


@pytest.fixture(scope="session")
def client(engine):  # noqa: ANN001, ANN201
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


@pytest.fixture(scope="session")
def seeded(engine) -> None:  # noqa: ANN001
    """군 A(≤1000) 시드 1회."""
    from app.db.base import SessionLocal
    from app.services.import_service import seed_from_source

    with SessionLocal() as s:
        seed_from_source(s, SOURCE_XLSX)
