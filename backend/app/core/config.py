"""Lotto-Rec — settings (.env.local 기반, PRD §10 변수 규칙)."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# 프로젝트 루트 = backend/ 의 상위. .env.local 과 data/ 는 루트 기준.
PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # pydantic-settings: 뒤에 오는 파일이 앞 파일을 덮어쓴다 → example(기본값) → .env → .env.local(사용자 값) 순.
        # 실제 OS 환경변수는 모든 파일보다 우선.
        env_file=(PROJECT_ROOT / ".env.local.example", PROJECT_ROOT / ".env", PROJECT_ROOT / ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Lotto number recommender"
    env: str = "local"

    # 추천 — 로또번호 추천 갯수
    lotto_number_recommendation_count: int = Field(default=10, ge=1, le=50)

    # 게임 규칙
    lotto_pool_size: int = 45
    lotto_main_count: int = 6

    # 데이터 / 군 분할
    lotto_train_end_draw: int = 1000
    lotto_source_file: str = ".docs/lotto(~1240).xlsx"
    lotto_db_path: str = "data/lotto.db"
    lotto_cache_dir: str = "data/cache"
    database_url: str = "sqlite:///./data/lotto.db"

    # 통계
    lotto_significance_level: float = 0.05
    lotto_default_correction: Literal["bonferroni", "holm", "fdr_bh", "fdr_by"] = "fdr_bh"
    lotto_mc_iterations: int = 10_000
    lotto_mc_iterations_report: int = 100_000
    lotto_mc_iterations_deep: int = 500_000
    lotto_random_seed: int = 20260908
    lotto_min_effect_delta: float = 0.25
    lotto_cross_draw_lag: int = Field(default=5, ge=1, le=50)  # 회차간 전/후 간격 L (S2.13)
    lotto_auto_rerun_preset: Literal["quick", "report", "deep", "off"] = "quick"
    lotto_run_retention: int = Field(default=20, ge=0)
    lotto_recent_draws: int = Field(default=5, ge=1, le=20)  # 내 번호 최근 당첨번호 회차 수 (S5.8)
    lotto_timezone: str = "Asia/Seoul"  # 표시 시간대(IANA). 저장은 UTC

    # 고정 당첨금 (회차 데이터 부재 — 가정값, PRD Q4)
    lotto_prize_rank3_default: int = 1_500_000
    lotto_prize_rank4_default: int = 50_000
    lotto_prize_rank5_default: int = 5_000

    # 서버
    lotto_backend_host: str = "127.0.0.1"
    lotto_backend_port: int = 8000
    lotto_frontend_port: int = 5173

    @field_validator("database_url")
    @classmethod
    def _absolutize_sqlite(cls, v: str) -> str:
        """sqlite:///./relative → 프로젝트 루트 기준 절대경로 (uvicorn cwd 가 backend/ 여도 동일 DB)."""
        prefix = "sqlite:///./"
        if v.startswith(prefix):
            return f"sqlite:///{(PROJECT_ROOT / v[len(prefix) :]).as_posix()}"
        return v

    @property
    def project_root(self) -> Path:
        return PROJECT_ROOT

    @property
    def source_file_path(self) -> Path:
        return PROJECT_ROOT / self.lotto_source_file

    @property
    def cache_dir_path(self) -> Path:
        return PROJECT_ROOT / self.lotto_cache_dir

    @property
    def cors_origins(self) -> list[str]:
        return [
            f"http://127.0.0.1:{self.lotto_frontend_port}",
            f"http://localhost:{self.lotto_frontend_port}",
        ]


settings = Settings()
