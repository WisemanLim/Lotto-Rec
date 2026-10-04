"""Lotto-Rec — FastAPI entrypoint."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.services.analysis_service import auto_rerun_hook, resume_interrupted_runs
from app.services.import_service import register_post_import_hook
from app.services.tracking_service import tracking_hook


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # S2.14: 이전 프로세스(재기동 전)에서 멈춘 분석 run 을 interrupted 로 표시하고 (설정 시) 이어서 실행
    try:
        resume_interrupted_runs()
    except Exception as e:  # noqa: BLE001 — DB 미마이그레이션 등으로 서버 기동 자체를 막지 않는다
        print(f"[startup] 중단된 분석 run 재개 실패: {type(e).__name__}: {e}")
    yield


app = FastAPI(
    lifespan=lifespan,
    title=settings.app_name,
    description="로또 6/45 통계분석·검증·추천 API (local 전용)",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api/v1")
register_post_import_hook(tracking_hook)  # 티켓 대조 먼저
register_post_import_hook(auto_rerun_hook)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.env}
