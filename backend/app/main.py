"""Lotto-Rec — FastAPI entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.services.analysis_service import auto_rerun_hook
from app.services.import_service import register_post_import_hook
from app.services.tracking_service import tracking_hook

app = FastAPI(
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
