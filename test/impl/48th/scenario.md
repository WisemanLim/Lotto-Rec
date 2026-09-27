# 시나리오 — impl 48th: SEED 값 생성은 제외 번호 미적용 + curl 시나리오 스크립트 (PRD v1.30, S4.13)

| id | 기대 |
|---|---|
| 48-1 | `SeedSearchIn` 스키마에 `exclude_numbers` 필드 자체가 없다(구조적 보증) |
| 48-2 | 제외 번호를 억지로 함께 보내도 무시되고, 실제 직전 회차 번호를 정상적으로 맞혀 완료된다 |
| 48-3 | `scripts/recommend-flow.sh`: 제외 번호 전달/미전달 모두 동작, 미전달 시 제외 없이 생성 |
| 48-4 | `scripts/recommend-flow.sh --use-seed`: SEED 값 생성 호출·폴링 후 그 seed 로 순차 생성, 미호출 시 seed 필드 생략(.env 기본값) |
| 48-5 | `scripts/recommend-flow.sh`: 추천 개수는 옵션(`--count`), 미전달 시 필드 생략(.env 기본값) |
| 48-6 | 회귀: pytest·ruff·mypy, `.env.local` 무변경(격리 픽스처 유지 확인) |
