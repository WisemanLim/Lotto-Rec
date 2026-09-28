"""v1 라우터 집합. 구현 단계에서 data/analysis/validation/recommend/user/tracking 라우터를 추가한다."""

from fastapi import APIRouter

from app.api import analysis, data, experiments, recommend, tracking, user, validation
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(data.router)
api_router.include_router(analysis.router)
api_router.include_router(validation.router)
api_router.include_router(recommend.router)
api_router.include_router(user.router)
api_router.include_router(tracking.router)
api_router.include_router(experiments.router)


@api_router.get("/config", tags=["config"])
def get_config() -> dict[str, object]:
    """유효 설정 조회 (PRD §11 GET /api/v1/config)."""
    return {
        "app_name": settings.app_name,
        "lotto_number_recommendation_count": settings.lotto_number_recommendation_count,
        "lotto_pool_size": settings.lotto_pool_size,
        "lotto_main_count": settings.lotto_main_count,
        "lotto_train_end_draw": settings.lotto_train_end_draw,
        "lotto_significance_level": settings.lotto_significance_level,
        "lotto_default_correction": settings.lotto_default_correction,
        "mc_iterations": {
            "quick": settings.lotto_mc_iterations,
            "report": settings.lotto_mc_iterations_report,
            "deep": settings.lotto_mc_iterations_deep,
        },
        "lotto_random_seed": settings.lotto_random_seed,
        "lotto_auto_rerun_preset": settings.lotto_auto_rerun_preset,
        "lotto_cross_draw_lag": settings.lotto_cross_draw_lag,
        "lotto_min_effect_delta": settings.lotto_min_effect_delta,
        "lotto_run_retention": settings.lotto_run_retention,
        "lotto_recent_draws": settings.lotto_recent_draws,
        "lotto_exclude_trend_draws": settings.lotto_exclude_trend_draws,
        "lotto_exclude_recent_draws": settings.lotto_exclude_recent_draws,
        "lotto_lottery_pick_count": settings.lotto_lottery_pick_count,
        "lotto_seed_search_max_iter": settings.lotto_seed_search_max_iter,
        "lotto_prize_rank3_default": settings.lotto_prize_rank3_default,
        "lotto_prize_rank4_default": settings.lotto_prize_rank4_default,
        "lotto_prize_rank5_default": settings.lotto_prize_rank5_default,
        "timezone": settings.lotto_timezone,
    }
