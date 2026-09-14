# 시나리오 — impl 20th: `.env.local` 값 미적용 수정 (PRD v1.9.2, 사용자 보고 2026-09-14)
| id | 목적 | 입력 | 기대결과 | 우선순위 |
|---|---|---|---|---|
| 20-1 | 재현·원인 | `.env.local` `LOTTO_NUMBER_RECOMMENDATION_COUNT=20`, `GET /config` | 10 반환. `Settings.env_file=(.env.local, .env.local.example)` → pydantic-settings 는 뒤 파일 우선 → example 이 덮어씀 | P0 |
| 20-2 | 우선순위 | tmp example(10)+local(20), OS env 30 | local 20 > example; OS env 30 > 파일; 없는 키는 example 기본값 | P0 |
| 20-3 | 기본 순서 | `Settings.model_config["env_file"]` | [.env.local.example, .env, .env.local] | P0 |
| 20-4 | 테스트 env 독립 | `test_auto_register` | 풀 크기 monkeypatch=10 으로 `.env.local` 값과 무관하게 통과 | P0 |
| 20-5 | live | `make local-restart` 후 `GET /config` | lotto_number_recommendation_count=20 | P0 |
| 20-6 | 게이트 | 전체 | pytest/vitest/lint/build 통과 | P0 |
