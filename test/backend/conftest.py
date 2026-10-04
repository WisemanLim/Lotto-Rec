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


@pytest.fixture(autouse=True)
def _no_real_env_local_writes(monkeypatch, tmp_path):  # noqa: ANN001, ANN201
    """S4.13 v1.24 안전장치 — SEED 값 생성이 일치하면 `.env.local` 을 갱신한다(`env_file.update_env_local`).
    어떤 테스트도 실제 프로젝트의 `.env.local` 을 건드리면 안 되므로, 세션의 모든 테스트에 대해
    `env_file.ENV_LOCAL_PATH` 를 매 테스트 전용 임시 파일로 강제 치환한다(개별 테스트가 놓쳐도 안전)."""
    from app.core import env_file

    fake = tmp_path / ".env.local"
    fake.write_text("LOTTO_RANDOM_SEED=0\n", encoding="utf-8")
    monkeypatch.setattr(env_file, "ENV_LOCAL_PATH", fake)
    # v1.32: SEED 탐색 종료 스냅샷도 실제 data/cache 대신 임시 경로로
    from app.services import seed_search_service

    monkeypatch.setattr(seed_search_service, "SNAPSHOT_DIR", tmp_path / "seed_search")
    # v1.33: 분석 run MC 체크포인트도 임시 경로로
    from app.services import analysis_service

    monkeypatch.setattr(analysis_service, "CHECKPOINT_DIR", tmp_path / "runs")


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
